import { afterEach, describe, expect, it, vi } from 'vitest';
import { Journal } from '../server/journal.js';
import type { JournalStore } from '../server/journal-store.js';
import { Workflow } from '../server/workflow.js';
import { createMemoryPreview } from '../server/am-preview.js';
import { TestMemory } from './support/test-memory.js';
import type { Employment } from '../shared/employment.js';
import { Assessments } from '../server/assessments.js';
import { makeTestPolicy, registryFor } from './support/test-policy.js';

const owner = 'user_AsyncTest';
const binding = { ownerId: owner, endpoint: 'https://memory.example.test', context: 'synthetic',
  readKey: 'test-only', writeKey: 'test-only' };
const employment: Employment = { employer: 'SYNTHETIC ASYNC TEST', title: 'Developer', duties: 'Synthetic duties.',
  startDate: '2020-01-01', currentJob: true, endDate: null, hoursPerWeek: 38,
  countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
const journals: Journal[] = [];
function setup() {
  const source = new Journal(':memory:'); journals.push(source);
  // This is a caller sequencing test, not a SurrealDB acceptance test.
  const overrides = new Map<PropertyKey, unknown>();
  const port = new Proxy(source, { set(_target, key, value) { overrides.set(key, value); return true; }, get(target, key) {
    if (overrides.has(key)) return overrides.get(key);
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? async (...args: unknown[]) => {
      await Promise.resolve();
      return Reflect.apply(value, target, args);
    } : value;
  } }) as unknown as JournalStore;
  const memory = new TestMemory();
  return { source, port, memory, workflow: new Workflow(port, memory, () => binding) };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
afterEach(() => { vi.restoreAllMocks(); journals.splice(0).forEach(j => j.close()); });

describe('asynchronous journal caller safety', () => {
  it('does not send AM writes before the durable claim resolves', async () => {
    const { port, memory, workflow } = setup();
    const proposal = await workflow.propose(owner, { baseRevision: 0, employment });
    const started = deferred(), release = deferred();
    const claim = port.claim.bind(port);
    port.claim = async (...args) => { started.resolve(); await release.promise; return claim(...args); };
    const saving = workflow.confirm(owner, proposal.id, { proposalRevision: 1 });
    await started.promise;
    expect(memory.writes).toHaveLength(0);
    release.resolve();
    expect((await saving).status).toBe('committed');
    expect(memory.writes).toHaveLength(1);
  });

  it('awaits a failed DB completion and retains an uncertain claim after AM success', async () => {
    const { port, source, memory, workflow } = setup();
    const proposal = await workflow.propose(owner, { baseRevision: 0, employment });
    port.complete = async () => { await Promise.resolve(); throw new Error('Synthetic database outage'); };
    await expect(workflow.confirm(owner, proposal.id, { proposalRevision: 1 })).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    expect(source.get(owner, proposal.id).status).toBe('uncertain');
    expect(source.notifications(owner)).toHaveLength(0);
    expect(memory.writes).toHaveLength(1);
    await expect(workflow.confirm(owner, proposal.id, { proposalRevision: 1 })).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(memory.writes).toHaveLength(1);
  });

  it('reports uncertainty when both completion and follow-up journal reads fail', async () => {
    const { port, source, memory, workflow } = setup();
    const proposal = await workflow.propose(owner, { baseRevision: 0, employment });
    const get = port.get.bind(port);
    port.complete = async () => { throw new Error('Synthetic completion outage'); };
    port.get = async (...args) => { if (memory.writes.length) throw new Error('Synthetic read outage'); return get(...args); };
    await expect(workflow.confirm(owner, proposal.id, { proposalRevision: 1 })).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    expect(source.get(owner, proposal.id).status).toBe('applying');
    expect(source.active(owner)).toBe(true);
    expect(memory.writes).toHaveLength(1);
  });

  it('waits for async session bookkeeping before returning preview candidates', async () => {
    const started = deferred(), release = deferred();
    const payload = { mode: 'preview', preview: true, sessionId: 'synthetic-session',
      extraction: { entities: [], attributes: [], relations: [], actions: [], instructions: [], uncertainties: [] } };
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } }));
    let returned = false;
    const result = createMemoryPreview(transport)(binding, 'SYNTHETIC TEST ONLY.', async () => {
      started.resolve(); await release.promise;
    }).then(value => { returned = true; return value; });
    await started.promise;
    expect(returned).toBe(false);
    release.resolve();
    await expect(result).resolves.toMatchObject({ sessionId: 'synthetic-session' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('withholds current assessment conclusions when a database save crosses Toronto midnight', async () => {
    const { port, workflow } = setup();
    const policy = makeTestPolicy();
    let time = new Date('2026-10-25T03:59:59.000Z');
    const assessments = new Assessments(port, workflow, registryFor(policy), () => time);
    const save = port.saveAssessment.bind(port);
    port.saveAssessment = async (...args) => {
      time = new Date('2026-10-25T04:00:01.000Z');
      return save(...args);
    };
    const result = await assessments.run(owner, { policyId: policy.id });
    expect(result).toMatchObject({ assessmentDate: '2026-10-24', freshness: 'stale', results: [] });
  });
});
