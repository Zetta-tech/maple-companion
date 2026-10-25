import { describe, expect, it, vi } from 'vitest';
import type { Surreal } from 'surrealdb';
import { openRuntimeJournal, verifyRuntimeMigration } from '../server/runtime-journal.js';
function db(rows: { source_digest: string }[]) {
  const query = vi.fn(() => ({ retry: () => Promise.resolve([rows]) }));
  return { client: { query } as unknown as Pick<Surreal, 'query'>, query };
}
describe('runtime migration startup gate (offline)', () => {
  it.each([{ rows: [] }, { rows: [{ source_digest: 'different' }] }])('refuses an unverified migration marker', async ({ rows }) => {
    const fixture = db(rows);
    await expect(verifyRuntimeMigration(fixture.client, 'expected')).rejects.toMatchObject({ code: 'MIGRATION_NOT_VERIFIED' });
    expect(fixture.query).toHaveBeenCalledTimes(1);
  });
  it('accepts only the matching source marker without rewriting any journal data', async () => {
    const fixture = db([{ source_digest: 'expected' }]);
    await verifyRuntimeMigration(fixture.client, 'expected');
    expect(fixture.query).toHaveBeenCalledWith('SELECT source_digest FROM maple_migrations:legacy_sqlite_v1;');
  });
  it('rejects a non-WebSocket journal endpoint before connecting', async () => {
    await expect(openRuntimeJournal({ endpoint: 'https://fixture.example', namespace: 'maple', database: 'development',
      username: 'synthetic', password: 'test-only', environment: 'development' })).rejects.toMatchObject({ code: 'DATABASE_WEBSOCKET_REQUIRED' });
  });
});
