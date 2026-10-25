import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RecordId, type Surreal } from 'surrealdb';
import { connectOperationalDatabase, loadDatabaseConfig } from '../server/operational-db.js';

// No skips, SQLite, fake transport, development credentials, automatic retries
// or cleanup. Invoke explicitly only for the authorized dedicated test database.
const config = loadDatabaseConfig('test');
const runId = randomUUID();
const probe = new RecordId('maple_transaction_probe', runId);
let db: Surreal;
beforeAll(async () => { db = await connectOperationalDatabase(config); });
afterAll(async () => { if (db) await db.close(); });

describe('real SurrealDB transaction semantics', () => {
  it('commits a synthetic fixture, rolls back CANCEL/THROW batches, and retains the original row', async () => {
    await db.query('BEGIN; CREATE $probe CONTENT { marker: $marker, value: 1 }; COMMIT;', {
      probe, marker: 'SYNTHETIC DATABASE INTEGRATION TEST — ' + runId,
    });
    const read = async () => (await db.query<[Array<{ value: number }>]>(
      'SELECT `value` FROM $probe;', { probe }))[0];
    expect(await read()).toEqual([{ value: 1 }]);
    // Every statement in a cancelled transaction may report failure; do not
    // mistake the absence of a thrown client error for successful rollback.
    await db.query('BEGIN; UPDATE $probe SET value = 2; CANCEL;', { probe }).responses();
    expect(await read()).toEqual([{ value: 1 }]);
    const failed = await db.query('BEGIN; UPDATE $probe SET value = 3; IF true { THROW "SYNTHETIC_ROLLBACK"; }; COMMIT;', { probe }).responses();
    expect(failed.some(response => !response.success)).toBe(true);
    expect(await read()).toEqual([{ value: 1 }]);
    // Intentionally retained; deletion needs a separately approved cleanup.
    console.info('Retained synthetic database probe run:', runId);
  });
});
