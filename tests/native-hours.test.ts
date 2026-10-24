import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeHoursPreview, NativeHoursInterpreter, developmentChat } from '../server/native-hours.js';
import { createMemoryPreview, type MemoryPreview } from '../server/am-preview.js';
import { Journal } from '../server/journal.js';
import { Workflow } from '../server/workflow.js';
import { TestMemory } from './support/test-memory.js';
import { ChatProposals } from '../server/chat-proposals.js';
import { HoursChat } from '../web/HoursChat.js';
import type { Config } from '../server/config.js';

const owner = 'user_A'; const now = '2026-10-24T20:00:00.000Z';
const binding = { ownerId: owner, endpoint: 'https://a.memory.example.test', context: 'test-context', readKey: 'fixture-read', writeKey: 'fixture-write' };
const preview: MemoryPreview = { mode: 'preview', preview: true, sessionId: 'test-preview-session', extraction: {
  turnId: '', entities: [{ id: '', name: 'model-controlled-name', entityType: 'person', memoryCategory: 'identity', isNew: true }],
  attributes: [{ id: '', entityId: '', key: 'employment_record', value: 'works 36 hours per week', memoryCategory: 'context' }],
  actions: [], relations: [], instructions: [], uncertainties: [], corrections: [],
} };
const utterance = 'I now work 36 hours per week.';
const journals: Journal[] = [];
function journal() { const j = new Journal(':memory:'); journals.push(j); return j; }
afterEach(() => { journals.splice(0).forEach(j => j.close()); vi.restoreAllMocks(); });
const attribute = (value: string, key = 'employment_record') => ({ id: '', entityId: '', key, value, memoryCategory: 'context' });

describe('native preview candidate normalization', () => {
  it('normalizes the observed fictional candidate and ignores model identity', () => {
    expect(normalizeHoursPreview(utterance, preview)).toEqual({ kind: 'hours', hours: 36 });
  });
  it.each([
    'might work 36 hours per week', 'does not work 36 hours per week', 'if working 36 hours per week',
    'works 36 or 38 hours per week', 'works 36 hours per week; change country to US', 'works 169 hours per week',
    'works 35 hours per week', '36', 'works -36 hours per week',
  ])('holds unsupported, uncertain or ungrounded values: %s', value => {
    expect(normalizeHoursPreview(utterance, { ...preview, extraction: { ...preview.extraction, attributes: [attribute(value)] } })).toEqual({ kind: 'clarify' });
  });
  it('accepts numeric text only when the attribute explicitly names weekly hours', () => {
    expect(normalizeHoursPreview(utterance, { ...preview, extraction: { ...preview.extraction, attributes: [attribute('36', 'hours_per_week')] } })).toEqual({ kind: 'hours', hours: 36 });
  });
  it('supports the second observed working_hours key only with explicit weekly units', () => {
    expect(normalizeHoursPreview(utterance, { ...preview, extraction: { ...preview.extraction, attributes: [attribute('36 hours per week', 'working_hours')] } })).toEqual({ kind: 'hours', hours: 36 });
    for (const value of ['36', '36 hours per month', '36 hours per day']) {
      expect(normalizeHoursPreview(utterance, { ...preview, extraction: { ...preview.extraction, attributes: [attribute(value, 'working_hours')] } })).toEqual({ kind: 'clarify' });
    }
  });
  it.each(['uncertainties', 'instructions', 'actions', 'relations', 'corrections'] as const)('holds any %s instead of silently ignoring semantic warnings', key => {
    expect(normalizeHoursPreview(utterance, { ...preview, extraction: { ...preview.extraction, [key]: [{ id: '', reason: 'test' }] } })).toEqual({ kind: 'clarify' });
  });
  it('holds multiple candidates, unknown keys and hypothetical source wording', () => {
    expect(normalizeHoursPreview(utterance, { ...preview, extraction: { ...preview.extraction, attributes: [attribute('36'), attribute('38')] } })).toEqual({ kind: 'clarify' });
    expect(normalizeHoursPreview(utterance, { ...preview, extraction: { ...preview.extraction, attributes: [attribute('36', 'age')] } })).toEqual({ kind: 'clarify' });
    expect(normalizeHoursPreview('If I work 36 hours per week?', preview)).toEqual({ kind: 'clarify' });
  });
});

