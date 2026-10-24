import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve as resolvePath } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorageError, type Binding } from '../server/am.js';
import { AppError } from '../server/errors.js';
import { Journal, envelopeFor } from '../server/journal.js';
import { Workflow } from '../server/workflow.js';
import type { Employment } from '../shared/employment.js';
import { TestMemory } from './support/test-memory.js';

const alice = 'user_alice';
const bob = 'user_bob';
const clockStart = '2026-10-24T14:00:00.000Z';
const employment: Employment = {
  employer: 'Test-only employer', title: 'Developer', duties: 'Write and review application code.',
  startDate: '2024-12-01', currentJob: true, endDate: null, hoursPerWeek: 37.5,
  countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false,
};
const confirmation = { proposalRevision: 1 };
const bindings = new Map<string, Binding>([
  [alice, { ownerId: alice, endpoint: 'https://alice.memory.example.test', context: 'test-alice-context', readKey: 'test-alice-read', writeKey: 'test-alice-write' }],
  [bob, { ownerId: bob, endpoint: 'https://bob.memory.example.test', context: 'test-bob-context', readKey: 'test-bob-read', writeKey: 'test-bob-write' }],
]);
function resolve(owner: string): Binding {
  const binding = bindings.get(owner);
  if (!binding) throw new AppError(503, 'CONTEXT_NOT_PROVISIONED', 'Test context is not configured.');
  return binding;
}
const openJournals = new Set<Journal>();
const tempDirectories = new Set<string>();
function open(path = ':memory:') {
  const journal = new Journal(path);
  openJournals.add(journal);
  return journal;
}
function close(journal: Journal) { journal.close(); openJournals.delete(journal); }
function setup(path = ':memory:') {
  const journal = open(path);
  const memory = new TestMemory();
  let now = new Date(clockStart);
  const workflow = new Workflow(journal, memory, resolve, () => now);
  return { journal, memory, workflow, setTime: (value: string) => { now = new Date(value); } };
}
function pending(workflow: Workflow, owner = alice, value = employment, baseRevision = 0) {
  return workflow.propose(owner, { baseRevision, employment: value });
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const journal of openJournals) journal.close();
  openJournals.clear();
  for (const directory of tempDirectories) {
    const absolute = resolvePath(directory);
    if (dirname(absolute) !== resolvePath(tmpdir()) || !basename(absolute).startsWith('maple-workflow-test-')) {
      throw new Error('Refusing cleanup outside this test’s temporary directory.');
    }
    rmSync(absolute, { recursive: true, force: true });
  }
  tempDirectories.clear();
});

