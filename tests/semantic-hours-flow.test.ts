import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
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
const directories: string[] = [];
afterEach(() => {
  journals.splice(0).forEach(j => j.close());
  for (const path of directories.splice(0)) {
    const absolute = resolve(path);
    if (dirname(absolute) !== resolve(tmpdir()) || !basename(absolute).startsWith('maple-hours-test-')) throw new Error('Unsafe test cleanup path');
    rmSync(absolute, { recursive: true, force: true });
  }
});

async function setup(response: unknown, path = ':memory:') {
  const journal = new Journal(path); journals.push(journal);
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
    'I work 37 hours every other week.', 'I work 37 hours biweekly.', 'I work 37 hours bi-weekly.',
    'I work 37 hours fortnightly.', 'I work 37 hours every second week.', 'I work 37 hours in alternating weeks.',
    'I work 37 hours twice per week.', 'I work 37 hours per shift.', 'I work 37 hours every pay period.',
    'I now work 37 hours per week and I am unpaid.',
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
  it.each([
    { message: 'After weeks of negotiation, I now work 37 hours.', source: 'interpretation' },
    { message: 'The old weekly arrangement ended; I now work 37 hours.', source: 'interpretation' },
    { message: 'The old hours per week entry is obsolete; I now work 37 hours.', source: 'interpretation' },
    { message: 'I work 37 hours per week.', source: 'message' },
    { message: 'I work 37 hours each week.', source: 'message' },
    { message: 'I work 37 hours weekly.', source: 'message' },
    { message: 'My weekly hours are 37.', source: 'message' },
    { message: 'I work 37 weekly hours.', source: 'message' },
  ])('preserves quantity-linked period provenance across journal reopen: $message', async ({ message, source }) => {
    const directory = mkdtempSync(join(tmpdir(), 'maple-hours-test-')); directories.push(directory);
    const path = join(directory, 'journal.sqlite');
    const { chat, journal, memory, fetchImpl } = await setup(nativeSemanticFixtures[1]!.response, path);
    const result = await chat.propose(owner, { baseRevision: 1, message, syntheticTest: true });
    if (result.kind !== 'proposal') throw new Error('proposal expected');
    expect(result.proposal.chat?.periodSource).toBe(source);
    journal.close(); journals.splice(journals.indexOf(journal), 1);
    const reopened = new Journal(path); journals.push(reopened);
    const stored = reopened.get(owner, result.proposal.id);
    expect(stored.chat).toEqual(result.proposal.chat);
    const html = renderToStaticMarkup(createElement(HoursReviewNote, {
      ...stored.chat!, oldHours: stored.oldValue!.hoursPerWeek, newHours: stored.newValue!.hoursPerWeek!,
    }));
    expect(html).toContain('Update weekly hours from 38 to 37?');
    expect(html.includes('could not clearly link a weekly period')).toBe(source === 'interpretation');
    expect(html).toContain('changes only weekly hours');
    expect(reopened.head(owner).revision).toBe(1);
    expect(reopened.notifications(owner)).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(memory.writes).toHaveLength(1);
  });

  it.each(['message', 'interpretation'] as const)('shows the exact weekly change with %s period evidence and no automatic save control', periodSource => {
    const html = renderToStaticMarkup(createElement(HoursReviewNote, {
      utterance: 'I now work 37 hours', oldHours: 38, newHours: 37, periodSource, expiresAt: '2026-10-25T20:00:00Z',
    }));
    expect(html).toContain('Update weekly hours from 38 to 37?');
    expect(html).toContain('Your saved record stays unchanged'); expect(html).not.toContain('<button');
    expect(html.includes('could not clearly link a weekly period')).toBe(periodSource === 'interpretation');
  });
});
