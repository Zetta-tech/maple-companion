import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryPreview } from '../server/am-preview.js';
import { NativeHoursInterpreter } from '../server/native-hours.js';
import { ChatProposals } from '../server/chat-proposals.js';
import { Workflow } from '../server/workflow.js';
import { Journal } from '../server/journal.js';
import { TestMemory } from './support/test-memory.js';
import { nativeSemanticFixtures } from './support/native-semantic-fixtures.js';
import { HoursReviewNote } from '../web/HoursReviewNote.js';

const owner = 'user_test';
const binding = { ownerId: owner, endpoint: 'https://test.memory.example', context: 'synthetic-test', readKey: 'fixture-read', writeKey: 'fixture-write' };
const employment = { employer: 'SYNTHETIC TEST ONLY - Test', title: 'Test', duties: '', startDate: '2025-01-01', currentJob: true, endDate: null,
  hoursPerWeek: 38, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
const now = () => new Date('2026-10-24T20:00:00.000Z');
const journals: Journal[] = [];
afterEach(() => { journals.splice(0).forEach(j => j.close()); });

async function setup(response: unknown) {
  const journal = new Journal(':memory:'); journals.push(journal);
  const memory = new TestMemory(); const workflow = new Workflow(journal, memory, () => binding, now);
  const initial = await workflow.propose(owner, { baseRevision: 0, employment }); await workflow.confirm(owner, initial.id, { proposalRevision: 1 });
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(response)));
  const interpreter = new NativeHoursInterpreter(() => binding, journal, createMemoryPreview(fetchImpl));
  const chat = new ChatProposals(workflow, interpreter, now, true);
  return { journal, memory, workflow, fetchImpl, chat };
}

