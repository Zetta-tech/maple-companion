import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { Journal, envelopeFor } from '../server/journal.js';
import { readLegacySnapshot, prepareLegacyMigration, type LegacySnapshot } from '../server/legacy-migration.js';
import { createVerifiedLegacyBackup, prepareVerifiedMigration, resolveMigrationSource } from '../server/migration-backup.js';
import { validateLegacyMigration } from '../server/migration-validation.js';
import { executeLegacyMigration, verifyCommittedMigration, type MigrationTarget, type MigrationMarker } from '../server/migration-executor.js';
import type { Employment } from '../shared/employment.js';

const owner = 'user_MigrationSynthetic';
const other = 'user_MigrationOther';
const employment: Employment = { employer: 'SYNTHETIC MIGRATION TEST ONLY', title: 'Developer', duties: 'Synthetic test duties.',
  startDate: '2020-01-01', currentJob: true, endDate: null, hoursPerWeek: 38, countryCode: 'CA',
  paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
const open: Journal[] = [];
afterEach(() => { for (const journal of open.splice(0)) journal.close(); });
// Synthetic temporary backup fixtures are retained; no existing file is overwritten/deleted.
async function fixture() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'maple-migration-offline-'));
  mkdirSync(join(workspaceRoot, '.local'));
  const sourcePath = join(workspaceRoot, '.local', 'operations.sqlite');
  const journal = new Journal(sourcePath); open.push(journal);
  const now = new Date().toISOString();
  const op = journal.propose(owner, 0, null, employment, now);
  const claimed = journal.claim(owner, op.id, now);
  const receipt = { factId: 'synthetic-fact', digest: createHash('sha256').update(JSON.stringify(envelopeFor(claimed))).digest('hex') };
  journal.complete(owner, op.id, receipt, now);
  const chat = randomUUID();
  const pending = journal.propose(owner, 1, employment, { ...employment, hoursPerWeek: 40 }, now);
  // Existing storage format remains migratable after the old request path is removed.
  journal.db.prepare('INSERT INTO chat_previews VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)').run(chat, owner,
    'SYNTHETIC TEST: I now work 40 hours.', now, new Date(Date.parse(now) + 24 * 3600_000).toISOString(),
    'proposed', 'https://memory.example.test', 'synthetic-context', 'synthetic-session', pending.id);
  journal.db.prepare('INSERT INTO chat_clarifications VALUES (?, ?, NULL, ?, ?, ?)').run(chat, owner, 'period', 'actual_weekly_work', now);
  journal.db.prepare('INSERT INTO chat_diagnostics VALUES (?, ?, ?, NULL, NULL, ?)').run(chat, owner, 'CLARIFICATION_REQUIRED', now);
  const snapshot = readLegacySnapshot(sourcePath);
  const plan = validateLegacyMigration(snapshot, [owner]);
  const options = { workspaceRoot, sourcePath, approvedOwners: [owner], expectedDigest: plan.manifest.sha256 };
  const saved = await createVerifiedLegacyBackup(options);
  const prepared = prepareVerifiedMigration({ ...options, backupPath: saved.backupPath });
  return { workspaceRoot, sourcePath, journal, prepared, saved, snapshot };
}
function empty(): LegacySnapshot {
  return { version: 1, tables: { heads: [], operations: [], notifications: [], assessments: [],
    assessment_notifications: [], chat_previews: [], chat_diagnostics: [], chat_clarifications: [] } };
}

