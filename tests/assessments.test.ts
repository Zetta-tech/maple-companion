import { afterEach, describe, expect, it, vi } from 'vitest';
import { Assessments, assessmentDate } from '../server/assessments.js';
import { AppError } from '../server/errors.js';
import { Journal } from '../server/journal.js';
import { PolicyRegistry, policyDigest } from '../server/policies.js';
import { Workflow } from '../server/workflow.js';
import type { Binding } from '../server/am.js';
import type { Employment } from '../shared/employment.js';
import type { PolicyVersion } from '../shared/policy.js';
import { TestMemory } from './support/test-memory.js';
import { makeTestPolicy, registryFor } from './support/test-policy.js';

const alice = 'user_assessmentAlice';
const bob = 'user_assessmentBob';
const initialTime = '2026-10-24T14:00:00.000Z';
const employment: Employment = {
  employer: 'Private Fixture Employer 72819', title: 'Private Fixture Job 91348',
  duties: 'Private fixture duties 51270: these personal facts must stay in AM.',
  startDate: '2024-12-01', currentJob: true, endDate: null, hoursPerWeek: 37.5,
  countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false,
};
function binding(ownerId: string): Binding {
  if (![alice, bob].includes(ownerId)) throw new AppError(503, 'CONTEXT_NOT_PROVISIONED', 'No test context.');
  return { ownerId, endpoint: `https://${ownerId.toLowerCase().replaceAll('_', '-')}.memory.example.test`, context: `test-${ownerId}`, readKey: `test-read-${ownerId}`, writeKey: `test-write-${ownerId}` };
}
const journals = new Set<Journal>();
function setup(policy = makeTestPolicy()) {
  const journal = new Journal(':memory:');
  journals.add(journal);
  const memory = new TestMemory();
  let now = new Date(initialTime);
  const clock = () => now;
  const workflow = new Workflow(journal, memory, binding, clock);
  const policies = registryFor(policy);
  const assessments = new Assessments(journal, workflow, policies, clock);
  const withRegistry = (registry: PolicyRegistry) => new Assessments(journal, workflow, registry, clock);
  async function commit(owner = alice, value = employment) {
    const proposal = await workflow.propose(owner, { baseRevision: journal.head(owner).revision, employment: value });
    return workflow.confirm(owner, proposal.id, { proposalRevision: 1 });
  }
  return { journal, memory, workflow, assessments, policies, policy, commit, withRegistry,
    setTime: (value: string) => { now = new Date(value); } };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const journal of journals) journal.close();
  journals.clear();
});
function statuses(result: { results: { status: string }[] }) { return result.results.map(criterion => criterion.status); }

