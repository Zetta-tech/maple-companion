import { describe, expect, it } from 'vitest';
import { legacyTables, prepareLegacyMigration, type LegacySnapshot } from '../server/legacy-migration.js';

function snapshot(): LegacySnapshot {
  const tables: LegacySnapshot['tables'] = { heads: [], operations: [], notifications: [], assessments: [],
    assessment_notifications: [], chat_previews: [], chat_diagnostics: [], chat_clarifications: [] };
  const receipt = '{ "digest": "old-digest", "factId": "old-fact" }';
  tables.heads.push({ owner: 'user_Synthetic', revision: 6, receipt_json: receipt });
  tables.operations.push({ id: 'synthetic-operation', owner: 'user_Synthetic', base_revision: 5, status: 'committed',
    old_json: null, new_json: null, created_at: '2026-10-24T20:00:00.000Z', confirmed_at: '2026-10-24T20:01:00.000Z',
    previous_fact_id: 'previous-fact', receipt_json: receipt });
  tables.notifications.push({ id: 'original-notification', owner: 'user_Synthetic', operation_id: 'synthetic-operation', revision: 6, created_at: '2026-10-24T20:01:00.000Z' });
  return { version: 1, tables };
}
describe('non-destructive migration planning', () => {
  it('preserves original receipt bytes, revision, notification identity and source', () => {
    const source = snapshot();
    const before = structuredClone(source);
    const plan = prepareLegacyMigration(source);
    expect(plan.manifest.ownerCount).toBe(1);
    expect(plan.manifest.counts.notifications).toBe(1);
    expect(plan.records.find(row => row.table === 'heads')?.content).toMatchObject({ revision: 6, receipt_json: source.tables.heads[0]!.receipt_json });
    expect(plan.records.find(row => row.table === 'notifications')?.content).toMatchObject({
      key: 'synthetic-operation', notification_id: 'original-notification',
    });
    expect(source).toEqual(before);
  });
  it('produces a stable manifest regardless of source field order and detects changed receipt bytes', () => {
    const source = snapshot();
    const reordered = structuredClone(source);
    reordered.tables.heads = reordered.tables.heads.map(row => Object.fromEntries(Object.entries(row).reverse()));
    expect(prepareLegacyMigration(reordered).manifest.sha256).toBe(prepareLegacyMigration(source).manifest.sha256);
    reordered.tables.heads[0]!.receipt_json = JSON.stringify(JSON.parse(String(reordered.tables.heads[0]!.receipt_json)));
    expect(prepareLegacyMigration(reordered).manifest.sha256).not.toBe(prepareLegacyMigration(source).manifest.sha256);
  });
  it('rejects duplicate target notification keys instead of dropping history', () => {
    const source = snapshot();
    source.tables.notifications.push({ ...source.tables.notifications[0]!, id: 'different-notification' });
    expect(() => prepareLegacyMigration(source)).toThrow('Duplicate');
  });
});
