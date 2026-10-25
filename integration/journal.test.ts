import { randomUUID, createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Surreal } from 'surrealdb';
import { connectOperationalDatabase, loadDatabaseConfig } from '../server/operational-db.js';
import { SurrealJournal } from '../server/surreal-journal.js';
import { envelopeFor } from '../server/journal.js';
import { Workflow } from '../server/workflow.js';
import { Assessments } from '../server/assessments.js';
import { registryFor, makeTestPolicy } from '../tests/support/test-policy.js';
import { TestMemory } from '../tests/support/test-memory.js';
import type { Binding } from '../server/am.js';
import type { Employment } from '../shared/employment.js';

const config = loadDatabaseConfig('test');
const runId = randomUUID().replaceAll('-', '');
const owner = (label: string) => 'user_dbtest' + runId + label;
const now = () => new Date().toISOString();
const employment: Employment = {
  employer: 'SYNTHETIC DATABASE INTEGRATION TEST - ' + runId, title: 'Synthetic developer', duties: 'Synthetic test duties only.',
  startDate: '2020-01-01', currentJob: true, endDate: null, hoursPerWeek: 38, countryCode: 'CA',
  paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false,
};
const binding = (ownerId: string): Binding => ({ ownerId, context: 'synthetic-' + ownerId,
  endpoint: 'https://memory.example.test', readKey: 'test-only', writeKey: 'test-only' });
let connections: Surreal[] = [];
let journal: SurrealJournal;
let second: SurrealJournal;
beforeAll(async () => {
  // Schema setup is separately approved/applied. Tests never provision credentials
  // or silently fall back to SQLite. The two handles are real DB connections.
  const first = await connectOperationalDatabase(config);
  connections.push(first);
  const next = await connectOperationalDatabase(config);
  connections.push(next);
  journal = await SurrealJournal.open(first);
  second = await SurrealJournal.open(next);
});
afterAll(async () => {
  vi.restoreAllMocks();
  await Promise.all(connections.map(db => db.close()));
  console.info('Retained synthetic journal integration run:', runId);
});

describe('SurrealDB journal integration (no AM network calls)', () => {
  it('binds operations to owners, preserves exact receipts, stales old proposals and deduplicates completion', async () => {
    const alice = owner('Lifecycle'), bob = owner('Foreign');
    const first = await journal.propose(alice, 0, null, employment, now());
    const stale = await journal.propose(alice, 0, null, { ...employment, hoursPerWeek: 40 }, now());
    await expect(second.get(bob, first.id)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' });
    await expect(second.claim(bob, first.id, now)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' });
    const claimed = await journal.claim(alice, first.id, now);
    const receipt = { factId: 'synthetic-' + first.id,
      digest: createHash('sha256').update(JSON.stringify(envelopeFor(claimed))).digest('hex') };
    await journal.complete(alice, first.id, receipt, now());
    await second.complete(alice, first.id, receipt, now());
    expect(await second.head(alice)).toEqual({ revision: 1, receipt });
    expect((await journal.get(alice, stale.id)).status).toBe('stale');
    expect((await journal.get(alice, first.id)).newValue).toBeNull();
    expect(await second.notifications(alice)).toHaveLength(1);
    expect(await second.notifications(bob)).toEqual([]);
    await expect(journal.propose(alice, 0, employment, employment, now())).rejects.toMatchObject({ code: 'STALE_REVISION' });
    await expect(journal.complete(alice, first.id, { ...receipt, digest: 'different' }, now())).rejects.toMatchObject({ code: 'RECEIPT_CONFLICT' });
  });

  it('allows only one concurrent owner claim across independent connections', async () => {
    const alice = owner('Concurrent');
    const a = await journal.propose(alice, 0, null, employment, now());
    const b = await journal.propose(alice, 0, null, employment, now());
    const results = await Promise.allSettled([journal.claim(alice, a.id, now), second.claim(alice, b.id, now)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await journal.list(alice)).filter(op => op.status === 'applying')).toHaveLength(1);
  });

  it('holds expired chat atomically and preserves clarification provenance across connections', async () => {
    const alice = owner('Chat');
    const time = now();
    const request = await journal.beginChat(alice, 0, 'SYNTHETIC: I work 40 hours.', time);
    await journal.recordChatRemote(alice, request, 'https://memory.example.test', 'synthetic-context', 'synthetic-session');
    await journal.askHours(alice, request, 40, 'period', time);
    expect((await second.pendingHoursClarification(alice, time))?.hours).toBe(40);
    const proposal = await journal.propose(alice, 0, null, { ...employment, hoursPerWeek: 40 }, time, request, true);
    expect((await second.get(alice, proposal.id)).chat).toMatchObject({ clarificationAnswer: 'actual_weekly_work', periodSource: 'interpretation' });
    const expired = new Date(Date.parse(time) + 25 * 3600_000).toISOString();
    await expect(second.claim(alice, proposal.id, () => expired)).rejects.toMatchObject({ code: 'CHAT_EXPIRED' });
    expect((await journal.get(alice, proposal.id)).status).toBe('pending');
    await journal.expireChat(alice, expired);
    expect((await second.get(alice, proposal.id)).status).toBe('stale');
    expect((await journal.chatPreview(alice, request)).utterance).toBeNull();
  });

  it('retains a blocked claim after remote success/local completion failure, then reconciles without another AM write', async () => {
    const alice = owner('Recovery');
    const memory = new TestMemory(); // Only AM is simulated; all journal calls use the actual database.
    const workflow = new Workflow(journal, memory, binding);
    const proposal = await workflow.propose(alice, { baseRevision: 0, employment });
    const complete = vi.spyOn(journal, 'complete').mockRejectedValueOnce(new Error('Synthetic database response failure'));
    await expect(workflow.confirm(alice, proposal.id, { proposalRevision: 1 })).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    expect(await second.active(alice)).toBe(true);
    expect(memory.writes).toHaveLength(1);
    complete.mockRestore();
    expect((await workflow.reconcile(alice, proposal.id)).status).toBe('committed');
    expect(memory.writes).toHaveLength(1);
    expect(await second.notifications(alice)).toHaveLength(1);
  });

  it('deduplicates private assessments and withholds stale conclusions after a later revision', async () => {
    const alice = owner('Assessment'), bob = owner('OtherAssessment');
    const memory = new TestMemory();
    const workflow = new Workflow(journal, memory, binding);
    const policy = makeTestPolicy();
    const assessments = new Assessments(journal, workflow, registryFor(policy));
    const proposal = await workflow.propose(alice, { baseRevision: 0, employment });
    await workflow.confirm(alice, proposal.id, { proposalRevision: 1 });
    const first = await assessments.run(alice, { policyId: policy.id });
    expect((await assessments.run(alice, { policyId: policy.id })).id).toBe(first.id);
    expect((await second.notifications(alice)).filter(row => row.kind === 'assessed')).toHaveLength(1);
    await expect(assessments.get(bob, first.id)).rejects.toMatchObject({ code: 'ASSESSMENT_NOT_FOUND' });
    expect(await second.assessments(bob)).toEqual([]);
    const correction = await workflow.propose(alice, { baseRevision: 1, employment: { ...employment, hoursPerWeek: 39 } });
    await workflow.confirm(alice, correction.id, { proposalRevision: 1 });
    expect(await assessments.get(alice, first.id)).toMatchObject({ freshness: 'stale', results: [] });
  });
});
