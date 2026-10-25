import { createHash, randomUUID } from 'node:crypto';
import { RecordId, isRetryableConflict, type Surreal, type SurrealQueryable } from 'surrealdb';
import type { JournalStore } from './journal-store.js';
import type { Operation, OperationStatus, Head, ChatPreviewRecord } from './journal.js';
import type { Employment } from '../shared/employment.js';
import type { AssessmentRecord } from '../shared/assessment.js';
import type { Receipt } from './am.js';
import { AppError } from './errors.js';
import { weeklyPeriodWasStated } from './hours-evidence.js';

type Table = 'heads' | 'operations' | 'notifications' | 'assessments' | 'assessment_notifications'
  | 'chat_previews' | 'chat_diagnostics' | 'chat_clarifications';
type Row = { id: string; owner: string; base_revision: number; status: OperationStatus;
  old_json: string | null; new_json: string | null; created_at: string; confirmed_at: string | null;
  previous_fact_id: string | null; receipt_json: string | null };
// Read-only provenance from retired hours-chat records. No new clarification writer.
type ClarificationRow = { issue: 'period' | 'intent' | 'field'; answer: 'actual_weekly_work' | 'availability_only' | 'different_period' | null };
type NotificationRow = { id: string; operation_id?: string; assessment_id?: string; revision: number; created_at: string };
type AssessmentRow = { id: string; profile_revision: number; policy_digest: string; assessment_date: string; result_json: string };

const notFound = (code: string, message: string) => new AppError(404, code, message);
const stale = () => new AppError(409, 'STALE_REVISION', 'Your information changed. Reload before continuing.');
const blocked = () => new AppError(409, 'RECONCILIATION_REQUIRED', 'An earlier save is being checked. Do not submit it again.');
const expired = () => new AppError(409, 'CHAT_EXPIRED', 'This chat request has expired or is no longer current.');

/** Stable IDs are scoped to the authenticated owner, never model-selected IDs. */
export function journalRecordId(table: Table, owner: string, key = owner): RecordId {
  return new RecordId('maple_' + table, createHash('sha256').update(JSON.stringify([owner, key])).digest('hex'));
}

/**
 * Real SurrealDB journal using explicit WebSocket transactions.
 * Each mutation writes the same per-owner guard record. Competing transactions
 * must conflict before both can commit; no process-local lock or automatic retry.
 * No AM call occurs inside a DB transaction. A lost COMMIT response stays unknown.
 */
export class SurrealJournal implements JournalStore {
  private constructor(private readonly db: Surreal, private readonly session: SurrealQueryable = db,
    private readonly transactionOwner?: string) {}
  static async open(db: Surreal): Promise<SurrealJournal> {
    const journal = new SurrealJournal(db);
    const rows = await journal.query<Array<{ version: number }>>('SELECT version FROM maple_schema:operational_v1;', {});
    if (rows.length !== 1 || rows[0]?.version !== 1) throw new AppError(503, 'JOURNAL_SCHEMA_REQUIRED', 'The reviewed operational database schema must be applied before this adapter can be used.');
    return journal;
  }
  async close() { await this.db.close(); }