describe('exact proposal and confirmation lifecycle', () => {
  it('keeps an older active recovery operation visible beyond the history limit', async () => {
    const { workflow, journal } = setup();
    const first = await pending(workflow);
    for (let index = 1; index <= 105; index++) {
      journal.propose(alice, 0, null, employment, new Date(Date.parse(clockStart) + index * 1000).toISOString());
    }
    journal.claim(alice, first.id, clockStart);
    journal.uncertain(alice, first.id);
    expect(journal.list(alice)).toHaveLength(100);
    expect(journal.list(alice)[0]).toMatchObject({ id: first.id, status: 'uncertain' });
  });

  it('returns proven preflight failures to pending without reporting saved or locking the owner', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    vi.spyOn(memory, 'write').mockRejectedValueOnce(new MemoryStorageError('unavailable'));
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'SAVE_NOT_STARTED' });
    expect(journal.get(alice, proposal.id)).toMatchObject({ status: 'pending', confirmedAt: null, newValue: employment });
    expect(journal.active(alice)).toBe(false);
    expect(journal.notifications(alice)).toEqual([]);
    expect(await workflow.confirm(alice, proposal.id, confirmation)).toMatchObject({ status: 'committed' });
  });

  it('never releases a typed possibly transmitted failure for replay', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    vi.spyOn(memory, 'write').mockRejectedValueOnce(new MemoryStorageError('write_uncertain'));
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    expect(journal.get(alice, proposal.id).status).toBe('uncertain');
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(memory.write).toHaveBeenCalledTimes(1);
  });
  it('keeps the reviewed proposal pending without writing personal facts or a saved notification', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    expect(proposal).toMatchObject({ ownerId: alice, proposalRevision: 1, baseRevision: 0, status: 'pending', oldValue: null, newValue: employment });
    expect(memory.writes).toHaveLength(0);
    expect(journal.head(alice)).toEqual({ revision: 0, receipt: null });
    expect(journal.notifications(alice)).toEqual([]);
    expect(await workflow.read(alice)).toEqual({ revision: 0, employment: null });
  });

  it('commits only the reviewed exact value and removes proposal values after receipt persistence', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    const result = await workflow.confirm(alice, proposal.id, confirmation);
    expect(result).toMatchObject({ status: 'committed', oldValue: null, newValue: null });
    expect(memory.writes).toHaveLength(1);
    expect(memory.writes[0]).toEqual({ binding: resolve(alice), envelope: {
      schema: 1, ownerId: alice, operationId: proposal.id, revision: 1, previousFactId: null,
      confirmedAt: clockStart, employment,
    } });
    expect(journal.db.prepare('SELECT old_json, new_json FROM operations WHERE id=?').get(proposal.id)).toEqual({ old_json: null, new_json: null });
    expect(await workflow.read(alice)).toEqual({ revision: 1, employment });
    expect(journal.notifications(alice)).toEqual([expect.objectContaining({ operationId: proposal.id, revision: 1, kind: 'saved' })]);
  });

  it('repeated confirmation and reconciliation of a committed proposal cannot write or notify twice', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    const first = await workflow.confirm(alice, proposal.id, confirmation);
    expect(await workflow.confirm(alice, proposal.id, confirmation)).toEqual(first);
    expect(await workflow.reconcile(alice, proposal.id)).toEqual(first);
    expect(memory.writes).toHaveLength(1);
    expect(memory.reconciliations).toHaveLength(0);
    expect(journal.notifications(alice)).toHaveLength(1);
  });

  it('gets the next old value from AM and keeps the previous receipt in the supersession chain', async () => {
    const { workflow, memory } = setup();
    const first = await pending(workflow);
    const committed = await workflow.confirm(alice, first.id, confirmation);
    const changed = { ...employment, hoursPerWeek: 30, currentJob: false, endDate: '2026-10-01' };
    const next = await pending(workflow, alice, changed, 1);
    expect(next.oldValue).toEqual(employment);
    expect(next.newValue).toEqual(changed);
    expect(next.previousFactId).toBe(committed.receipt?.factId);
    await workflow.confirm(alice, next.id, confirmation);
    expect(memory.writes[1]?.envelope).toMatchObject({ previousFactId: committed.receipt?.factId, revision: 2, employment: changed });
    expect(await workflow.read(alice)).toEqual({ revision: 2, employment: changed });
  });

  it('rejecting a proposal removes personal values and never touches AM', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    expect(journal.reject(alice, proposal.id)).toMatchObject({ status: 'rejected', oldValue: null, newValue: null });
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_PENDING' });
    expect(memory.writes).toHaveLength(0);
    expect(journal.notifications(alice)).toHaveLength(0);
  });

  it('invalidates competing pending proposals on commit and refuses their later confirmations', async () => {
    const { workflow, memory, journal } = setup();
    const first = await pending(workflow);
    const competing = await pending(workflow, alice, { ...employment, hoursPerWeek: 20 });
    await workflow.confirm(alice, first.id, confirmation);
    expect(journal.get(alice, competing.id)).toMatchObject({ status: 'stale', oldValue: null, newValue: null });
    await expect(workflow.confirm(alice, competing.id, confirmation)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_PENDING' });
    await expect(pending(workflow)).rejects.toMatchObject({ code: 'STALE_REVISION' });
    expect(memory.writes).toHaveLength(1);
  });

  it.each([
    { proposalRevision: 2 },
    { proposalRevision: 1, ownerId: bob },
    { proposalRevision: 1, context: 'other-context' },
    { proposalRevision: 1, employment: { ...employment, hoursPerWeek: 1 } },
  ])('rejects altered confirmation payload %j without writing', async body => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    await expect(workflow.confirm(alice, proposal.id, body)).rejects.toMatchObject({ name: 'ZodError' });
    expect(memory.writes).toHaveLength(0);
    expect(journal.get(alice, proposal.id).status).toBe('pending');
  });
});

