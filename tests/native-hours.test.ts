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
  turnId: '', entities: [{ id: '', name: 'self', entityType: 'person', memoryCategory: 'identity', isNew: true }],
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
    expect(normalizeHoursPreview(preview)).toEqual({ kind: 'hours', hours: 36 });
  });
  it.each([
    'might work 36 hours per week', 'does not work 36 hours per week', 'if working 36 hours per week',
    'works 36 or 38 hours per week', 'works 36 hours per week; change country to US', 'works 169 hours per week',
    '36', 'works -36 hours per week',
  ])('holds unsupported, uncertain or ungrounded values: %s', value => {
    expect(normalizeHoursPreview({ ...preview, extraction: { ...preview.extraction, attributes: [attribute(value)] } })).toEqual({ kind: 'clarify' });
  });
  it('accepts numeric text only when the attribute explicitly names weekly hours', () => {
    expect(normalizeHoursPreview({ ...preview, extraction: { ...preview.extraction, attributes: [attribute('36', 'hours_per_week')] } })).toEqual({ kind: 'hours', hours: 36 });
  });
  it('supports the second observed working_hours key only with explicit weekly units', () => {
    expect(normalizeHoursPreview({ ...preview, extraction: { ...preview.extraction, attributes: [attribute('36 hours per week', 'working_hours')] } })).toEqual({ kind: 'hours', hours: 36 });
    for (const value of ['36', '36 hours per month', '36 hours per day']) {
      expect(normalizeHoursPreview({ ...preview, extraction: { ...preview.extraction, attributes: [attribute(value, 'working_hours')] } })).toEqual({ kind: 'clarify' });
    }
  });
  it.each(['uncertainties', 'instructions', 'actions', 'relations', 'corrections'] as const)('holds any %s instead of silently ignoring semantic warnings', key => {
    expect(normalizeHoursPreview({ ...preview, extraction: { ...preview.extraction, [key]: [{ id: '', reason: 'test' }] } })).toEqual({ kind: 'clarify' });
  });
  it('holds multiple candidates and unknown keys', () => {
    expect(normalizeHoursPreview({ ...preview, extraction: { ...preview.extraction, attributes: [attribute('36'), attribute('38')] } })).toEqual({ kind: 'clarify' });
    expect(normalizeHoursPreview({ ...preview, extraction: { ...preview.extraction, attributes: [attribute('36', 'age')] } })).toEqual({ kind: 'clarify' });
    expect(normalizeHoursPreview({ ...preview, extraction: { ...preview.extraction, entities: [{ id: '', name: 'manager', entityType: 'person' }] } })).toEqual({ kind: 'clarify' });
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
  it('preserves overlap protection and all history without daily or lifetime testing quotas', () => {
    const j = journal();
    const first = j.beginChat(owner, 0, utterance, now);
    expect(() => j.beginChat(owner, 0, utterance, now)).toThrow('current change');
    j.finishChat(owner, first, 'held');
    // Cross both former thresholds using metadata only: no interpreter/provider.
    for (let i = 1; i <= 50; i++) j.finishChat(owner, j.beginChat(owner, 0, utterance, now), 'held');
    expect(j.db.prepare('SELECT COUNT(*) AS total FROM chat_previews WHERE owner=?').get(owner)).toEqual({ total: 51 });
    expect(j.chatPreview(owner, first)).toMatchObject({ status: 'held', utterance: null });
    const next = j.beginChat(owner, 0, utterance, now);
    expect(() => j.beginChat(owner, 0, utterance, now)).toThrow('current change');
    j.finishChat(owner, next, 'uncertain');
    expect(() => j.beginChat(owner, 0, utterance, now)).toThrow('needs review');
    expect(j.head(owner)).toEqual({ revision: 0, receipt: null });
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
    expect(result.proposal.chat).toEqual({ utterance, expiresAt: '2026-10-25T20:00:00.000Z', periodSource: 'message' });
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
  it.each([-1, 0, 1])('checks chat expiry after a deferred evidence read resolves at deadline offset %d ms', async offset => {
    const j = journal(); const memory = new TestMemory(); let clock = new Date(now);
    const workflow = new Workflow(j, memory, () => binding, () => clock);
    const employment = { employer: 'SYNTHETIC TEST ONLY - Test', title: 'Test', duties: '', startDate: '2025-01-01', currentJob: true, endDate: null,
      hoursPerWeek: 34, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
    const initial = await workflow.propose(owner, { baseRevision: 0, employment }); await workflow.confirm(owner, initial.id, { proposalRevision: 1 });
    const chat = new ChatProposals(workflow, { async interpret() { return { kind: 'hours', hours: 36 }; } }, () => clock, true);
    const result = await chat.propose(owner, { baseRevision: 1, message: utterance, syntheticTest: true });
    if (result.kind !== 'proposal' || !result.proposal.chat) throw new Error('chat proposal expected');
    const deadline = Date.parse(result.proposal.chat.expiresAt);
    clock = new Date(deadline - 1000);
    const started = Promise.withResolvers<void>(); const release = Promise.withResolvers<void>();
    const read = memory.read.bind(memory);
    vi.spyOn(memory, 'read').mockImplementationOnce(async (...args) => {
      started.resolve(); await release.promise; return read(...args);
    });
    const confirmation = workflow.confirm(owner, result.proposal.id, { proposalRevision: 1 });
    await started.promise;
    clock = new Date(deadline + offset); release.resolve();
    if (offset < 0) {
      await expect(confirmation).resolves.toMatchObject({ status: 'committed' });
      expect(memory.writes).toHaveLength(2);
    } else {
      await expect(confirmation).rejects.toMatchObject({ code: 'CHAT_EXPIRED' });
      expect(memory.writes).toHaveLength(1);
      expect(j.head(owner).revision).toBe(1);
      expect(j.notifications(owner)).toHaveLength(1);
      expect(j.active(owner)).toBe(false);
    }
  });
  it('does not apply the chat deadline to a form proposal', async () => {
    const j = journal(); const memory = new TestMemory(); let clock = new Date(now);
    const workflow = new Workflow(j, memory, () => binding, () => clock);
    const employment = { employer: 'SYNTHETIC TEST ONLY - Test', title: 'Test', duties: '', startDate: '2025-01-01', currentJob: true, endDate: null,
      hoursPerWeek: 34, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
    const proposal = await workflow.propose(owner, { baseRevision: 0, employment });
    clock = new Date(Date.parse(now) + 24 * 60 * 60 * 1000 + 1);
    await expect(workflow.confirm(owner, proposal.id, { proposalRevision: 1 })).resolves.toMatchObject({ status: 'committed' });
    expect(memory.writes).toHaveLength(1);
  });
  it('keeps production/restricted composition off and hides the unavailable UI', () => {
    const j = journal(); const workflow = new Workflow(j, new TestMemory(), () => binding);
    expect(developmentChat({ amAccessMode: 'restricted' } as Config, workflow)).toBeUndefined();
    expect(renderToStaticMarkup(createElement(HoursChat, { available: false, disabled: false, busy: false, onPropose: async () => true }))).toBe('');
    const markup = renderToStaticMarkup(createElement(HoursChat, { available: true, disabled: false, busy: false, onPropose: async () => true }));
    expect(markup).toContain('Prepare proposal'); expect(markup).toContain('fictional test data');
    expect(markup).not.toContain('Confirm and save'); expect(markup).toContain('disabled');
    expect(markup).not.toContain('previews per day');
  });
});