  private checkOwner(owner: string) {
    if (!owner || (this.transactionOwner !== undefined && owner !== this.transactionOwner)) throw new Error('Invalid journal owner');
  }
  private async query<T>(sql: string, bindings: Record<string, unknown>): Promise<T> {
    try { return (await this.session.query<[T]>(sql, bindings).retry(false))[0]; }
    catch (error) {
      if (isRetryableConflict(error)) throw new AppError(409, 'JOURNAL_CONFLICT', 'Another request changed the save state. Refresh its status before continuing.');
      throw new AppError(503, 'JOURNAL_UNAVAILABLE', 'The operation journal could not be verified. Check the change status before submitting again.');
    }
  }
  private async rows<T>(table: Table, owner: string, condition = '', bindings: Record<string, unknown> = {}): Promise<T[]> {
    this.checkOwner(owner);
    // table and condition are code constants; all user values are bound parameters.
    const rows = await this.query<Array<{ key: string } & Record<string, unknown>>>(
      'SELECT * FROM maple_' + table + ' WHERE owner = $owner' + condition + ';', { ...bindings, owner });
    return rows.map(({ id: _recordId, key, ...row }) => ({ ...row, id: key }) as T);
  }
  private async row<T>(table: Table, owner: string, key: string): Promise<T | undefined> {
    return (await this.rows<T>(table, owner, ' AND key = $key LIMIT 1', { key }))[0];
  }
  private async create(table: Table, owner: string, key: string, data: Record<string, unknown>) {
    this.checkOwner(owner);
    await this.query('CREATE $record CONTENT $data;', { record: journalRecordId(table, owner, key), data: { ...data, owner, key } });
  }
  private async patch(table: Table, owner: string, key: string, patch: Record<string, unknown>) {
    this.checkOwner(owner);
    await this.query('UPDATE $record MERGE $patch WHERE owner = $owner;', { record: journalRecordId(table, owner, key), patch, owner });
  }
  private async atomic<T>(owner: string, run: (journal: SurrealJournal) => Promise<T>): Promise<T> {
    this.checkOwner(owner);
    if (this.transactionOwner !== undefined) return run(this);
    let tx;
    try { tx = await this.db.beginTransaction(); }
    catch { throw new AppError(503, 'JOURNAL_UNAVAILABLE', 'The database transaction could not start. No AM write was sent.'); }
    const journal = new SurrealJournal(this.db, tx, owner);
    try {
      await journal.query(
        'UPSERT $record SET owner = $owner, key = $owner, revision = revision ?? 0, receipt_json = receipt_json ?? NULL, epoch = (epoch ?? 0) + 1;',
        { record: journalRecordId('heads', owner), owner });
      const result = await run(journal);
      await tx.commit();
      return result;
    } catch (error) {
      try { await tx.cancel(); } catch { /* A missing acknowledgement is not proof of rollback. */ }
      if (error instanceof AppError) throw error;
      if (isRetryableConflict(error)) throw new AppError(409, 'JOURNAL_CONFLICT', 'Another request changed the save state. Refresh its status before continuing.');
      throw new AppError(503, 'JOURNAL_UNAVAILABLE', 'The database transaction outcome could not be verified. Check the change status before submitting again.');
    }
  }
  async head(owner: string): Promise<Head> {
    const row = await this.row<{ revision: number; receipt_json: string | null }>('heads', owner, owner);
    return row ? { revision: row.revision, receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null } : { revision: 0, receipt: null };
  }
  async active(owner: string): Promise<boolean> {
    return (await this.rows('operations', owner, " AND status IN ['applying', 'uncertain'] LIMIT 1")).length > 0;
  }
  async get(owner: string, id: string): Promise<Operation> {
    const row = await this.row<Row>('operations', owner, id);
    if (!row) throw notFound('PROPOSAL_NOT_FOUND', 'This change was not found.');
    const result: Operation = { id: row.id, ownerId: owner, proposalRevision: 1, baseRevision: row.base_revision, status: row.status,
      oldValue: row.old_json ? JSON.parse(row.old_json) : null, newValue: row.new_json ? JSON.parse(row.new_json) : null,
      createdAt: row.created_at, confirmedAt: row.confirmed_at, previousFactId: row.previous_fact_id,
      receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null };
    if (result.status === 'pending') {
      const chat = (await this.rows<ChatPreviewRecord>('chat_previews', owner,
        " AND proposal_id = $proposal AND status = 'proposed' AND utterance != NULL LIMIT 1", { proposal: id }))[0];
      if (chat?.utterance) {
        result.chat = { utterance: chat.utterance, expiresAt: chat.expires_at,
          periodSource: weeklyPeriodWasStated(chat.utterance, result.newValue?.hoursPerWeek ?? null) ? 'message' : 'interpretation' };
        const answer = await this.row<ClarificationRow>('chat_clarifications', owner, chat.id);
        if (answer?.answer === 'actual_weekly_work') result.chat.clarificationAnswer = 'actual_weekly_work';
        if (answer?.answer === 'actual_weekly_work' && answer.issue === 'field') result.chat.clarificationSource = 'user_entered';
      }
    }
    return result;
  }
  async list(owner: string): Promise<Operation[]> {
    const groups = await Promise.all([
      this.rows<Row>('operations', owner, " AND status IN ['applying','uncertain'] ORDER BY created_at DESC LIMIT 100"),
      this.rows<Row>('operations', owner, " AND status = 'pending' ORDER BY created_at DESC LIMIT 100"),
      this.rows<Row>('operations', owner, " AND status NOT IN ['applying','uncertain','pending'] ORDER BY created_at DESC LIMIT 100"),
    ]);
    const rows = groups.flat();
    const rank = (status: OperationStatus) => ['applying', 'uncertain'].includes(status) ? 0 : status === 'pending' ? 1 : 2;
    rows.sort((a, b) => rank(a.status) - rank(b.status) || b.created_at.localeCompare(a.created_at));
    return Promise.all(rows.slice(0, 100).map(row => this.get(owner, row.id)));
  }
  async propose(owner: string, baseRevision: number, oldValue: Employment | null, newValue: Employment,
    now: string): Promise<Operation> {
    return this.atomic(owner, async j => {
      if (await j.active(owner)) throw blocked();
      const head = await j.head(owner);
      if (head.revision !== baseRevision) throw stale();
      const id = randomUUID();
      await j.create('operations', owner, id, { base_revision: baseRevision, status: 'pending',
        old_json: oldValue ? JSON.stringify(oldValue) : null, new_json: JSON.stringify(newValue), created_at: now,
        confirmed_at: null, previous_fact_id: head.receipt?.factId ?? null, receipt_json: null });
      return j.get(owner, id);
    });
  }
  async claim(owner: string, id: string, now: string | (() => string)): Promise<Operation> {
    return this.atomic(owner, async j => {
      const op = await j.get(owner, id);
      if (op.status === 'committed') return op;
      if (op.status !== 'pending') throw new AppError(409, 'PROPOSAL_NOT_PENDING', 'This change is no longer awaiting confirmation.');
      if (await j.active(owner)) throw blocked();
      if ((await j.head(owner)).revision !== op.baseRevision) throw stale();
      // Runtime uses DB time at the claim statement, not a timestamp sampled
      // before network awaits. The supplied clock remains proposal provenance.
      const claimedAt = typeof now === 'function' ? now() : now;
      const result = await j.query<Array<{ key: string }>>(
        "UPDATE $record SET status = 'applying', confirmed_at = $claimedAt WHERE owner = $owner AND status = 'pending' AND array::len((SELECT key FROM maple_chat_previews WHERE owner = $owner AND proposal_id = $key AND (<datetime>expires_at <= time::now() OR expires_at <= $claimedAt))) = 0 RETURN AFTER;",
        { record: journalRecordId('operations', owner, id), owner, key: id, claimedAt });
      if (!result.length) throw expired();
      return j.get(owner, id);
    });
  }
  async uncertain(owner: string, id: string) {
    await this.atomic(owner, async j => {
      const op = await j.get(owner, id);
      if (op.status === 'applying') await j.patch('operations', owner, id, { status: 'uncertain' });
    });
  }
  async releaseUnsent(owner: string, id: string) {
    await this.atomic(owner, async j => {
      const op = await j.get(owner, id);
      if (['applying', 'uncertain'].includes(op.status)) await j.patch('operations', owner, id, { status: 'pending', confirmed_at: null });
    });
  }
  async complete(owner: string, id: string, receipt: Receipt, now: string): Promise<Operation> {
    return this.atomic(owner, async j => {
      const op = await j.get(owner, id);
      if (op.status === 'committed') {
        if (JSON.stringify(op.receipt) !== JSON.stringify(receipt)) throw new AppError(409, 'RECEIPT_CONFLICT', 'The save receipt needs review.');
        return op;
      }
      if (!['applying', 'uncertain'].includes(op.status) || (await j.head(owner)).revision !== op.baseRevision) throw new AppError(409, 'RECEIPT_CONFLICT', 'The save state needs review.');
      await j.patch('heads', owner, owner, { revision: op.baseRevision + 1, receipt_json: JSON.stringify(receipt) });
      await j.patch('operations', owner, id, { status: 'committed', receipt_json: JSON.stringify(receipt), old_json: null, new_json: null });
      await j.query("UPDATE maple_operations SET status = 'stale', old_json = NULL, new_json = NULL WHERE owner = $owner AND status = 'pending' AND base_revision <= $revision;",
        { owner, revision: op.baseRevision });
      await j.clearSettledChat(owner);
      // Deterministic notification record identity deduplicates retries/reconciliation.
      await j.create('notifications', owner, id, { notification_id: randomUUID(), operation_id: id, revision: op.baseRevision + 1, created_at: now });
      return j.get(owner, id);
    });
  }
  async reject(owner: string, id: string): Promise<Operation> {
    return this.atomic(owner, async j => {
      const op = await j.get(owner, id);
      if (op.status !== 'pending') throw new AppError(409, 'PROPOSAL_NOT_PENDING', 'This change can no longer be rejected.');
      await j.patch('operations', owner, id, { status: 'rejected', old_json: null, new_json: null });
      await j.clearSettledChat(owner);
      return j.get(owner, id);
    });
  }
  private async clearSettledChat(owner: string) {
    await this.query("UPDATE maple_chat_previews SET utterance = NULL, status = 'settled' WHERE owner = $owner AND proposal_id IN (SELECT VALUE key FROM maple_operations WHERE owner = $owner AND status IN ['committed','rejected','stale']);", { owner });
  }
  async expireChat(owner: string, now: string) {
    // Ordinary reads must not create/touch the owner guard when nothing expires.
    const due = await this.rows('chat_previews', owner, ' AND expires_at <= $now LIMIT 1', { now });
    if (!due.length) return;
    await this.atomic(owner, async j => {
      const expiredIds = await j.query<string[]>('SELECT VALUE key FROM maple_chat_previews WHERE owner = $owner AND expires_at <= $now;', { owner, now });
      if (!expiredIds.length) return;
      await j.query('UPDATE maple_chat_clarifications SET hours = NULL WHERE owner = $owner AND key IN $expiredIds;', { owner, expiredIds });
      await j.query('UPDATE maple_chat_diagnostics SET evidence_json = NULL WHERE owner = $owner AND key IN $expiredIds;', { owner, expiredIds });
      await j.query("UPDATE maple_operations SET status = 'stale', old_json = NULL, new_json = NULL WHERE owner = $owner AND status = 'pending' AND key IN (SELECT VALUE proposal_id FROM maple_chat_previews WHERE owner = $owner AND key IN $expiredIds);", { owner, expiredIds });
      await j.clearSettledChat(owner);
      await j.query("UPDATE maple_chat_previews SET utterance = NULL, status = IF status IN ['blocked','uncertain'] { status } ELSE { 'expired' } WHERE owner = $owner AND key IN $expiredIds AND utterance != NULL;", { owner, expiredIds });
    });
  }
  async chatPreview(owner: string, id: string): Promise<ChatPreviewRecord> {
    const row = await this.row<ChatPreviewRecord>('chat_previews', owner, id);
    if (!row) throw notFound('CHAT_NOT_FOUND', 'This chat request was not found.');
    return row;
  }
  async notifications(owner: string) {
    const saved = await this.rows<NotificationRow & { notification_id: string }>('notifications', owner, ' ORDER BY created_at DESC LIMIT 100');
    const assessed = await this.rows<NotificationRow & { notification_id: string }>('assessment_notifications', owner, ' ORDER BY created_at DESC LIMIT 100');
    return [
      ...saved.map(row => ({ id: row.notification_id, operationId: row.operation_id!, assessmentId: null, revision: row.revision, createdAt: row.created_at, kind: 'saved' })),
      ...assessed.map(row => ({ id: row.notification_id, operationId: null, assessmentId: row.assessment_id!, revision: row.revision, createdAt: row.created_at, kind: 'assessed' })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  }
  async saveAssessment(owner: string, record: AssessmentRecord): Promise<AssessmentRecord> {
    return this.atomic(owner, async j => {
      const head = await j.head(owner);
      if (record.ownerId !== owner || await j.active(owner) || head.revision !== record.profileRevision
        || JSON.stringify(head.receipt) !== JSON.stringify(record.evidence)) throw stale();
      const existing = (await j.rows<AssessmentRow>('assessments', owner,
        ' AND profile_revision = $revision AND policy_digest = $digest AND assessment_date = $date LIMIT 1',
        { revision: record.profileRevision, digest: record.policy.digest, date: record.assessmentDate }))[0];
      if (existing) return JSON.parse(existing.result_json);
      await j.create('assessments', owner, record.id, { profile_revision: record.profileRevision, policy_digest: record.policy.digest,
        assessment_date: record.assessmentDate, created_at: record.createdAt, result_json: JSON.stringify(record) });
      await j.create('assessment_notifications', owner, record.id, { notification_id: randomUUID(),
        assessment_id: record.id, revision: record.profileRevision, created_at: record.createdAt });
      return record;
    });
  }
  async assessment(owner: string, id: string): Promise<AssessmentRecord> {
    const row = await this.row<AssessmentRow>('assessments', owner, id);
    if (!row) throw notFound('ASSESSMENT_NOT_FOUND', 'This assessment was not found.');
    return JSON.parse(row.result_json);
  }
  async assessments(owner: string): Promise<AssessmentRecord[]> {
    const rows = await this.rows<AssessmentRow>('assessments', owner, ' ORDER BY created_at DESC LIMIT 100');
    return rows.map(row => JSON.parse(row.result_json));
  }
}
