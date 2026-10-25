import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { journalRecordId } from './surreal-journal.js';

export const legacyTables = ['heads', 'operations', 'notifications', 'assessments', 'assessment_notifications',
  'chat_previews', 'chat_diagnostics', 'chat_clarifications'] as const;
type Table = typeof legacyTables[number];
export type LegacyRow = Record<string, string | number | null>;
export type LegacySnapshot = { version: 1; tables: Record<Table, LegacyRow[]> };

/** Read-only consistent snapshot; no source PRAGMA changes, checkpoints or exports. */
export function readLegacySnapshot(path: string): LegacySnapshot {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec('BEGIN');
    const tables = Object.fromEntries(legacyTables.map(table => [
      table, db.prepare('SELECT * FROM ' + table + ' ORDER BY owner' + (table === 'heads' ? '' : ', id')).all(),
    ])) as Record<Table, LegacyRow[]>;
    db.exec('COMMIT');
    return { version: 1, tables };
  } finally { db.close(); }
}

/** JSON strings remain byte-for-byte strings; never parse/default/re-encode AM receipts. */
export function prepareLegacyMigration(snapshot: LegacySnapshot) {
  if (snapshot.version !== 1) throw new Error('Unsupported migration snapshot');
  const owners = new Set<string>();
  const records = legacyTables.flatMap(table => {
    const seen = new Set<string>();
    return snapshot.tables[table].map(row => {
      if (typeof row.owner !== 'string' || !row.owner) throw new Error('Invalid source owner');
      owners.add(row.owner);
      const owner = row.owner;
      const sourceId = table === 'heads' ? owner : row.id;
      if (typeof sourceId !== 'string' || !sourceId) throw new Error('Invalid source identifier');
      const key = table === 'notifications' ? row.operation_id : table === 'assessment_notifications' ? row.assessment_id : sourceId;
      if (typeof key !== 'string' || !key || seen.has(JSON.stringify([owner, key]))) throw new Error('Duplicate or invalid migration key');
      seen.add(JSON.stringify([owner, key]));
      const { id: _id, ...fields } = row;
      const content = { ...fields, key,
        ...(table === 'heads' ? { epoch: 0 } : {}),
        ...(['notifications', 'assessment_notifications'].includes(table) ? { notification_id: sourceId } : {}) };
      return { table, record: journalRecordId(table, owner, key), content };
    });
  });
  // Stable digest covers every source field, including old receipt strings,
  // pending payloads, clarification answers and retained diagnostic metadata.
  const canonical = legacyTables.map(table => [table, snapshot.tables[table]
    .map(row => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))
    .sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0)]);
  return {
    manifest: { version: 1 as const, sha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
      ownerCount: owners.size, counts: Object.fromEntries(legacyTables.map(table => [table, snapshot.tables[table].length])) },
    records,
  };
}
// Execution is separate: migration-backup.ts and migration-executor.ts require
// a verified backup, source quiescence and target checks before any copy.