describe('deterministic tenant binding and negative cases', () => {
  it('does not reveal or modify another owner’s proposal through any lifecycle action', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    expect(() => journal.get(bob, proposal.id)).toThrowError(expect.objectContaining({ code: 'PROPOSAL_NOT_FOUND' }));
    expect(() => journal.reject(bob, proposal.id)).toThrowError(expect.objectContaining({ code: 'PROPOSAL_NOT_FOUND' }));
    await expect(workflow.confirm(bob, proposal.id, confirmation)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' });
    await expect(workflow.reconcile(bob, proposal.id)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' });
    expect(journal.list(bob)).toEqual([]);
    expect(journal.notifications(bob)).toEqual([]);
    expect(memory.writes).toHaveLength(0);
    expect(memory.reads).toHaveLength(0);
    expect(memory.reconciliations).toHaveLength(0);
    expect(journal.get(alice, proposal.id).status).toBe('pending');
  });

  it.each(['ownerId', 'context', 'readKey', 'writeKey'])('rejects %s injection in a proposal request', async key => {
    const { workflow, memory, journal } = setup();
    await expect(workflow.propose(alice, { baseRevision: 0, employment, [key]: 'attacker-controlled' })).rejects.toMatchObject({ name: 'ZodError' });
    expect(journal.list(alice)).toEqual([]);
    expect(memory.writes).toHaveLength(0);
  });

  it('fails closed for an authenticated user without a configured private context', async () => {
    const { workflow, memory, journal } = setup();
    await expect(workflow.read('user_unprovisioned')).rejects.toMatchObject({ code: 'CONTEXT_NOT_PROVISIONED' });
    await expect(pending(workflow, 'user_unprovisioned')).rejects.toMatchObject({ code: 'CONTEXT_NOT_PROVISIONED' });
    expect(journal.list('user_unprovisioned')).toEqual([]);
    expect(memory.writes).toHaveLength(0);
  });

  it('refuses a wrong owner or revision returned by memory', async () => {
    const { workflow, memory } = setup();
    const proposal = await pending(workflow);
    await workflow.confirm(alice, proposal.id, confirmation);
    const original = memory.writes[0]!.envelope;
    const read = vi.spyOn(memory, 'read');
    read.mockResolvedValueOnce({ ...original, ownerId: bob });
    await expect(workflow.read(alice)).rejects.toMatchObject({ code: 'MEMORY_UNAVAILABLE' });
    read.mockResolvedValueOnce({ ...original, revision: 500 });
    await expect(workflow.read(alice)).rejects.toMatchObject({ code: 'MEMORY_UNAVAILABLE' });
  });

  it('does not claim a second proposal if current AM evidence cannot be read', async () => {
    const { workflow, memory, journal } = setup();
    const first = await pending(workflow);
    await workflow.confirm(alice, first.id, confirmation);
    const second = await pending(workflow, alice, { ...employment, title: 'New title' }, 1);
    memory.failRead = true;
    await expect(workflow.confirm(alice, second.id, confirmation)).rejects.toMatchObject({ code: 'MEMORY_UNAVAILABLE' });
    expect(journal.get(alice, second.id).status).toBe('pending');
    expect(memory.writes).toHaveLength(1);
    expect(journal.notifications(alice)).toHaveLength(1);
  });
});

describe('owner serialization and uncertain remote outcomes', () => {
  it('returns the durable committed result if reconciliation wins before a late write error', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    const stored = deferred();
    const lateResponse = deferred();
    const realWrite = memory.write.bind(memory);
    vi.spyOn(memory, 'write').mockImplementation(async (binding, envelope) => {
      await realWrite(binding, envelope);
      stored.resolve();
      await lateResponse.promise;
      throw new MemoryStorageError('write_uncertain');
    });
    const confirm = workflow.confirm(alice, proposal.id, confirmation);
    await stored.promise;
    const reconciled = await workflow.reconcile(alice, proposal.id);
    lateResponse.resolve();
    expect(await confirm).toEqual(reconciled);
    expect(reconciled.status).toBe('committed');
    expect(journal.notifications(alice)).toHaveLength(1);
    expect(memory.writes).toHaveLength(1);
  });

  it('does not return uncertainty when another reconciliation already committed during a delayed empty read', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    memory.failWrite = 'after';
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    const entered = deferred();
    const release = deferred();
    const reconcile = memory.reconcile.bind(memory);
    vi.spyOn(memory, 'reconcile').mockImplementationOnce(async () => { entered.resolve(); await release.promise; return null; });
    const first = workflow.reconcile(alice, proposal.id);
    await entered.promise;
    const second = await workflow.reconcile(alice, proposal.id);
    release.resolve();
    expect(await first).toEqual(second);
    expect(second.status).toBe('committed');
    expect(journal.notifications(alice)).toHaveLength(1);
    expect(await reconcile(resolve(alice), memory.writes[0]!.envelope)).toBeTruthy();
  });
  it('allows only one write when the same proposal is confirmed concurrently', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    const entered = deferred();
    const release = deferred();
    memory.beforeWrite = async () => { entered.resolve(); await release.promise; };
    const first = workflow.confirm(alice, proposal.id, confirmation);
    await entered.promise;
    try {
      await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
      expect(memory.writes).toHaveLength(1);
    } finally { release.resolve(); }
    await expect(first).resolves.toMatchObject({ status: 'committed' });
    expect(journal.notifications(alice)).toHaveLength(1);
  });

  it('serializes different proposals for the same owner while leaving other tenants independent', async () => {
    const { workflow, memory, journal } = setup();
    const first = await pending(workflow);
    const competing = await pending(workflow, alice, { ...employment, title: 'Another title' });
    const bobsProposal = await pending(workflow, bob);
    const entered = deferred();
    const release = deferred();
    memory.beforeWrite = async () => { entered.resolve(); await release.promise; };
    const firstSave = workflow.confirm(alice, first.id, confirmation);
    await entered.promise;
    await expect(workflow.confirm(alice, competing.id, confirmation)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    const bobSave = workflow.confirm(bob, bobsProposal.id, confirmation);
    release.resolve();
    await expect(firstSave).resolves.toMatchObject({ status: 'committed' });
    await expect(bobSave).resolves.toMatchObject({ status: 'committed' });
    expect(memory.writes.map(write => write.binding.context)).toEqual(['test-alice-context', 'test-bob-context']);
    expect(journal.notifications(alice)).toHaveLength(1);
    expect(journal.notifications(bob)).toHaveLength(1);
  });

  it('holds a lost write response as uncertain, blocks another save, and reconciles without replay', async () => {
    const { workflow, memory, journal, setTime } = setup();
    const proposal = await pending(workflow);
    memory.failWrite = 'after';
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    expect(journal.get(alice, proposal.id)).toMatchObject({ status: 'uncertain', newValue: employment });
    expect(journal.head(alice)).toEqual({ revision: 0, receipt: null });
    expect(journal.notifications(alice)).toEqual([]);
    await expect(workflow.read(alice)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    await expect(pending(workflow)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    setTime('2026-10-27T14:00:00.000Z');
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(await workflow.reconcile(alice, proposal.id)).toMatchObject({ status: 'committed', oldValue: null, newValue: null });
    expect(memory.writes).toHaveLength(1);
    expect(memory.reconciliations).toHaveLength(1);
    expect(journal.notifications(alice)).toHaveLength(1);
  });

  it('does not call an absent fact proof of failure or retry after the provider receipt window', async () => {
    const { workflow, memory, journal, setTime } = setup();
    const proposal = await pending(workflow);
    memory.failWrite = 'before';
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    setTime('2026-10-28T14:00:00.000Z');
    await expect(workflow.reconcile(alice, proposal.id)).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(memory.writes).toHaveLength(1);
    expect(journal.get(alice, proposal.id).status).toBe('uncertain');
    expect(journal.head(alice)).toEqual({ revision: 0, receipt: null });
    expect(journal.notifications(alice)).toEqual([]);
  });

  it('keeps unavailable reconciliation uncertain with no notification or new write', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    memory.failWrite = 'after';
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    memory.failReconcile = true;
    await expect(workflow.reconcile(alice, proposal.id)).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    expect(journal.get(alice, proposal.id).status).toBe('uncertain');
    expect(memory.writes).toHaveLength(1);
    expect(journal.notifications(alice)).toEqual([]);
  });

  it('recovers a remote success followed by a local receipt-commit failure without a second remote write', async () => {
    const { workflow, memory, journal } = setup();
    const proposal = await pending(workflow);
    const complete = vi.spyOn(journal, 'complete');
    complete.mockImplementationOnce(() => { throw new Error('test disk interrupted'); });
    await expect(workflow.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'SAVE_UNCERTAIN' });
    expect(journal.notifications(alice)).toEqual([]);
    expect(await workflow.reconcile(alice, proposal.id)).toMatchObject({ status: 'committed' });
    expect(memory.writes).toHaveLength(1);
    expect(journal.notifications(alice)).toHaveLength(1);
  });

  it('persists an applying operation across restart and reconciles the prior write after more than 24 hours', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'maple-workflow-test-'));
    tempDirectories.add(directory);
    const path = join(directory, 'journal.sqlite');
    const { workflow, memory, journal } = setup(path);
    const proposal = await pending(workflow);
    const applying = journal.claim(alice, proposal.id, clockStart);
    await memory.write(resolve(alice), envelopeFor(applying));
    close(journal); // Simulates a process stopping before its local commit receipt.
    const reopened = open(path);
    const restarted = new Workflow(reopened, memory, resolve, () => new Date('2026-10-27T16:00:00.000Z'));
    expect(reopened.get(alice, proposal.id).status).toBe('applying');
    await expect(restarted.confirm(alice, proposal.id, confirmation)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(await restarted.reconcile(alice, proposal.id)).toMatchObject({ status: 'committed' });
    expect(await restarted.read(alice)).toEqual({ revision: 1, employment });
    expect(memory.writes).toHaveLength(1);
    expect(reopened.notifications(alice)).toHaveLength(1);
  });

  it('rejects a stale read if a commit begins before that remote read returns', async () => {
    const { workflow, memory, journal } = setup();
    const first = await pending(workflow);
    await workflow.confirm(alice, first.id, confirmation);
    const next = await pending(workflow, alice, { ...employment, title: 'Changed' }, 1);
    const readStarted = deferred();
    const releaseRead = deferred();
    const original = memory.read.bind(memory);
    vi.spyOn(memory, 'read').mockImplementationOnce(async (binding, receipt) => {
      const value = await original(binding, receipt);
      readStarted.resolve();
      await releaseRead.promise;
      return value;
    });
    const reading = workflow.read(alice);
    await readStarted.promise;
    journal.claim(alice, next.id, clockStart);
    releaseRead.resolve();
    await expect(reading).rejects.toMatchObject({ code: 'STALE_REVISION' });
  });
});