describe('private assessments of approved evidence', () => {
  it('runs, lists and reads a private result with the reviewed source and effective date', async () => {
    const { assessments, policy, commit, journal } = setup();
    await commit();
    const result = await assessments.run(alice, { policyId: policy.id });
    expect(result).toMatchObject({ profileRevision: 1, assessmentDate: '2026-10-24', freshness: 'current', policy: {
      id: policy.id, version: policy.version, title: policy.title, program: policy.program,
      digest: policyDigest(policy), sourceUrl: policy.source.url, sourceBodySha256: policy.source.bodySha256,
      effectiveFrom: policy.effectiveFrom, effectiveTo: null,
    } });
    expect(statuses(result)).toEqual(['met', 'met']);
    expect(result).not.toHaveProperty('ownerId');
    expect(result).not.toHaveProperty('evidence');
    expect(await assessments.get(alice, result.id)).toEqual(result);
    expect(await assessments.list(alice)).toEqual([result]);
    expect(journal.notifications(alice)).toContainEqual(expect.objectContaining({ assessmentId: result.id, kind: 'assessed', revision: 1 }));
  });

  it('returns a foreign assessment as 404 before querying AM and never lists another owner’s result', async () => {
    const { assessments, policy, commit, memory } = setup();
    await commit();
    const result = await assessments.run(alice, { policyId: policy.id });
    const priorReads = memory.reads.length;
    await expect(assessments.get(bob, result.id)).rejects.toMatchObject({ status: 404, code: 'ASSESSMENT_NOT_FOUND' });
    await expect(assessments.get(bob, 'absent-assessment-id')).rejects.toMatchObject({ status: 404, code: 'ASSESSMENT_NOT_FOUND' });
    expect(await assessments.list(bob)).toEqual([]);
    expect(memory.reads).toHaveLength(priorReads);
  });

  it('persists derived statuses and provenance without copying raw personal employment facts', async () => {
    const { assessments, policy, commit, journal } = setup();
    await commit();
    const result = await assessments.run(alice, { policyId: policy.id });
    const row = journal.db.prepare('SELECT result_json FROM assessments WHERE id=?').get(result.id) as { result_json: string };
    const stored = JSON.parse(row.result_json);
    expect(stored.results).toEqual([
      { criterionId: 'test-paid', title: 'Synthetic paid-work criterion', status: 'met' },
      { criterionId: 'test-hours', title: 'Synthetic arbitrary-hours criterion', status: 'met' },
    ]);
    expect(stored).not.toHaveProperty('employment');
    for (const personalValue of [employment.employer, employment.title, employment.duties, employment.startDate]) {
      expect(row.result_json).not.toContain(personalValue);
      expect(JSON.stringify(result)).not.toContain(personalValue);
    }
    expect(stored.evidence).toEqual(journal.head(alice).receipt);
  });

  it('deduplicates by owner, evidence revision, policy digest and Toronto day while verifying evidence on every run', async () => {
    const { assessments, policy, commit, journal, memory } = setup();
    await commit();
    const first = await assessments.run(alice, { policyId: policy.id });
    const reads = memory.reads.length;
    const second = await assessments.run(alice, { policyId: policy.id });
    expect(second.id).toBe(first.id);
    expect(memory.reads.length).toBeGreaterThan(reads);
    expect(journal.assessments(alice)).toHaveLength(1);
    expect(journal.notifications(alice).filter(notification => notification.kind === 'assessed')).toHaveLength(1);
    memory.failRead = true;
    await expect(assessments.run(alice, { policyId: policy.id })).rejects.toMatchObject({ code: 'MEMORY_UNAVAILABLE' });
    expect(journal.assessments(alice)).toHaveLength(1);
  });

  it('creates separate private results for two owners with identical employment facts', async () => {
    const { assessments, policy, commit, journal } = setup();
    await commit(alice);
    await commit(bob);
    const first = await assessments.run(alice, { policyId: policy.id });
    const second = await assessments.run(bob, { policyId: policy.id });
    expect(first.id).not.toBe(second.id);
    expect(first.results).toEqual(second.results);
    expect((await assessments.list(alice)).map(result => result.id)).toEqual([first.id]);
    expect((await assessments.list(bob)).map(result => result.id)).toEqual([second.id]);
    expect(journal.notifications(alice).filter(item => item.kind === 'assessed')).toEqual([expect.objectContaining({ assessmentId: first.id })]);
    expect(journal.notifications(bob).filter(item => item.kind === 'assessed')).toEqual([expect.objectContaining({ assessmentId: second.id })]);
  });

  it('does not use a pending employment proposal as assessment evidence', async () => {
    const { assessments, policy, commit, workflow, memory } = setup();
    await commit();
    await workflow.propose(alice, { baseRevision: 1, employment: { ...employment, paid: 'no', hoursPerWeek: 1 } });
    const result = await assessments.run(alice, { policyId: policy.id });
    expect(result.profileRevision).toBe(1);
    expect(statuses(result)).toEqual(['met', 'met']);
    expect(memory.writes).toHaveLength(1);
  });

  it('returns needs information when only an unconfirmed proposal exists', async () => {
    const { assessments, policy, workflow, journal, memory } = setup();
    await workflow.propose(alice, { baseRevision: 0, employment });
    const result = await assessments.run(alice, { policyId: policy.id });
    expect(result.profileRevision).toBe(0);
    expect(statuses(result)).toEqual(['needs_information', 'needs_information']);
    expect(journal.assessment(alice, result.id).evidence).toBeNull();
    expect(memory.writes).toHaveLength(0);
  });

  it('keeps explicit no separate from unknown and not-applicable answers', async () => {
    const first = setup();
    await first.commit(alice, { ...employment, paid: 'no', hoursPerWeek: null });
    expect(statuses(await first.assessments.run(alice, { policyId: first.policy.id }))).toEqual(['not_met', 'needs_information']);
    await first.commit(alice, { ...employment, paid: 'not_applicable', hoursPerWeek: null });
    expect(statuses(await first.assessments.run(alice, { policyId: first.policy.id }))).toEqual(['needs_information', 'needs_information']);
  });
});

