import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Employment } from '../shared/employment.js';
import type { Envelope, Receipt } from './am.js';
import { AppError } from './errors.js';
import type { AssessmentRecord } from '../shared/assessment.js';
import { weeklyPeriodWasStated } from './hours-evidence.js';

export type OperationStatus = 'pending' | 'applying' | 'uncertain' | 'committed' | 'rejected' | 'stale';
export type Operation = { id: string; ownerId: string; proposalRevision: 1; baseRevision: number; status: OperationStatus;
  oldValue: Employment | null; newValue: Employment | null; createdAt: string; confirmedAt: string | null;
  previousFactId: string | null; receipt: Receipt | null; chat?: { utterance: string; expiresAt: string; periodSource: 'message' | 'interpretation' } };
export type Head = { revision: number; receipt: Receipt | null };
export type ChatPreviewRecord = { id: string; owner: string; base_revision: number; utterance: string | null; created_at: string; expires_at: string;
  status: string; endpoint: string | null; context: string | null; session_id: string | null; proposal_id: string | null };
type Row = { id: string; owner: string; base_revision: number; status: OperationStatus; old_json: string | null;
  new_json: string | null; created_at: string; confirmed_at: string | null; previous_fact_id: string | null; receipt_json: string | null };
function operation(row: Row): Operation {
  return { id: row.id, ownerId: row.owner, proposalRevision: 1, baseRevision: row.base_revision, status: row.status,
    oldValue: row.old_json ? JSON.parse(row.old_json) : null, newValue: row.new_json ? JSON.parse(row.new_json) : null,
    createdAt: row.created_at, confirmedAt: row.confirmed_at, previousFactId: row.previous_fact_id,
    receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null };
}

