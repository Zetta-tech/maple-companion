import { RecordId, type Surreal, type SurrealTransaction } from 'surrealdb';
import { legacyTables, prepareLegacyMigration, type LegacyRow, type LegacySnapshot } from './legacy-migration.js';
import { journalRecordId } from './surreal-journal.js';
import { MigrationError, validateLegacyMigration } from './migration-validation.js';
import type { PreparedMigration } from './migration-backup.js';

export type MigrationMarker = { source_digest: string; record_count: number; owner_count: number; counts_json: string; committed_at: string };
type Plan = ReturnType<typeof prepareLegacyMigration>;
/** Implementations other than the SDK target exist only in isolated control-flow tests. */
export interface MigrationTransaction {
  scope(): Promise<{ namespace: string; database: string; schemaVersion: number; migrationSchemaVersion: number }>;
  marker(): Promise<MigrationMarker | null>;
  snapshot(): Promise<LegacySnapshot>;
  create(record: Plan['records'][number]): Promise<void>;
  mark(marker: MigrationMarker): Promise<void>;
  commit(): Promise<void>;
  cancel(): Promise<void>;
}
export interface MigrationTarget { begin(): Promise<MigrationTransaction> }

function verifyScope(scope: Awaited<ReturnType<MigrationTransaction['scope']>>) {
  if (scope.namespace !== 'maple' || scope.database !== 'development' || scope.schemaVersion !== 1
    || scope.migrationSchemaVersion !== 1) throw new MigrationError('MIGRATION_TARGET_REJECTED');
}
function verifyCopied(prepared: PreparedMigration, target: LegacySnapshot) {
  const copied = validateLegacyMigration(target, prepared.approvedOwners);
  if (copied.manifest.sha256 !== prepared.plan.manifest.sha256
    || copied.recordCount !== prepared.plan.recordCount
    || copied.receiptStringCount !== prepared.plan.receiptStringCount) throw new MigrationError('MIGRATION_TARGET_CHANGED');
}
function verifyMarker(prepared: PreparedMigration, marker: MigrationMarker) {
  if (marker.source_digest !== prepared.plan.manifest.sha256
    || marker.record_count !== prepared.plan.recordCount
    || marker.owner_count !== prepared.plan.manifest.ownerCount
    || marker.counts_json !== JSON.stringify(prepared.plan.manifest.counts)) throw new MigrationError('MIGRATION_MARKER_CONFLICT');
}

/** Read-only inspection for retry/uncertain-outcome handling. Never imports or clears records. */
export async function verifyCommittedMigration(prepared: PreparedMigration, target: MigrationTarget) {
  const tx = await target.begin();
  try {
    verifyScope(await tx.scope());
    const marker = await tx.marker();
    if (!marker) throw new MigrationError('MIGRATION_NOT_CONFIRMED');
    verifyMarker(prepared, marker);
    verifyCopied(prepared, await tx.snapshot());
    return { status: 'verified' as const, manifest: prepared.plan.manifest, receiptStringCount: prepared.plan.receiptStringCount };
  } finally { await tx.cancel(); }
}

/**
 * All records and marker commit together. Caller must have paused legacy writers.
 * No AM operations, schema changes, credentials, deletion or runtime switch here.
 */
export async function executeLegacyMigration(prepared: PreparedMigration, target: MigrationTarget, mode: 'rehearse' | 'commit') {
  if (mode !== 'rehearse' && mode !== 'commit') throw new MigrationError('INVALID_MIGRATION_MODE');
  prepared.assertSourceUnchanged();
  const tx = await target.begin();
  let commitSent = false;
  let cancelled = false;
  try {
    verifyScope(await tx.scope());
    const marker = await tx.marker();
    const existing = await tx.snapshot();
    if (marker) {
      verifyMarker(prepared, marker);
      verifyCopied(prepared, existing);
      await tx.cancel(); cancelled = true;
      return { status: 'already_verified' as const, manifest: prepared.plan.manifest, receiptStringCount: prepared.plan.receiptStringCount };
    }
    if (legacyTables.some(table => existing.tables[table].length !== 0)) throw new MigrationError('MIGRATION_TARGET_NOT_EMPTY');
    // Snapshot is a separate copy of the source; validate again before binding any rows.
    const plan = validateLegacyMigration(prepared.snapshot, prepared.approvedOwners);
    if (plan.manifest.sha256 !== prepared.plan.manifest.sha256) throw new MigrationError('PREPARED_SOURCE_CHANGED');
    for (const record of plan.records) await tx.create(record);
    verifyCopied(prepared, await tx.snapshot());
    await tx.mark({ source_digest: plan.manifest.sha256, record_count: plan.recordCount,
      owner_count: plan.manifest.ownerCount, counts_json: JSON.stringify(plan.manifest.counts), committed_at: new Date().toISOString() });
    prepared.assertSourceUnchanged();
    if (mode === 'rehearse') {
      await tx.cancel(); cancelled = true;
      const check = await target.begin();
      try {
        verifyScope(await check.scope());
        if (await check.marker()) throw new MigrationError('MIGRATION_REHEARSAL_NOT_EMPTY');
        const after = await check.snapshot();
        if (legacyTables.some(table => after.tables[table].length !== 0)) throw new MigrationError('MIGRATION_REHEARSAL_NOT_EMPTY');
      } finally { await check.cancel(); }
      return { status: 'rehearsed_and_rolled_back' as const, manifest: prepared.plan.manifest, receiptStringCount: prepared.plan.receiptStringCount };
    }
    commitSent = true;
    await tx.commit();
  } catch (error) {
    if (!cancelled) { try { await tx.cancel(); } catch { /* Never interpret this as proof a sent commit rolled back. */ } }
    if (commitSent) throw new MigrationError('MIGRATION_COMMIT_UNCERTAIN');
    throw error instanceof MigrationError ? error : new MigrationError('MIGRATION_COPY_FAILED');
  }
  // Fresh transaction proves readback after COMMIT, not just within its own writes.
  try {
    const result = await verifyCommittedMigration(prepared, target);
    return { ...result, status: 'copied_and_verified' as const };
  } catch { throw new MigrationError('MIGRATION_COMMITTED_VERIFICATION_PENDING'); }
}

