import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Journal } from '../server/journal.js';
import { Workflow } from '../server/workflow.js';
import { ChatProposals } from '../server/chat-proposals.js';
import { NativeHoursInterpreter } from '../server/native-hours.js';
import { createMemoryPreview } from '../server/am-preview.js';
import { TestMemory } from './support/test-memory.js';
import { nativeSemanticFixtures } from './support/native-semantic-fixtures.js';
import { HoursClarificationCard } from '../web/HoursChat.js';
import { HoursReviewNote } from '../web/HoursReviewNote.js';

const owner = 'user_test';
const binding = { ownerId: owner, endpoint: 'https://fixture.example', context: 'fixture', readKey: 'test-read', writeKey: 'test-write' };
const employment = { employer: 'SYNTHETIC TEST ONLY - Clarification', title: 'Fixture', duties: '', startDate: '2025-01-01', currentJob: true,
  endDate: null, hoursPerWeek: 38, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
const journals: Journal[] = [];
afterEach(() => journals.splice(0).forEach(j => j.close()));
async function setup(value = '40 hours', key = 'work_hours') {
  let clock = new Date('2026-10-24T20:00:00Z'); const now = () => clock;
  const journal = new Journal(':memory:'); journals.push(journal);
  const memory = new TestMemory(); const workflow = new Workflow(journal, memory, () => binding, now);
  const initial = await workflow.propose(owner, { baseRevision: 0, employment }); await workflow.confirm(owner, initial.id, { proposalRevision: 1 });
  const response = structuredClone(nativeSemanticFixtures[0]!.response);
  response.extraction.attributes = [{ id: '', entityId: '', key, value, memoryCategory: 'identity' }];
  const transport = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(response)));
  const chat = new ChatProposals(workflow, new NativeHoursInterpreter(() => binding, journal, createMemoryPreview(transport)), now, true);
  async function ask(message = 'I now work 40 hours.') {
    const result = await chat.propose(owner, { baseRevision: 1, message, syntheticTest: true });
    if (result.kind !== 'clarification') throw new Error('clarification expected');
    return result.clarification;
  }
  return { journal, memory, workflow, chat, transport, ask, setTime: (iso: string) => { clock = new Date(iso); } };
}