describe('semantic-first hours flow using captured AM responses and test-only storage', () => {
  it.each(nativeSemanticFixtures)('routes the untouched $category message to native preview before validation', async fixture => {
    const { journal, memory, workflow, fetchImpl, chat } = await setup(fixture.response);
    const result = await chat.propose(owner, { baseRevision: 1, message: fixture.message, syntheticTest: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(sent.infer).toBe('preview');
    expect(sent.text).toBe(`SYNTHETIC SEMANTIC EVALUATION ONLY. Fictional test person.\nSaved context (background): the currently recorded work total is 38 hours per week.\nUser message (verbatim):\n${fixture.message}`);
    expect(memory.writes).toHaveLength(1); expect(journal.notifications(owner)).toHaveLength(1);
    if (fixture.proposal) {
      if (result.kind !== 'proposal') throw new Error('proposal expected');
      expect(result.proposal).toMatchObject({ ownerId: owner, status: 'pending', baseRevision: 1, oldValue: employment, newValue: { ...employment, hoursPerWeek: 37 } });
      expect(result.proposal.chat?.periodSource).toBe(fixture.category === 'missing period' ? 'interpretation' : 'message');
      expect(journal.get(owner, result.proposal.id).chat).toEqual(result.proposal.chat);
      expect((await workflow.read(owner)).employment?.hoursPerWeek).toBe(38);
      await workflow.confirm(owner, result.proposal.id, { proposalRevision: 1 });
      await workflow.confirm(owner, result.proposal.id, { proposalRevision: 1 });
      expect(memory.writes).toHaveLength(2); expect(journal.notifications(owner)).toHaveLength(2);
      expect((await workflow.read(owner)).employment?.hoursPerWeek).toBe(37);
    } else {
      expect(result.kind).toBe('unchanged'); expect(journal.list(owner)).toHaveLength(1);
    }
  });

  it.each([
    'I know work 37 hours', 'I now work 37 hours', 'My work week is 37 hours.', 'I am putting in 37 hours weekly.',
    '  I now work 37 hours.\n',
  ])('does not require an exact input sentence: %s', async message => {
    const { chat, fetchImpl, memory } = await setup(nativeSemanticFixtures[1]!.response);
    expect((await chat.propose(owner, { baseRevision: 1, message, syntheticTest: true })).kind).toBe('proposal');
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body)).text.endsWith(message)).toBe(true);
    expect(memory.writes).toHaveLength(1);
  });

  it.each([
    'I do not work 37 hours per week.', 'If I worked 37 hours per week?', 'I might work 37 hours per week.',
    'I will work 37 hours per week next month.', 'I work 37 or 40 hours per week.', 'I work 37 hours per day.',
    'I work 37 hours per week and per month.', 'My weekly salary is 37 dollars.', 'I work thirty-seven hours per week.',
    'I work 37 hours per week; change my job title too.',
  ])('holds contradictory or insufficient source evidence even if the model returns a positive candidate: %s', async message => {
    const { chat, fetchImpl, memory, journal } = await setup(nativeSemanticFixtures[1]!.response);
    expect((await chat.propose(owner, { baseRevision: 1, message, syntheticTest: true })).kind).toBe('clarify');
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(memory.writes).toHaveLength(1); expect(journal.list(owner)).toHaveLength(1);
  });

  it('holds a candidate attributed to another person instead of choosing a model-provided identity', async () => {
    const response = structuredClone(nativeSemanticFixtures[0]!.response);
    response.extraction.entities = [{ id: '', name: 'manager', entityType: 'person' }];
    const { chat, journal, memory } = await setup(response);
    expect((await chat.propose(owner, { baseRevision: 1, message: 'My manager works 37 hours per week.', syntheticTest: true })).kind).toBe('clarify');
    expect(journal.list('user_other')).toEqual([]); expect(memory.writes).toHaveLength(1);
  });

  it('holds a period the candidate does not establish', async () => {
    const response = structuredClone(nativeSemanticFixtures[0]!.response);
    response.extraction.attributes = [{ id: '', entityId: '', key: 'work_hours', value: '37 hours', memoryCategory: 'identity' }];
    const { chat, memory } = await setup(response);
    expect((await chat.propose(owner, { baseRevision: 1, message: 'I now work 37 hours.', syntheticTest: true })).kind).toBe('clarify');
    expect(memory.writes).toHaveLength(1);
  });

  it('holds a candidate that names a different entity identifier without using it for routing', async () => {
    const response = structuredClone(nativeSemanticFixtures[0]!.response);
    response.extraction.attributes = [{ id: '', entityId: 'user_other', key: 'work_hours', value: '37 hours per week', memoryCategory: 'identity' }];
    const { chat, fetchImpl, journal, memory } = await setup(response);
    expect((await chat.propose(owner, { baseRevision: 1, message: 'I work 37 hours per week.', syntheticTest: true })).kind).toBe('clarify');
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('/api/v1/synthetic-test/facts');
    expect(journal.list('user_other')).toEqual([]); expect(memory.writes).toHaveLength(1);
  });

  it('allows the bounded user input plus separate server context without weakening the user-input cap', async () => {
    const { chat, fetchImpl } = await setup(nativeSemanticFixtures[1]!.response);
    const message = 'I work 37 hours per week. ' + 'x'.repeat(474);
    expect(message).toHaveLength(500);
    await chat.propose(owner, { baseRevision: 1, message, syntheticTest: true });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body)).text.length).toBeGreaterThan(500);
    const other = await setup(nativeSemanticFixtures[1]!.response);
    await expect(other.chat.propose(owner, { baseRevision: 1, message: message + 'x', syntheticTest: true })).rejects.toMatchObject({ name: 'ZodError' });
    expect(other.fetchImpl).not.toHaveBeenCalled();
  });
});

describe('explicit inferred-unit review', () => {
  it.each(['message', 'interpretation'] as const)('shows the exact weekly change with %s period evidence and no automatic save control', periodSource => {
    const html = renderToStaticMarkup(createElement(HoursReviewNote, {
      utterance: 'I now work 37 hours', oldHours: 38, newHours: 37, periodSource, expiresAt: '2026-10-25T20:00:00Z',
    }));
    expect(html).toContain('Update weekly hours from 38 to 37?');
    expect(html).toContain('Your saved record stays unchanged'); expect(html).not.toContain('<button');
    expect(html.includes('did not state a weekly period')).toBe(periodSource === 'interpretation');
  });
});