describe('assessment freshness and storage uncertainty', () => {
  it('marks prior results unverified during a storage failure and refuses new assessments', async () => {
    const { assessments, policy, commit, memory, journal } = setup();
    await commit();
    const result = await assessments.run(alice, { policyId: policy.id });
    memory.failRead = true;
    await expect(assessments.run(alice, { policyId: policy.id })).rejects.toMatchObject({ code: 'MEMORY_UNAVAILABLE' });
    expect(await assessments.get(alice, result.id)).toMatchObject({ freshness: 'unverified', results: [] });
    expect(await assessments.list(alice)).toEqual([expect.objectContaining({ id: result.id, freshness: 'unverified', results: [] })]);
    expect(journal.assessments(alice)).toHaveLength(1);
  });

  it('does not issue a conclusion while a save has an uncertain remote outcome', async () => {
    const { assessments, policy, commit, memory, workflow, journal } = setup();
    await commit();
    const prior = await assessments.run(alice, { policyId: policy.id });
    const proposal = await workflow.propose(alice, { baseRevision: 1, employment: { ...employment, paid: 'no' } });
    memory.failWrite = 'after';
    await expect(workflow.confirm(alice, proposal.id, { proposalRevision: 1 })).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    await expect(assessments.run(alice, { policyId: policy.id })).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(await assessments.get(alice, prior.id)).toMatchObject({ freshness: 'unverified', results: [] });
    expect(journal.assessments(alice)).toHaveLength(1);
    await workflow.reconcile(alice, proposal.id);
    expect(await assessments.get(alice, prior.id)).toMatchObject({ freshness: 'stale', results: [] });
  });

  it('hides old conclusions after a new committed revision and records a new assessment separately', async () => {
    const { assessments, policy, commit, journal } = setup();
    await commit();
    const previous = await assessments.run(alice, { policyId: policy.id });
    await commit(alice, { ...employment, paid: 'no', hoursPerWeek: 1 });
    expect(await assessments.get(alice, previous.id)).toMatchObject({ profileRevision: 1, freshness: 'stale', results: [] });
    const current = await assessments.run(alice, { policyId: policy.id });
    expect(current.id).not.toBe(previous.id);
    expect(current.profileRevision).toBe(2);
    expect(statuses(current)).toEqual(['not_met', 'not_met']);
    expect(journal.assessments(alice)).toHaveLength(2);
    expect(journal.notifications(alice).filter(item => item.kind === 'assessed')).toHaveLength(2);
  });

  it.each(['removed', 'allowlist-removed', 'version-changed', 'criteria-changed'] as const)('marks a historical conclusion stale when policy is %s', async mode => {
    const { assessments, policy, commit, withRegistry } = setup();
    await commit();
    const previous = await assessments.run(alice, { policyId: policy.id });
    let registry: PolicyRegistry;
    if (mode === 'removed') registry = new PolicyRegistry();
    else if (mode === 'allowlist-removed') registry = new PolicyRegistry([policy], []);
    else {
      const changed: PolicyVersion = mode === 'version-changed'
        ? { ...policy, version: 'test-v2' }
        : { ...policy, criteria: policy.criteria.map(criterion => criterion.kind === 'number_gte' ? { ...criterion, minimum: 99 } : criterion) };
      registry = registryFor(changed);
    }
    const changedService = withRegistry(registry);
    expect(await changedService.get(alice, previous.id)).toMatchObject({ freshness: 'stale', results: [] });
  });

  it('uses Toronto day boundaries and makes yesterday’s result stale without changing employment', async () => {
    const { assessments, policy, commit, setTime } = setup();
    await commit();
    const first = await assessments.run(alice, { policyId: policy.id });
    setTime('2026-10-25T03:59:59.000Z');
    expect(assessmentDate(new Date('2026-10-25T03:59:59.000Z'))).toBe('2026-10-24');
    expect((await assessments.run(alice, { policyId: policy.id })).id).toBe(first.id);
    setTime('2026-10-25T04:00:00.000Z');
    expect(await assessments.get(alice, first.id)).toMatchObject({ freshness: 'stale', results: [] });
    const next = await assessments.run(alice, { policyId: policy.id });
    expect(next.id).not.toBe(first.id);
    expect(next.assessmentDate).toBe('2026-10-25');
  });

  it('refuses to publish yesterday’s conclusion when the AM read crosses midnight in Toronto', async () => {
    const { assessments, policy, commit, setTime, workflow, journal } = setup();
    await commit();
    setTime('2026-10-25T03:59:59.000Z');
    const originalRead = workflow.read.bind(workflow);
    vi.spyOn(workflow, 'read').mockImplementationOnce(async owner => {
      const snapshot = await originalRead(owner);
      setTime('2026-10-25T04:00:01.000Z');
      return snapshot;
    });
    await expect(assessments.run(alice, { policyId: policy.id })).rejects.toMatchObject({ status: 409, code: 'ASSESSMENT_DATE_CHANGED' });
    expect(journal.assessments(alice)).toEqual([]);
    expect(journal.notifications(alice).filter(item => item.kind === 'assessed')).toEqual([]);
  });

  it('refuses to persist a conclusion when another commit wins after evidence read but before the journal transaction', async () => {
    const { assessments, policy, commit, journal, workflow } = setup();
    await commit();
    const competing = await workflow.propose(alice, { baseRevision: 1, employment: { ...employment, hoursPerWeek: 1 } });
    const realSave = journal.saveAssessment.bind(journal);
    vi.spyOn(journal, 'saveAssessment').mockImplementationOnce((owner, record) => {
      // Simulate another verified commit winning between evaluation and persistence.
      journal.claim(owner, competing.id, initialTime);
      journal.complete(owner, competing.id, { factId: 'test-concurrent-fact', digest: 'a'.repeat(64) }, initialTime);
      return realSave(owner, record);
    });
    await expect(assessments.run(alice, { policyId: policy.id })).rejects.toMatchObject({ code: 'STALE_REVISION' });
    expect(journal.assessments(alice)).toEqual([]);
    expect(journal.notifications(alice).filter(item => item.kind === 'assessed')).toEqual([]);
  });

  it('refuses to persist a conclusion when a concurrent commit starts but is not yet confirmed', async () => {
    const { assessments, policy, commit, journal, workflow } = setup();
    await commit();
    const competing = await workflow.propose(alice, { baseRevision: 1, employment: { ...employment, paid: 'no' } });
    const realSave = journal.saveAssessment.bind(journal);
    vi.spyOn(journal, 'saveAssessment').mockImplementationOnce((owner, record) => {
      journal.claim(owner, competing.id, initialTime);
      return realSave(owner, record);
    });
    await expect(assessments.run(alice, { policyId: policy.id })).rejects.toMatchObject({ code: 'STALE_REVISION' });
    expect(journal.assessments(alice)).toEqual([]);
    expect(journal.notifications(alice).filter(item => item.kind === 'assessed')).toEqual([]);
  });
});

