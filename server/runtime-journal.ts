import { existsSync } from 'node:fs';
import type { Surreal } from 'surrealdb';
import { connectOperationalDatabase, type DatabaseConfig } from './operational-db.js';
import { SurrealJournal } from './surreal-journal.js';
import { AppError } from './errors.js';
import { readLegacySnapshot } from './legacy-migration.js';
import { validateLegacyMigration } from './migration-validation.js';

/** No SQLite fallback; an existing legacy source requires the matching migration marker. */
export async function openRuntimeJournal(config: DatabaseConfig, legacy?: { path: string; owners: string[] }) {
  if (!['wss:', 'ws:'].includes(new URL(config.endpoint).protocol)) throw new AppError(503, 'DATABASE_WEBSOCKET_REQUIRED', 'The operational journal requires the configured WebSocket endpoint.');
  let sourceDigest: string | undefined;
  if (legacy) {
    if (!existsSync(legacy.path)) throw new AppError(503, 'MIGRATION_SOURCE_REQUIRED', 'The retained legacy journal is unavailable for the migration startup check.');
    const source = validateLegacyMigration(readLegacySnapshot(legacy.path), legacy.owners);
    if (source.recordCount) sourceDigest = source.manifest.sha256;
  }
  const db = await connectOperationalDatabase(config);
  try {
    const journal = await SurrealJournal.open(db);
    if (sourceDigest) await verifyRuntimeMigration(db, sourceDigest);
    return { db, journal };
  } catch (error) { await db.close(); throw error; }
}
export async function verifyRuntimeMigration(db: Pick<Surreal, 'query'>, sourceDigest: string) {
  const [rows] = await db.query<[{ source_digest: string }[]]>('SELECT source_digest FROM maple_migrations:legacy_sqlite_v1;').retry(false);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.source_digest !== sourceDigest) throw new AppError(503, 'MIGRATION_NOT_VERIFIED', 'The existing journal migration has not been verified. The database was not opened as an empty profile.');
}