/** Official SDK implementation. No connection/provisioning occurs in this constructor. */
export class SurrealMigrationTarget implements MigrationTarget {
  constructor(private readonly db: Surreal) {}
  async begin(): Promise<MigrationTransaction> {
    return new SurrealMigrationTransaction(await this.db.beginTransaction());
  }
}
class SurrealMigrationTransaction implements MigrationTransaction {
  constructor(private readonly tx: SurrealTransaction) {}
  private async query<T>(text: string, bindings: Record<string, unknown> = {}): Promise<T> {
    try { return (await this.tx.query<[T]>(text, bindings).retry(false))[0]; }
    catch { throw new MigrationError('MIGRATION_DATABASE_REQUEST_FAILED'); }
  }
  async scope() {
    const scopes = await this.query<Array<{ namespace: string; database: string }>>('SELECT * FROM [{ namespace: session::ns(), database: session::db() }];');
    const scope = scopes[0];
    if (!scope) throw new MigrationError('MIGRATION_TARGET_REJECTED');
    const rows = await this.query<{ version: number }[]>('SELECT version FROM maple_schema:operational_v1;');
    const migration = await this.query<{ version: number }[]>('SELECT version FROM maple_schema:migration_v1;');
    return { ...scope, schemaVersion: rows[0]?.version ?? 0, migrationSchemaVersion: migration[0]?.version ?? 0 };
  }
  async marker(): Promise<MigrationMarker | null> {
    const rows = await this.query<Array<MigrationMarker & { id?: unknown }>>('SELECT * FROM maple_migrations:legacy_sqlite_v1;');
    if (rows.length > 1) throw new MigrationError('MIGRATION_MARKER_CONFLICT');
    if (!rows[0]) return null;
    const { id: _id, ...marker } = rows[0];
    return marker;
  }
  async snapshot(): Promise<LegacySnapshot> {
    const tables: LegacySnapshot['tables'] = { heads: [], operations: [], notifications: [], assessments: [],
      assessment_notifications: [], chat_previews: [], chat_diagnostics: [], chat_clarifications: [] };
    for (const table of legacyTables) {
      const rows = await this.query<Array<Record<string, unknown>>>('SELECT * FROM maple_' + table + ';');
      tables[table] = rows.map(row => {
        const { id, key, ...content } = row;
        if (typeof content.owner !== 'string' || typeof key !== 'string' || !(id instanceof RecordId)
          || id.toString() !== journalRecordId(table, content.owner, key).toString()) throw new MigrationError('INVALID_TARGET_RECORD_ID');
        if (table === 'heads') {
          if (key !== content.owner) throw new MigrationError('INVALID_TARGET_RECORD_ID');
          delete content.epoch;
        } else if (table === 'notifications' || table === 'assessment_notifications') {
          if (key !== content[table === 'notifications' ? 'operation_id' : 'assessment_id']) throw new MigrationError('INVALID_TARGET_RECORD_ID');
          content.id = content.notification_id;
          delete content.notification_id;
        } else content.id = key;
        return content as LegacyRow;
      });
    }
    return { version: 1, tables };
  }
  async create(record: Plan['records'][number]) {
    await this.query('CREATE $record CONTENT $content;', { record: record.record, content: record.content });
  }
  async mark(marker: MigrationMarker) {
    await this.query('CREATE maple_migrations:legacy_sqlite_v1 CONTENT $marker;', { marker });
  }
  async commit() { await this.tx.commit(); }
  async cancel() { await this.tx.cancel(); }
}