describe('native candidate clarification, not automatic fact approval', () => {
  // Sanitized values observed in the four-call hosted diagnostic; replay only.
  it.each([
    ['I now work 37 hours.', '37 hours per week', 'work_hours', 'period'],
    ['I now work 40 hours.', '40 hours', 'work_hours', 'period'],
    ['I can now work for 37 hours', '37 hours per week', 'working_hours', 'intent'],
    ['I can now work for 40 hours', 'available to work 40 hours per week', 'employment_record', 'intent'],
  ])('asks before proposing the captured candidate for %s', async (message, value, key, issue) => {
    const { ask, chat, transport, memory, journal } = await setup(value, key);
    const question = await ask(message!);
    expect(question.issue).toBe(issue); expect(chat.pending(owner)).toEqual(question);
    expect(JSON.parse(String(transport.mock.calls[0]![1]?.body)).text.endsWith(message!)).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1); expect(memory.writes).toHaveLength(1); expect(journal.list(owner)).toHaveLength(1);
  });
  it('requires an explicit answer, exact review and separate confirmation; replay cannot duplicate writes', async () => {
    const { ask, chat, workflow, memory, transport, journal } = await setup(); const question = await ask();
    await expect(chat.answer(owner, question.id, { answer: 'actual_weekly_work', hours: 99 })).rejects.toMatchObject({ name: 'ZodError' });
    const result = await chat.answer(owner, question.id, { answer: 'actual_weekly_work' });
    if (result.kind !== 'proposal') throw new Error('proposal expected');
    expect(result.proposal).toMatchObject({ status: 'pending', baseRevision: 1, oldValue: { hoursPerWeek: 38 }, newValue: { hoursPerWeek: 40 }, chat: { clarificationAnswer: 'actual_weekly_work' } });
    expect(memory.writes).toHaveLength(1); expect(transport).toHaveBeenCalledTimes(1);
    await expect(chat.answer(owner, question.id, { answer: 'actual_weekly_work' })).rejects.toMatchObject({ code: 'CLARIFICATION_NOT_FOUND' });
    const html = renderToStaticMarkup(createElement(HoursReviewNote, { ...result.proposal.chat!, oldHours: 38, newHours: 40 }));
    expect(html).toContain('You clarified that 40 is your actual weekly work total'); expect(html).not.toContain('interprets the total');
    await workflow.confirm(owner, result.proposal.id, { proposalRevision: 1 }); await workflow.confirm(owner, result.proposal.id, { proposalRevision: 1 });
    expect(memory.writes).toHaveLength(2); expect(journal.notifications(owner)).toHaveLength(2);
  });
  it.each(['availability_only', 'different_period'])('leaves facts unchanged for %s without another model call', async answer => {
    const { ask, chat, memory, journal, transport } = await setup(); const question = await ask();
    expect(await chat.answer(owner, question.id, { answer })).toMatchObject({ kind: 'unchanged' });
    expect(chat.pending(owner)).toBeNull(); expect(journal.list(owner)).toHaveLength(1); expect(memory.writes).toHaveLength(1); expect(transport).toHaveBeenCalledTimes(1);
    expect(journal.chatPreview(owner, question.id).utterance).toBeNull();
  });
  it('denies another owner and holds new previews while a clarification is outstanding', async () => {
    const { ask, chat, transport } = await setup(); const question = await ask();
    expect(chat.pending('user_other')).toBeNull();
    await expect(chat.answer('user_other', question.id, { answer: 'actual_weekly_work' })).rejects.toMatchObject({ status: 404 });
    await expect(ask()).rejects.toMatchObject({ code: 'CHANGE_PENDING' }); expect(transport).toHaveBeenCalledTimes(1);
  });
  it('refuses stale answers and still lets the owner abandon the obsolete question', async () => {
    const { ask, chat, workflow, memory } = await setup(); const question = await ask();
    const form = await workflow.propose(owner, { baseRevision: 1, employment: { ...employment, hoursPerWeek: 39 } }); await workflow.confirm(owner, form.id, { proposalRevision: 1 });
    await expect(chat.answer(owner, question.id, { answer: 'actual_weekly_work' })).rejects.toMatchObject({ code: 'STALE_REVISION' });
    expect(await chat.answer(owner, question.id, { answer: 'different_period' })).toMatchObject({ kind: 'unchanged' }); expect(memory.writes).toHaveLength(2);
  });
  it('preserves a separate pending form proposal instead of replacing it', async () => {
    const { ask, chat, workflow, journal, memory } = await setup(); const question = await ask();
    const form = await workflow.propose(owner, { baseRevision: 1, employment: { ...employment, hoursPerWeek: 39 } });
    await expect(chat.answer(owner, question.id, { answer: 'actual_weekly_work' })).rejects.toMatchObject({ code: 'CHANGE_PENDING' });
    expect(journal.get(owner, form.id)).toEqual(form); expect(chat.pending(owner)).toEqual(question); expect(memory.writes).toHaveLength(1);
  });
  it('expires an answer that crosses the deadline during its evidence read', async () => {
    const { ask, chat, workflow, journal, memory, setTime } = await setup(); const question = await ask();
    setTime('2026-10-25T19:59:59Z'); const read = workflow.read.bind(workflow);
    vi.spyOn(workflow, 'read').mockImplementationOnce(async target => { const result = await read(target); setTime('2026-10-25T20:00:01Z'); return result; });
    await expect(chat.answer(owner, question.id, { answer: 'actual_weekly_work' })).rejects.toThrow();
    expect(journal.list(owner)).toHaveLength(1); expect(memory.writes).toHaveLength(1);
    expect(journal.db.prepare('SELECT hours FROM chat_clarifications WHERE id=?').get(question.id)).toEqual({ hours: null });
  });
  it('renders distinct actual-work, availability and different-period choices without a save control', async () => {
    const { ask } = await setup(); const question = await ask();
    const html = renderToStaticMarkup(createElement(HoursClarificationCard, { value: question, disabled: false, onAnswer: async () => {} }));
    expect(html).toContain('40 hours per week of actual work'); expect(html).toContain('Availability only'); expect(html).toContain('Different period'); expect(html).toContain('separate review and confirmation'); expect(html).not.toContain('Confirm and save');
  });
});
