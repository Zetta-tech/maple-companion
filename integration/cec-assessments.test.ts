import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { connectOperationalDatabase, loadDatabaseConfig } from '../server/operational-db.js';
import { SurrealJournal } from '../server/surreal-journal.js';
import { Workflow } from '../server/workflow.js';
import { Assessments } from '../server/assessments.js';
import { TestMemory } from '../tests/support/test-memory.js';
import { registryFor } from '../tests/support/test-policy.js';
import { testCecEmployment, testCecPolicy } from '../tests/support/test-cec.js';

// This opt-in test writes only synthetic records to maple/test and retains them.
// It is NOT run by the offline test command. AM alone is a labelled test adapter.
it('persists CEC evidence-derived private results only after confirmation, with staleness and deduplicated notifications', async () => {
  const db = await connectOperationalDatabase(loadDatabaseConfig('test'));
  const run = randomUUID().replaceAll('-', '');
  const owner = 'user_cec_db_' + run, other = 'user_cec_foreign_' + run;
  try {
    const journal = await SurrealJournal.open(db), memory = new TestMemory();
    let now = new Date('2026-10-24T14:00:00Z');
    const workflow = new Workflow(journal, memory, ownerId => ({ ownerId, context: 'synthetic-' + ownerId,
      endpoint: 'https://memory.example.test', readKey: 'test-only', writeKey: 'test-only' }), () => now);
    const policy = testCecPolicy();
    const assessments = new Assessments(journal, workflow, registryFor(policy), () => now);
    const employment = testCecEmployment();
    const { cecWork: _absent, ...legacy } = employment;
    const first = await workflow.propose(owner, { baseRevision: 0, employment: legacy });
    await workflow.confirm(owner, first.id, { proposalRevision: 1 });
    const missing = await assessments.run(owner, { policyId: policy.id });
    expect(missing.results[0]?.status).toBe('needs_information');
    const pending = await workflow.propose(owner, { baseRevision: 1, employment });
    expect((await assessments.run(owner, { policyId: policy.id })).id).toBe(missing.id);
    expect((await workflow.read(owner)).employment).not.toHaveProperty('cecWork');
    await workflow.confirm(owner, pending.id, { proposalRevision: 1 });
    const complete = await assessments.run(owner, { policyId: policy.id });
    expect(complete.results[0]).toMatchObject({ status: 'met', scope: 'recorded_work_interval' });
    expect((await assessments.run(owner, { policyId: policy.id })).id).toBe(complete.id);
    expect((await journal.notifications(owner)).filter(row => row.kind === 'assessed')).toHaveLength(2);
    expect((await assessments.get(owner, missing.id)).results).toEqual([]);
    await expect(assessments.get(other, complete.id)).rejects.toMatchObject({ code: 'ASSESSMENT_NOT_FOUND' });
    expect(await assessments.list(other)).toEqual([]);
    expect(await journal.notifications(other)).toEqual([]);
    expect(JSON.stringify(complete)).not.toContain(employment.employer);
    expect(JSON.stringify(complete)).not.toContain(employment.duties);
    now = new Date('2026-10-25T04:00:00Z');
    expect((await assessments.get(owner, complete.id))).toMatchObject({ freshness: 'stale', results: [] });
    const retained: Record<string, number> = {};
    for (const table of ['heads', 'operations', 'notifications', 'assessments', 'assessment_notifications']) {
      const [rows] = await db.query<[{ total: number }[]]>(`SELECT count() AS total FROM maple_${table} WHERE owner = $owner GROUP ALL;`, { owner }).retry(false);
      retained[table] = rows[0]?.total ?? 0;
    }
    console.info('Retained synthetic CEC records:', JSON.stringify(retained));
  } finally {
    await db.close();
    console.info('Retained synthetic CEC integration run:', run);
  }
});