/** Operational metadata only. Successful/rejected/stale operations discard personal values. */
export class Journal {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS heads (owner TEXT PRIMARY KEY, revision INTEGER NOT NULL, receipt_json TEXT);
      CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, owner TEXT NOT NULL, base_revision INTEGER NOT NULL,
        status TEXT NOT NULL, old_json TEXT, new_json TEXT, created_at TEXT NOT NULL, confirmed_at TEXT,
        previous_fact_id TEXT, receipt_json TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_commit ON operations(owner) WHERE status IN ('applying','uncertain');
      CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, operation_id TEXT UNIQUE NOT NULL, owner TEXT NOT NULL,
        revision INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, owner TEXT NOT NULL, profile_revision INTEGER NOT NULL,
        policy_digest TEXT NOT NULL, assessment_date TEXT NOT NULL, created_at TEXT NOT NULL, result_json TEXT NOT NULL,
        UNIQUE(owner, profile_revision, policy_digest, assessment_date));
      CREATE TABLE IF NOT EXISTS assessment_notifications (id TEXT PRIMARY KEY, assessment_id TEXT UNIQUE NOT NULL,
        owner TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chat_previews (id TEXT PRIMARY KEY, owner TEXT NOT NULL, base_revision INTEGER NOT NULL,
        utterance TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL,
        endpoint TEXT, context TEXT, session_id TEXT, proposal_id TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS one_chat_interpretation ON chat_previews(owner) WHERE status='interpreting';`);
  }
  close() { this.db.close(); }
  private transaction<T>(run: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = run(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  head(owner: string): Head {
    const row = this.db.prepare('SELECT revision, receipt_json FROM heads WHERE owner=?').get(owner) as {revision: number; receipt_json: string | null} | undefined;
    return row ? { revision: row.revision, receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null } : { revision: 0, receipt: null };
  }
  active(owner: string) { return !!this.db.prepare("SELECT 1 FROM operations WHERE owner=? AND status IN ('applying','uncertain')").get(owner); }
  get(owner: string, id: string): Operation {
    const row = this.db.prepare('SELECT * FROM operations WHERE id=? AND owner=?').get(id, owner) as Row | undefined;
    if (!row) throw new AppError(404, 'PROPOSAL_NOT_FOUND', 'This change was not found.');
    const result = operation(row);
    if (result.status === 'pending') {
      const chat = this.db.prepare("SELECT utterance,expires_at FROM chat_previews WHERE owner=? AND proposal_id=? AND status='proposed' AND utterance IS NOT NULL").get(owner, id) as { utterance: string; expires_at: string } | undefined;
      if (chat) result.chat = { utterance: chat.utterance, expiresAt: chat.expires_at,
        periodSource: weeklyPeriodWasStated(chat.utterance) ? 'message' : 'interpretation' };
    }
    return result;
  }
  list(owner: string): Operation[] {
    return (this.db.prepare("SELECT id FROM operations WHERE owner=? ORDER BY CASE WHEN status IN ('applying','uncertain') THEN 0 WHEN status='pending' THEN 1 ELSE 2 END, created_at DESC LIMIT 100").all(owner) as { id: string }[]).map(row => this.get(owner, row.id));
  }
  propose(owner: string, baseRevision: number, oldValue: Employment | null, newValue: Employment, now: string, chatRequestId?: string): Operation {
    return this.transaction(() => {
      if (this.active(owner)) throw new AppError(409, 'RECONCILIATION_REQUIRED', 'An earlier save is being checked. No new change was saved.');
      const head = this.head(owner);
      if (head.revision !== baseRevision) throw new AppError(409, 'STALE_REVISION', 'Your information changed. Reload before reviewing a new change.');
      const id = randomUUID();
      if (chatRequestId) {
        const chat = this.chatPreview(owner, chatRequestId);
        if (chat.status !== 'interpreting' || chat.base_revision !== baseRevision || chat.expires_at <= now) throw new AppError(409, 'CHAT_EXPIRED', 'This chat request can no longer create a proposal.');
        this.db.prepare("UPDATE chat_previews SET status='proposed',proposal_id=? WHERE owner=? AND id=?").run(id, owner, chatRequestId);
      }
      this.db.prepare("INSERT INTO operations VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, ?, NULL)")
        .run(id, owner, baseRevision, oldValue ? JSON.stringify(oldValue) : null, JSON.stringify(newValue), now, head.receipt?.factId ?? null);
      return this.get(owner, id);
    });
  }
  claim(owner: string, id: string, now: string | (() => string)): Operation {
    return this.transaction(() => {
      const op = this.get(owner, id);
      if (op.status === 'committed') return op;
      if (op.status !== 'pending') throw new AppError(409, 'PROPOSAL_NOT_PENDING', 'This change is no longer awaiting confirmation.');
      if (this.active(owner)) throw new AppError(409, 'RECONCILIATION_REQUIRED', 'An earlier save is being checked. Do not submit it again.');
      if (this.head(owner).revision !== op.baseRevision) throw new AppError(409, 'STALE_REVISION', 'This proposal is outdated. Review a new change.');
      // Sample runtime time after acquiring the transaction lock. The earlier
      // evidence read and periodic cleanup can both straddle the chat deadline.
      const claimedAt = typeof now === 'function' ? now() : now;
      if (this.db.prepare('SELECT 1 FROM chat_previews WHERE owner=? AND proposal_id=? AND expires_at<=?').get(owner, id, claimedAt)) {
        throw new AppError(409, 'CHAT_EXPIRED', 'This chat proposal has expired. Describe the correction again before confirming.');
      }
      this.db.prepare("UPDATE operations SET status='applying', confirmed_at=? WHERE id=? AND owner=?").run(claimedAt, id, owner);
      return this.get(owner, id);
    });
  }
  uncertain(owner: string, id: string) {
    this.db.prepare("UPDATE operations SET status='uncertain' WHERE owner=? AND id=? AND status='applying'").run(owner, id);
  }
  releaseUnsent(owner: string, id: string) {
    // Called only when the real adapter proves it never reached the POST stage.
    this.db.prepare("UPDATE operations SET status='pending',confirmed_at=NULL WHERE owner=? AND id=? AND status IN ('applying','uncertain')").run(owner, id);
  }
  complete(owner: string, id: string, receipt: Receipt, now: string): Operation {
    return this.transaction(() => {
      const op = this.get(owner, id);
      if (op.status === 'committed') {
        if (JSON.stringify(op.receipt) !== JSON.stringify(receipt)) throw new AppError(409, 'RECEIPT_CONFLICT', 'The save receipt needs review.');
        return op;
      }
      if (!['applying', 'uncertain'].includes(op.status) || this.head(owner).revision !== op.baseRevision) throw new AppError(409, 'RECEIPT_CONFLICT', 'The save state needs review.');
      this.db.prepare('INSERT INTO heads VALUES (?, ?, ?) ON CONFLICT(owner) DO UPDATE SET revision=excluded.revision,receipt_json=excluded.receipt_json')
        .run(owner, op.baseRevision + 1, JSON.stringify(receipt));
      this.db.prepare("UPDATE operations SET status='committed',receipt_json=?,old_json=NULL,new_json=NULL WHERE id=? AND owner=?")
        .run(JSON.stringify(receipt), id, owner);
      this.db.prepare("UPDATE operations SET status='stale',old_json=NULL,new_json=NULL WHERE owner=? AND status='pending' AND base_revision<=?").run(owner, op.baseRevision);
      this.clearSettledChat(owner);
      this.db.prepare('INSERT OR IGNORE INTO notifications VALUES (?, ?, ?, ?, ?)').run(randomUUID(), id, owner, op.baseRevision + 1, now);
      return this.get(owner, id);
    });
  }
  reject(owner: string, id: string): Operation {
    return this.transaction(() => {
      const op = this.get(owner, id);
      if (op.status !== 'pending') throw new AppError(409, 'PROPOSAL_NOT_PENDING', 'This change can no longer be rejected.');
      this.db.prepare("UPDATE operations SET status='rejected',old_json=NULL,new_json=NULL WHERE owner=? AND id=?").run(owner, id);
      this.clearSettledChat(owner);
      return this.get(owner, id);
    });
  }
  private clearSettledChat(owner: string) {
    this.db.prepare("UPDATE chat_previews SET utterance=NULL,status='settled' WHERE owner=? AND proposal_id IN (SELECT id FROM operations WHERE owner=? AND status IN ('committed','rejected','stale'))").run(owner, owner);
  }
  /** Local content redaction/expiry only. No AM session or other row is deleted. */
  expireChat(owner: string, now: string) {
    this.db.prepare("UPDATE operations SET status='stale',old_json=NULL,new_json=NULL WHERE owner=? AND status='pending' AND id IN (SELECT proposal_id FROM chat_previews WHERE owner=? AND expires_at<=?)").run(owner, owner, now);
    this.clearSettledChat(owner);
    this.db.prepare("UPDATE chat_previews SET utterance=NULL,status=CASE WHEN status IN ('blocked','uncertain') THEN status ELSE 'expired' END WHERE owner=? AND expires_at<=? AND utterance IS NOT NULL").run(owner, now);
  }
  chatPreview(owner: string, id: string): ChatPreviewRecord {
    const row = this.db.prepare('SELECT * FROM chat_previews WHERE owner=? AND id=?').get(owner, id) as ChatPreviewRecord | undefined;
    if (!row) throw new AppError(404, 'CHAT_NOT_FOUND', 'This chat request was not found.');
    return row;
  }
  recoverChat(owner: string) {
    // Explicit startup recovery for a configured owner, never an implicit global
    // update whenever another journal handle is opened.
    this.db.prepare("UPDATE chat_previews SET status='uncertain' WHERE owner=? AND status='interpreting'").run(owner);
  }
  beginChat(owner: string, baseRevision: number, utterance: string, now: string) {
    return this.transaction(() => {
      this.expireChat(owner, now);
      if (this.db.prepare("SELECT 1 FROM chat_previews WHERE owner=? AND status IN ('blocked','uncertain')").get(owner)) throw new AppError(503, 'CHAT_REVIEW_REQUIRED', 'A previous preview needs review. No new preview was sent. You can use the employment form.');
      if (this.active(owner) || this.db.prepare("SELECT 1 FROM operations WHERE owner=? AND status='pending'").get(owner)
        || this.db.prepare("SELECT 1 FROM chat_previews WHERE owner=? AND status='interpreting'").get(owner)) throw new AppError(409, 'CHANGE_PENDING', 'Finish or discard the current change before starting another.');
      const count = this.db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN created_at>=? THEN 1 ELSE 0 END) AS today FROM chat_previews WHERE owner=?')
        .get(`${now.slice(0, 10)}T00:00:00.000Z`, owner) as { total: number; today: number | null };
      if (count.total >= 50 || (count.today ?? 0) >= 5) throw new AppError(429, 'CHAT_TRIAL_LIMIT', 'The synthetic chat trial limit has been reached. You can use the employment form.');
      if (this.head(owner).revision !== baseRevision) throw new AppError(409, 'STALE_REVISION', 'Your information changed. Reload before continuing.');
      if (!utterance.trim() || utterance.length > 500) throw new Error('Invalid chat request');
      const id = randomUUID(); const expiresAt = new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString();
      this.db.prepare("INSERT INTO chat_previews VALUES (?, ?, ?, ?, ?, ?, 'interpreting', NULL, NULL, NULL, NULL)").run(id, owner, baseRevision, utterance, now, expiresAt);
      return id;
    });
  }
  recordChatRemote(owner: string, id: string, endpoint: string, context: string, sessionId: string | null) {
    const record = this.chatPreview(owner, id);
    if (record.status !== 'interpreting' || (record.endpoint && (record.endpoint !== endpoint || record.context !== context))
      || (record.session_id && record.session_id !== sessionId)) throw new AppError(409, 'CHAT_REMOTE_CONFLICT', 'The preview metadata needs review.');
    this.db.prepare('UPDATE chat_previews SET endpoint=?,context=?,session_id=? WHERE owner=? AND id=?').run(endpoint, context, sessionId, owner, id);
  }
  finishChat(owner: string, id: string, status: 'held' | 'failed' | 'blocked' | 'uncertain') {
    this.chatPreview(owner, id);
    this.db.prepare("UPDATE chat_previews SET status=?,utterance=CASE WHEN ? IN ('held','failed') THEN NULL ELSE utterance END WHERE owner=? AND id=? AND status='interpreting'").run(status, status, owner, id);
  }
  notifications(owner: string) {
    return this.db.prepare(`SELECT id, operation_id AS operationId, NULL AS assessmentId, revision, created_at AS createdAt, 'saved' AS kind FROM notifications WHERE owner=?
      UNION ALL SELECT id, NULL AS operationId, assessment_id AS assessmentId, revision, created_at AS createdAt, 'assessed' AS kind FROM assessment_notifications WHERE owner=?
      ORDER BY createdAt DESC LIMIT 100`).all(owner, owner);
  }
  saveAssessment(owner: string, record: AssessmentRecord): AssessmentRecord {
    return this.transaction(() => {
      const head = this.head(owner);
      if (record.ownerId !== owner || this.active(owner) || head.revision !== record.profileRevision
        || JSON.stringify(head.receipt) !== JSON.stringify(record.evidence)) throw new AppError(409, 'STALE_REVISION', 'Your information changed. Run the check again.');
      const existing = this.db.prepare('SELECT result_json FROM assessments WHERE owner=? AND profile_revision=? AND policy_digest=? AND assessment_date=?')
        .get(owner, record.profileRevision, record.policy.digest, record.assessmentDate) as { result_json: string } | undefined;
      if (existing) return JSON.parse(existing.result_json);
      this.db.prepare('INSERT INTO assessments VALUES (?, ?, ?, ?, ?, ?, ?)').run(record.id, owner, record.profileRevision,
        record.policy.digest, record.assessmentDate, record.createdAt, JSON.stringify(record));
      this.db.prepare('INSERT INTO assessment_notifications VALUES (?, ?, ?, ?, ?)').run(randomUUID(), record.id, owner, record.profileRevision, record.createdAt);
      return record;
    });
  }
  assessment(owner: string, id: string): AssessmentRecord {
    const row = this.db.prepare('SELECT result_json FROM assessments WHERE owner=? AND id=?').get(owner, id) as { result_json: string } | undefined;
    if (!row) throw new AppError(404, 'ASSESSMENT_NOT_FOUND', 'This assessment was not found.');
    return JSON.parse(row.result_json);
  }
  assessments(owner: string): AssessmentRecord[] {
    const rows = this.db.prepare('SELECT result_json FROM assessments WHERE owner=? ORDER BY created_at DESC LIMIT 100').all(owner) as { result_json: string }[];
    return rows.map(row => JSON.parse(row.result_json));
  }
}

export function envelopeFor(op: Operation): Envelope {
  if (!op.newValue || !op.confirmedAt) throw new AppError(409, 'INVALID_OPERATION', 'The change cannot be committed.');
  return { schema: 1, ownerId: op.ownerId, operationId: op.id, revision: op.baseRevision + 1, previousFactId: op.previousFactId,
    confirmedAt: op.confirmedAt, employment: op.newValue };
}