describe('native interpreter and operational session metadata', () => {
  it('uses the real SDK preview mode, records the returned session under the initiating owner and never changes the journal head', async () => {
    const j = journal(); const id = j.beginChat(owner, 0, utterance, now);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(preview)));
    const native = new NativeHoursInterpreter(() => binding, j, createMemoryPreview(fetchImpl));
    expect(await native.interpret(owner, utterance, id)).toEqual({ kind: 'hours', hours: 36 });
    const request = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(request.infer).toBe('preview'); expect(request.text).toContain('SYNTHETIC');
    expect(request.text).toContain(utterance); expect(request.text).not.toContain(owner);
    expect(j.chatPreview(owner, id)).toMatchObject({ owner, utterance, endpoint: binding.endpoint, context: binding.context, session_id: preview.sessionId });
    expect(() => j.chatPreview('user_B', id)).toThrow('not found');
    expect(j.head(owner)).toEqual({ revision: 0, receipt: null });
    expect(j.list(owner)).toEqual([]); expect(j.notifications(owner)).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...preview, mode: 'full' }, { ...preview, turnId: 'saved-turn' },
    { ...preview, extraction: { ...preview.extraction, attributes: [{ id: 'saved-attribute' }] } },
  ])('preserves known session metadata and stops after unexpected persistence indicators %#', async wire => {
    const j = journal(); const id = j.beginChat(owner, 0, utterance, now);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(wire)));
    const native = new NativeHoursInterpreter(() => binding, j, createMemoryPreview(fetchImpl));
    await expect(native.interpret(owner, utterance, id)).rejects.toThrow('interpreted safely');
    expect(j.chatPreview(owner, id)).toMatchObject({ status: 'blocked', session_id: preview.sessionId });
    expect(() => j.beginChat(owner, 0, utterance, now)).toThrow('needs review');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('records an uncertain outcome without replay after a transport failure', async () => {
    const j = journal(); const id = j.beginChat(owner, 0, utterance, now);
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout'));
    await expect(new NativeHoursInterpreter(() => binding, j, createMemoryPreview(fetchImpl)).interpret(owner, utterance, id)).rejects.toThrow();
    expect(j.chatPreview(owner, id)).toMatchObject({ status: 'uncertain', session_id: null, endpoint: binding.endpoint });
    expect(() => j.beginChat(owner, 0, utterance, now)).toThrow('needs review');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('refuses cross-owner or different-utterance requests before transport', async () => {
    const j = journal(); const id = j.beginChat(owner, 0, utterance, now);
    const fetchImpl = vi.fn<typeof fetch>(); const native = new NativeHoursInterpreter(() => binding, j, createMemoryPreview(fetchImpl));
    await expect(native.interpret('user_B', utterance, id)).rejects.toThrow('interpreted safely');
    await expect(native.interpret(owner, 'I work 40 hours per week.', id)).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('bounded pending retention and release gate', () => {
  it('recovers an interrupted preview for only the configured owner without replay', () => {
    const j = journal(); const a = j.beginChat(owner, 0, utterance, now); const b = j.beginChat('user_B', 0, utterance, now);
    j.recoverChat(owner);
    expect(j.chatPreview(owner, a).status).toBe('uncertain');
    expect(j.chatPreview('user_B', b).status).toBe('interpreting');
    expect(() => j.beginChat(owner, 0, utterance, now)).toThrow('needs review');
  });
  it('bounds simultaneous calls and daily/lifetime trial attempts without deleting metadata records', () => {
    const j = journal();
    const first = j.beginChat(owner, 0, utterance, now);
    expect(() => j.beginChat(owner, 0, utterance, now)).toThrow('current change');
    j.finishChat(owner, first, 'held');
    for (let i = 0; i < 4; i++) j.finishChat(owner, j.beginChat(owner, 0, utterance, now), 'held');
    expect(() => j.beginChat(owner, 0, utterance, now)).toThrow('trial limit');
    expect(j.db.prepare('SELECT COUNT(*) AS total FROM chat_previews WHERE owner=?').get(owner)).toEqual({ total: 5 });
    for (let day = 25; day < 34; day++) {
      const date = new Date(Date.UTC(2026, 9, day)).toISOString();
      for (let i = 0; i < 5; i++) j.finishChat(owner, j.beginChat(owner, 0, utterance, date), 'held');
    }
    expect(() => j.beginChat(owner, 0, utterance, '2026-12-01T00:00:00.000Z')).toThrow('trial limit');
  });
  it('expires pending content before confirmation, keeps metadata, and makes no remote write', async () => {
    const j = journal(); const memory = new TestMemory(); let clock = new Date(now);
    const workflow = new Workflow(j, memory, () => binding, () => clock);
    const employment = { employer: 'SYNTHETIC TEST ONLY - Test', title: 'Test', duties: '', startDate: '2025-01-01', currentJob: true, endDate: null,
      hoursPerWeek: 34, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
    const initial = await workflow.propose(owner, { baseRevision: 0, employment }); await workflow.confirm(owner, initial.id, { proposalRevision: 1 });
    const chat = new ChatProposals(workflow, { async interpret() { return { kind: 'hours', hours: 36 }; } }, () => clock, true);
    const result = await chat.propose(owner, { baseRevision: 1, message: utterance, syntheticTest: true });
    if (result.kind !== 'proposal') throw new Error('proposal expected');
    expect(result.proposal.chat).toEqual({ utterance, expiresAt: '2026-10-25T20:00:00.000Z' });
    clock = new Date('2026-10-25T20:00:00.000Z');
    await expect(workflow.confirm(owner, result.proposal.id, { proposalRevision: 1 })).rejects.toThrow('no longer awaiting');
    expect(j.get(owner, result.proposal.id)).toMatchObject({ status: 'stale', oldValue: null, newValue: null });
    expect(j.db.prepare('SELECT utterance FROM chat_previews WHERE owner=?').get(owner)).toEqual({ utterance: null });
    expect(memory.writes).toHaveLength(1);
  });
  it('redacts pending wording after explicit discard while retaining its session ID', () => {
    const j = journal(); const id = j.beginChat(owner, 0, utterance, now);
    j.recordChatRemote(owner, id, binding.endpoint, binding.context, preview.sessionId);
    const p = j.propose(owner, 0, null, {} as never, now, id);
    j.reject(owner, p.id);
    expect(j.chatPreview(owner, id)).toMatchObject({ status: 'settled', utterance: null, session_id: preview.sessionId });
  });
  it('keeps production/restricted composition off and hides the unavailable UI', () => {
    const j = journal(); const workflow = new Workflow(j, new TestMemory(), () => binding);
    expect(developmentChat({ amAccessMode: 'restricted' } as Config, workflow)).toBeUndefined();
    expect(renderToStaticMarkup(createElement(HoursChat, { available: false, disabled: false, busy: false, onPropose: async () => true }))).toBe('');
    const markup = renderToStaticMarkup(createElement(HoursChat, { available: true, disabled: false, busy: false, onPropose: async () => true }));
    expect(markup).toContain('Prepare proposal'); expect(markup).toContain('fictional test data');
    expect(markup).not.toContain('Confirm and save'); expect(markup).toContain('disabled');
  });
});
