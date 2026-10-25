import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Journal } from '../server/journal.js';
import { Workflow } from '../server/workflow.js';
import { TestMemory } from './support/test-memory.js';
import { HoursReviewNote } from '../web/HoursReviewNote.js';
import type { Employment } from '../shared/employment.js';

const owner = 'user_legacy';
const start = '2026-10-24T20:00:00.000Z', deadline = '2026-10-25T20:00:00.000Z';
const employment: Employment = { employer: 'Synthetic historical fixture', title: 'Fixture', duties: '', startDate: '2025-01-01',
  currentJob: true, endDate: null, hoursPerWeek: 38, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
const binding = (ownerId: string) => ({ ownerId, endpoint: 'https://memory.example.test', context: 'test-only', readKey: 'test-read', writeKey: 'test-write' });
const journals: Journal[] = [], directories: string[] = [];
function open(path = ':memory:') { const j = new Journal(path); journals.push(j); return j; }
afterEach(() => { journals.splice(0).forEach(j => j.close()); directories.splice(0).forEach(p => {
  if (!p.startsWith(join(tmpdir(), 'maple-legacy-'))) throw Error('Unexpected test directory');
  rmSync(p, { recursive: true, force: true });
}); vi.restoreAllMocks(); });

// Import an already-stored legacy record; no retired interpreter or provider call.
function historical(j: Journal, proposalId: string, utterance: string, account = owner, issue?: 'period' | 'field', baseRevision = 0) {
  const id = randomUUID();
  j.db.prepare('INSERT INTO chat_previews VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, account, baseRevision, utterance, start, deadline, 'proposed', binding(account).endpoint, 'test-only', 'historical-session', proposalId);
  if (issue) j.db.prepare('INSERT INTO chat_clarifications VALUES (?, ?, NULL, ?, ?, ?)').run(id, account, issue, 'actual_weekly_work', start);
  j.db.prepare('INSERT INTO chat_diagnostics VALUES (?, ?, ?, ?, 200, ?)')
    .run(id, account, 'PROPOSAL_PREPARED', JSON.stringify({ candidates: [{ field: 'hours_per_week', values: [37], unit: 'weekly' }] }), start);
  return id;
}

describe('stored hours proposals after interpreter retirement', () => {
  it.each([
    ['After weeks of negotiation, I now work 37 hours.', 'interpretation'],
    ['The old weekly arrangement ended; I now work 37 hours.', 'interpretation'],
    ['I work 37 hours every other week.', 'interpretation'],
    ['I work 37 hours biweekly.', 'interpretation'],
    ['I work 37 hours per week.', 'message'],
    ['My weekly hours are 37.', 'message'],
  ] as const)('preserves review provenance after reopen: %s', (message, source) => {
    const directory = mkdtempSync(join(tmpdir(), 'maple-legacy-')); directories.push(directory);
    const path = join(directory, 'journal.sqlite'), j = open(path);
    const proposal = j.propose(owner, 0, employment, { ...employment, hoursPerWeek: 37 }, start);
    const id = historical(j, proposal.id, message);
    j.close(); journals.splice(journals.indexOf(j), 1);
    const reloaded = open(path), saved = reloaded.get(owner, proposal.id);
    expect(saved.chat).toMatchObject({ utterance: message, expiresAt: deadline, periodSource: source });
    expect(() => reloaded.get('user_other', proposal.id)).toThrow('not found');
    expect(() => reloaded.chatPreview('user_other', id)).toThrow('not found');
    expect(reloaded.list('user_other')).toEqual([]);
    const html = renderToStaticMarkup(createElement(HoursReviewNote, { ...saved.chat!, oldHours: 38, newHours: 37 }));
    expect(html).toContain('Update weekly hours from 38 to 37?');
    expect(html.includes('could not clearly link')).toBe(source === 'interpretation');
    expect(JSON.stringify(saved)).not.toMatch(/PROPOSAL_PREPARED|candidates|historical-session/);
  });

  it.each(['period', 'field'] as const)('preserves user clarification provenance: %s', issue => {
    const j = open(), proposal = j.propose(owner, 0, employment, { ...employment, hoursPerWeek: 37 }, start);
    historical(j, proposal.id, 'I work 37 hours.', owner, issue);
    const saved = j.get(owner, proposal.id);
    expect(saved.chat?.clarificationAnswer).toBe('actual_weekly_work');
    expect(saved.chat?.clarificationSource).toBe(issue === 'field' ? 'user_entered' : undefined);
  });

  it('expires only the owner content, keeps audit rows and never changes AM', () => {
    const j = open();
    const a = j.propose(owner, 0, null, employment, start), b = j.propose('user_other', 0, null, employment, start);
    const aid = historical(j, a.id, 'PRIVATE FIXTURE A'), bid = historical(j, b.id, 'PRIVATE FIXTURE B', 'user_other', 'field');
    j.expireChat(owner, deadline);
    expect(j.get(owner, a.id)).toMatchObject({ status: 'stale', oldValue: null, newValue: null });
    expect(j.chatPreview(owner, aid)).toMatchObject({ utterance: null, session_id: 'historical-session' });
    expect(j.db.prepare('SELECT evidence_json FROM chat_diagnostics WHERE id=?').get(aid)).toEqual({ evidence_json: null });
    expect(j.get('user_other', b.id).status).toBe('pending');
    expect(j.chatPreview('user_other', bid).utterance).toBe('PRIVATE FIXTURE B');
    expect(j.db.prepare('SELECT COUNT(*) AS count FROM chat_previews').get()).toEqual({ count: 2 });
  });

  it.each([-1, 0, 1])('checks the stored deadline after a deferred read at offset %d ms', async offset => {
    const j = open(), memory = new TestMemory(); let clock = new Date(start);
    const workflow = new Workflow(j, memory, binding, () => clock);
    const initial = await workflow.propose(owner, { baseRevision: 0, employment });
    await workflow.confirm(owner, initial.id, { proposalRevision: 1 });
    const proposal = await workflow.propose(owner, { baseRevision: 1, employment: { ...employment, hoursPerWeek: 37 } });
    historical(j, proposal.id, 'I work 37 hours per week.', owner, undefined, 1);
    clock = new Date(Date.parse(deadline) - 1000);
    const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>(), read = memory.read.bind(memory);
    vi.spyOn(memory, 'read').mockImplementationOnce(async (...args) => { started.resolve(); await release.promise; return read(...args); });
    const confirmation = workflow.confirm(owner, proposal.id, { proposalRevision: 1 });
    await started.promise; clock = new Date(Date.parse(deadline) + offset); release.resolve();
    if (offset < 0) {
      await expect(confirmation).resolves.toMatchObject({ status: 'committed' });
      await workflow.confirm(owner, proposal.id, { proposalRevision: 1 });
      expect(memory.writes).toHaveLength(2); expect(j.notifications(owner)).toHaveLength(2);
    } else {
      await expect(confirmation).rejects.toMatchObject({ code: 'CHAT_EXPIRED' });
      expect(memory.writes).toHaveLength(1); expect(j.head(owner).revision).toBe(1);
    }
  });

  it('still allows explicit discard and leaves ordinary form proposals independent of legacy expiry', async () => {
    const j = open(), memory = new TestMemory(); let clock = new Date(start);
    const workflow = new Workflow(j, memory, binding, () => clock);
    const old = await workflow.propose(owner, { baseRevision: 0, employment });
    const id = historical(j, old.id, 'I work 38 hours per week.');
    await workflow.journal.reject(owner, old.id);
    expect(j.chatPreview(owner, id)).toMatchObject({ status: 'settled', utterance: null });
    const form = await workflow.propose(owner, { baseRevision: 0, employment });
    clock = new Date(Date.parse(deadline) + 1);
    await expect(workflow.confirm(owner, form.id, { proposalRevision: 1 })).resolves.toMatchObject({ status: 'committed' });
    expect(memory.writes).toHaveLength(1);
  });
});