describe('request and policy approval boundary', () => {
  it.each([
    { ownerId: bob },
    { facts: employment },
    { employment },
    { assessmentDate: '2026-10-25' },
    { date: '2026-10-25' },
    { results: [{ status: 'met' }] },
    { profileRevision: 500 },
    { context: 'other-user-context' },
  ])('rejects caller-controlled assessment data %j', async injected => {
    const { assessments, policy, journal, memory } = setup();
    await expect(assessments.run(alice, { policyId: policy.id, ...injected })).rejects.toMatchObject({ name: 'ZodError' });
    expect(journal.assessments(alice)).toEqual([]);
    expect(memory.reads).toEqual([]);
    expect(memory.writes).toEqual([]);
  });

  it('exposes no available policies and fails closed when nothing has been manually approved', async () => {
    const { withRegistry, journal, memory, policy } = setup();
    const none = withRegistry(new PolicyRegistry());
    expect(none.available()).toEqual([]);
    await expect(none.run(alice, { policyId: policy.id })).rejects.toMatchObject({ status: 503, code: 'POLICY_UNAVAILABLE' });
    const unapproved = withRegistry(new PolicyRegistry([policy], []));
    expect(unapproved.available()).toEqual([]);
    await expect(unapproved.run(alice, { policyId: policy.id })).rejects.toMatchObject({ code: 'POLICY_UNAVAILABLE' });
    expect(journal.assessments(alice)).toEqual([]);
    expect(memory.reads).toEqual([]);
  });

  it('does not allow a held or future policy to become an assessment merely through its digest allowlist', async () => {
    const held = makeTestPolicy({ review: { status: 'held', reviewerId: 'test-reviewer', reviewedAt: '2026-09-02T12:00:00.000Z' } });
    const future = makeTestPolicy({ effectiveFrom: '2027-01-01' });
    for (const policy of [held, future]) {
      const { assessments, journal } = setup(policy);
      expect(assessments.available()).toEqual([]);
      await expect(assessments.run(alice, { policyId: policy.id })).rejects.toMatchObject({ code: 'POLICY_UNAVAILABLE' });
      expect(journal.assessments(alice)).toEqual([]);
    }
  });
});