/** Control-flow simulation only. It is not evidence of database transaction semantics. */
function target() {
  const state = { snapshot: empty(), marker: null as MigrationMarker | null, creates: 0, commits: 0, cancels: 0,
    failCreateAt: 0, loseCommitResponse: false, scope: { namespace: 'maple', database: 'development', schemaVersion: 1, migrationSchemaVersion: 1 } };
  const adapter: MigrationTarget = { async begin() {
    let staged = structuredClone(state.snapshot);
    let marker = structuredClone(state.marker);
    return {
      async scope() { return state.scope; },
      async marker() { return marker; },
      async snapshot() { return structuredClone(staged); },
      async create(record) {
        state.creates++;
        if (state.failCreateAt && state.creates === state.failCreateAt) throw new Error('Synthetic copy interruption');
        const { key, epoch: _epoch, notification_id, ...data } = record.content as Record<string, string | number | null>;
        if (typeof key !== 'string') throw new Error('Invalid synthetic key');
        const row = record.table === 'heads' ? data : { ...data, id: notification_id ?? key };
        staged.tables[record.table].push(row);
      },
      async mark(value) { if (marker) throw new Error('Duplicate marker'); marker = value; },
      async commit() {
        state.commits++;
        state.snapshot = structuredClone(staged); state.marker = marker;
        if (state.loseCommitResponse) throw new Error('Synthetic response lost');
      },
      async cancel() { state.cancels++; staged = empty(); },
    };
  } };
  return { state, adapter };
}

