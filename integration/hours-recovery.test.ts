import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { connectOperationalDatabase, loadDatabaseConfig } from '../server/operational-db.js';
import { SurrealJournal } from '../server/surreal-journal.js';
import { Workflow } from '../server/workflow.js';
import { ChatProposals } from '../server/chat-proposals.js';
import { TestMemory } from '../tests/support/test-memory.js';
import { testCecEmployment } from '../tests/support/test-cec.js';

// Real operational database; AM and interpreter are explicitly offline adapters.
// Every record is synthetic, unique to this run and retained without cleanup.
it('reloads unmapped-field recovery across connections without adopting the candidate or bypassing confirmation', async () => {
  const config = loadDatabaseConfig('test');
  const db = await connectOperationalDatabase(config), otherDb = await connectOperationalDatabase(config);
  const run = randomUUID().replaceAll('-', ''), owner = 'user_recovery_' + run;
  const foreign = 'user_foreign_' + run;
  try {
    const journal = await SurrealJournal.open(db), reloaded = await SurrealJournal.open(otherDb);
    const memory = new TestMemory();
    let clock = new Date('2026-10-24T20:00:00Z'); const now = () => clock;
    const binding = (ownerId: string) => ({ ownerId, context: 'synthetic-' + ownerId,
      endpoint: 'https://memory.example.test', readKey: 'test-only', writeKey: 'test-only' });
    const firstWorkflow = new Workflow(journal, memory, binding, now), nextWorkflow = new Workflow(reloaded, memory, binding, now);
    const { cecWork: _absent, ...base } = testCecEmployment();
    const employment = { ...base, employer: 'SYNTHETIC TEST ONLY - Recovery ' + run, hoursPerWeek: 38 };
    const initial = await firstWorkflow.propose(owner, { baseRevision: 0, employment });
    await firstWorkflow.confirm(owner, initial.id, { proposalRevision: 1 });
    const interpret = vi.fn(async () => ({ kind: 'clarify_field' }));
    const chat = new ChatProposals(firstWorkflow, { interpret }, now, true);
    const result = await chat.propose(owner, { baseRevision: 1, message: 'SYNTHETIC: now I work 39 hours', syntheticTest: true });
    if (result.kind !== 'clarification') throw Error('clarification expected');
    const nextChat = new ChatProposals(nextWorkflow, { interpret }, now, true);
    expect(await nextChat.pending(owner)).toEqual(result.clarification);
    expect(result.clarification).toMatchObject({ issue: 'field', hours: null });
    expect(await nextChat.pending(foreign)).toBeNull();
    await expect(nextChat.answer(foreign, result.clarification.id, { answer: 'actual_weekly_work', hours: 39 })).rejects.toMatchObject({ status: 404 });
    await expect(nextChat.answer(owner, result.clarification.id, { answer: 'actual_weekly_work' })).rejects.toMatchObject({ name: 'ZodError' });
    const answer = await nextChat.answer(owner, result.clarification.id, { answer: 'actual_weekly_work', hours: 39 });
    if (answer.kind !== 'proposal') throw Error('proposal expected');
    expect((await journal.get(owner, answer.proposal.id))).toMatchObject({ newValue: { hoursPerWeek: 39 }, chat: { clarificationSource: 'user_entered' } });
    expect(memory.writes).toHaveLength(1); expect(interpret).toHaveBeenCalledTimes(1);
    await expect(chat.answer(owner, result.clarification.id, { answer: 'actual_weekly_work', hours: 40 })).rejects.toMatchObject({ code: 'CLARIFICATION_NOT_FOUND' });
    await firstWorkflow.confirm(owner, answer.proposal.id, { proposalRevision: 1 });
    await nextWorkflow.confirm(owner, answer.proposal.id, { proposalRevision: 1 });
    expect(memory.writes).toHaveLength(2); expect(await reloaded.notifications(owner)).toHaveLength(2);
    expect((await nextWorkflow.read(owner)).employment?.hoursPerWeek).toBe(39);
    // New question, same synthetic owner: expiry checked after the async read.
    const expiring = await chat.propose(owner, { baseRevision: 2, message: 'SYNTHETIC: now I work 40 hours', syntheticTest: true });
    if (expiring.kind !== 'clarification') throw Error('clarification expected');
    clock = new Date('2026-10-25T19:59:59Z'); const read = nextWorkflow.read.bind(nextWorkflow);
    vi.spyOn(nextWorkflow, 'read').mockImplementationOnce(async target => { const current = await read(target); clock = new Date('2026-10-25T20:00:01Z'); return current; });
    await expect(nextChat.answer(owner, expiring.clarification.id, { answer: 'actual_weekly_work', hours: 40 })).rejects.toThrow();
    expect(memory.writes).toHaveLength(2); expect((await reloaded.list(owner))).toHaveLength(2);
    const tables = ['heads', 'operations', 'notifications', 'chat_previews', 'chat_clarifications', 'chat_diagnostics'];
    const retained: Record<string, number> = {};
    for (const table of tables) {
      const [rows] = await db.query<[{ total: number }[]]>(`SELECT count() AS total FROM maple_${table} WHERE owner = $owner GROUP ALL;`, { owner }).retry(false);
      retained[table] = rows[0]?.total ?? 0;
    }
    console.info('Retained synthetic recovery records:', JSON.stringify(retained));
  } finally {
    await Promise.all([db.close(), otherDb.close()]);
    console.info('Retained synthetic recovery run:', run);
  }
}, 40_000);
