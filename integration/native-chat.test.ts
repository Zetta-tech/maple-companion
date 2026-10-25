import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { connectOperationalDatabase, loadDatabaseConfig } from '../server/operational-db.js';
import { SurrealNativeChatStore } from '../server/native-chat-store.js';
import { SurrealJournal } from '../server/surreal-journal.js';
import { nativeInputsReviewed } from '../server/native-review.js';
import { Assessments } from '../server/assessments.js';
import { Workflow } from '../server/workflow.js';
import { TestMemory } from '../tests/support/test-memory.js';
import { makeTestPolicy, registryFor } from '../tests/support/test-policy.js';
import type { Employment } from '../shared/employment.js';

it('persists owner-private native sessions and replay/concurrency state in real SurrealDB', async () => {
  const db = await connectOperationalDatabase(loadDatabaseConfig('test'));
  const owner = 'user_native' + randomUUID().replaceAll('-', ''), other = owner + 'other';
  const requestId = randomUUID(), now = new Date().toISOString();
  try {
    const store = new SurrealNativeChatStore(db); await store.ready();
    const session = { ownerId: owner, context: 'synthetic_context', principalId: 'synthetic', scope: 'synthetic/conversation', sessionId: randomUUID() };
    await store.save(session);
    expect(await store.load(owner, session.sessionId)).toEqual(session);
    expect(await store.load(other, session.sessionId)).toBeNull();
    expect(await store.current(other)).toBeNull();
    expect(await store.claim(owner, requestId, 'synthetic-digest', now)).toBeNull();
    await expect(store.claim(owner, randomUUID(), 'second', now)).rejects.toMatchObject({ code: 'NATIVE_REQUEST_PENDING' });
    await store.finish(owner, { requestId, createdAt: now, status: 'unverified', message: 'Synthetic unverified fixture', warnings: [] });
    expect((await store.claim(owner, requestId, 'synthetic-digest', now))?.status).toBe('unverified');
    await expect(store.claim(owner, requestId, 'different-digest', now)).rejects.toMatchObject({ code: 'NATIVE_REQUEST_CONFLICT' });
    expect(await store.list(other)).toEqual([]);
    expect(await store.list(owner)).toHaveLength(1);
    const second = new SurrealNativeChatStore(db);
    expect((await second.list(owner))[0]?.status).toBe('unverified');
    const attempts = await Promise.allSettled([
      store.claim(owner, randomUUID(), 'race-a', now), second.claim(owner, randomUUID(), 'race-b', now),
    ]);
    expect(attempts.filter(result => result.status === 'fulfilled' && result.value === null)).toHaveLength(1);
    console.info('Retained synthetic native metadata:', JSON.stringify({ owner, sessions: 1, requests: 2, guards: 1 }));
  } finally { await db.close(); }
});

it('persists the native completion barrier with employment ordering and assessment fences in real SurrealDB', async () => {
  const db = await connectOperationalDatabase(loadDatabaseConfig('test'));
  const owner = 'user_nativeBoundary' + randomUUID().replaceAll('-', ''), at = new Date().toISOString();
  const employment: Employment = { employer: 'SYNTHETIC BOUNDARY TEST', title: 'Synthetic worker', duties: 'Synthetic duties only.',
    startDate: '2020-01-01', currentJob: true, endDate: null, hoursPerWeek: 30,
    countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
  try {
    const store = new SurrealNativeChatStore(db), journal = await SurrealJournal.open(db);
    const workflow = new Workflow(journal, new TestMemory(), ownerId => ({ ownerId, endpoint: 'https://memory.example.test', context: 'synthetic', readKey: 'test', writeKey: 'test' }), () => new Date(at));
    const policy = makeTestPolicy();
    const assessments = new Assessments(journal, workflow, registryFor(policy), () => new Date(at), who => nativeInputsReviewed(who, store, journal));
    const commit = async () => {
      const proposal = await workflow.propose(owner, { baseRevision: (await journal.head(owner)).revision, employment });
      return workflow.confirm(owner, proposal.id, { proposalRevision: 1 });
    };
    const id = randomUUID();
    await store.claim(owner, id, 'synthetic', at);
    await commit(); // Form review occurs DURING native processing.
    await expect(assessments.run(owner, { policyId: policy.id })).rejects.toMatchObject({ code: 'ASSESSMENT_INPUT_REVIEW_REQUIRED' });
    const result = await store.finish(owner, { requestId: id, createdAt: at, status: 'verified', message: 'Synthetic', warnings: [] });
    expect(result.completion).toEqual({ version: 1, employmentRevision: 1 });
    const reloaded = new SurrealNativeChatStore(db);
    expect((await reloaded.list(owner))[0]).toEqual(result);
    await expect(assessments.run(owner, { policyId: policy.id })).rejects.toMatchObject({ code: 'ASSESSMENT_INPUT_REVIEW_REQUIRED' });
    await commit(); // Same wall-clock instant, genuinely later durable confirmation.
    expect((await assessments.run(owner, { policyId: policy.id })).freshness).toBe('current');
    expect(await journal.assessmentFence(owner)).toMatchObject({ revision: 2, active: false });
    expect(await journal.assessmentFence(owner + 'other')).toEqual({ revision: 0, receipt: null, active: false });

    const next = randomUUID(); await store.claim(owner, next, 'next', at);
    const inFlight = await journal.propose(owner, 2, employment, employment, at);
    await journal.claim(owner, inFlight.id, at);
    expect(await journal.assessmentFence(owner)).toMatchObject({ revision: 2, active: true });
    const finished = await store.finish(owner, { requestId: next, createdAt: at, status: 'unverified', message: 'Synthetic', warnings: [] });
    expect(finished.completion).toEqual({ version: 1, employmentRevision: 3 });
    await journal.complete(owner, inFlight.id, { factId: 'synthetic-only', digest: 'a'.repeat(64) }, at);
    expect(await nativeInputsReviewed(owner, reloaded, journal)).toBe(false); // Late completion of earlier consent cannot qualify.
    console.info('Retained synthetic boundary metadata:', JSON.stringify({ owner, requests: 2, operations: 3, assessments: 1 }));
  } finally { await db.close(); }
});