describe('offline migration executor and backup checks', () => {
  it('takes a consistent WAL-aware backup, preserves receipt bytes and pending chat, and never overwrites a backup', async () => {
    const f = await fixture();
    expect(prepareLegacyMigration(readLegacySnapshot(f.saved.backupPath)).manifest).toEqual(f.prepared.plan.manifest);
    expect(f.prepared.snapshot).toEqual(f.snapshot);
    expect(f.prepared.plan.receiptStringCount).toBe(2);
    expect(f.prepared.snapshot.tables.operations.some(op => op.status === 'pending' && op.new_json !== null)).toBe(true);
    const another = await createVerifiedLegacyBackup({ workspaceRoot: f.workspaceRoot, sourcePath: f.sourcePath,
      approvedOwners: [owner], expectedDigest: f.prepared.plan.manifest.sha256 });
    expect(another.backupPath).not.toBe(f.saved.backupPath);
    expect(readLegacySnapshot(f.saved.backupPath)).toEqual(f.snapshot);
  });
  it('copies and verifies every record, then an identical replay performs no writes', async () => {
    const { prepared } = await fixture();
    const t = target();
    expect((await executeLegacyMigration(prepared, t.adapter, 'commit')).status).toBe('copied_and_verified');
    expect(t.state.snapshot).toEqual(prepared.snapshot);
    expect(t.state.creates).toBe(prepared.plan.recordCount);
    const creates = t.state.creates;
    expect((await executeLegacyMigration(prepared, t.adapter, 'commit')).status).toBe('already_verified');
    expect(t.state.creates).toBe(creates);
    expect(t.state.commits).toBe(1);
  });
  it('rehearses the complete copy and readback but cancels without committing records or marker', async () => {
    const { prepared } = await fixture();
    const t = target();
    expect((await executeLegacyMigration(prepared, t.adapter, 'rehearse')).status).toBe('rehearsed_and_rolled_back');
    expect(t.state.creates).toBe(prepared.plan.recordCount);
    expect(t.state.commits).toBe(0);
    expect(t.state.snapshot).toEqual(empty());
    expect(t.state.marker).toBeNull();
  });
  it('rejects any nonempty unmarked target before copying', async () => {
    const { prepared } = await fixture();
    const t = target();
    t.state.snapshot.tables.heads.push({ owner, revision: 0, receipt_json: null });
    await expect(executeLegacyMigration(prepared, t.adapter, 'commit')).rejects.toMatchObject({ code: 'MIGRATION_TARGET_NOT_EMPTY' });
    expect(t.state.creates).toBe(0); expect(t.state.commits).toBe(0);
  });
  it('rejects wrong namespace/database and schema before writing', async () => {
    const { prepared } = await fixture();
    for (const scope of [{ namespace: 'other', database: 'development', schemaVersion: 1, migrationSchemaVersion: 1 },
      { namespace: 'maple', database: 'test', schemaVersion: 1, migrationSchemaVersion: 1 },
      { namespace: 'maple', database: 'development', schemaVersion: 0, migrationSchemaVersion: 1 },
      { namespace: 'maple', database: 'development', schemaVersion: 1, migrationSchemaVersion: 0 }]) {
      const t = target(); t.state.scope = scope;
      await expect(executeLegacyMigration(prepared, t.adapter, 'commit')).rejects.toMatchObject({ code: 'MIGRATION_TARGET_REJECTED' });
      expect(t.state.creates).toBe(0);
    }
  });
  it('cancels a pre-commit copy failure and never silently retries it', async () => {
    const { prepared } = await fixture();
    const t = target(); t.state.failCreateAt = 2;
    await expect(executeLegacyMigration(prepared, t.adapter, 'commit')).rejects.toMatchObject({ code: 'MIGRATION_COPY_FAILED' });
    expect(t.state.creates).toBe(2); expect(t.state.commits).toBe(0);
    expect(t.state.snapshot).toEqual(empty()); expect(t.state.marker).toBeNull();
  });
  it('holds a lost commit response and verifies it read-only before replay', async () => {
    const { prepared } = await fixture();
    const t = target(); t.state.loseCommitResponse = true;
    await expect(executeLegacyMigration(prepared, t.adapter, 'commit')).rejects.toMatchObject({ code: 'MIGRATION_COMMIT_UNCERTAIN' });
    const creates = t.state.creates;
    expect((await verifyCommittedMigration(prepared, t.adapter)).status).toBe('verified');
    expect(t.state.creates).toBe(creates); expect(t.state.commits).toBe(1);
  });
  it('refuses a source changed after backup without touching the target', async () => {
    const { prepared, journal } = await fixture();
    const pending = journal.list(owner).find(op => op.status === 'pending')!;
    journal.reject(owner, pending.id);
    const t = target();
    await expect(executeLegacyMigration(prepared, t.adapter, 'commit')).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
    expect(t.state.creates).toBe(0);
  });
  it('refuses changed target receipts on replay, retaining all data', async () => {
    const { prepared } = await fixture();
    const t = target();
    await executeLegacyMigration(prepared, t.adapter, 'commit');
    t.state.snapshot.tables.heads[0]!.receipt_json = '{"factId":"changed","digest":"' + 'a'.repeat(64) + '"}';
    const before = structuredClone(t.state.snapshot);
    await expect(executeLegacyMigration(prepared, t.adapter, 'commit')).rejects.toMatchObject({ code: 'SOURCE_HEAD_RECEIPT_MISMATCH' });
    expect(t.state.snapshot).toEqual(before); expect(t.state.commits).toBe(1);
  });
  it('rejects foreign owners, cross-owner links, unexpected columns and normalized receipt strings', async () => {
    const { snapshot } = await fixture();
    const foreign = structuredClone(snapshot);
    foreign.tables.chat_diagnostics[0]!.owner = other;
    expect(() => validateLegacyMigration(foreign, [owner])).toThrow('UNAPPROVED_SOURCE_OWNER');
    expect(() => validateLegacyMigration(foreign, [owner, other])).toThrow('ORPHAN_SOURCE_CHAT_METADATA');
    const column = structuredClone(snapshot); column.tables.heads[0]!.unexpected = 1;
    expect(() => validateLegacyMigration(column, [owner])).toThrow('INVALID_SOURCE_COLUMNS');
    const bytes = structuredClone(snapshot);
    bytes.tables.heads[0]!.receipt_json = ' ' + bytes.tables.heads[0]!.receipt_json;
    expect(() => validateLegacyMigration(bytes, [owner])).toThrow('SOURCE_HEAD_RECEIPT_MISMATCH');
  });
  it('rejects a source outside the named workspace local directory', async () => {
    const f = await fixture();
    expect(() => resolveMigrationSource(f.workspaceRoot, f.workspaceRoot)).toThrow('SOURCE_PATH_REQUIRES_REVIEW');
  });
});
