import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Journal } from '../server/journal.js';
import { analyzeHoursPreview, hoursPreviewText, NativeHoursInterpreter } from '../server/native-hours.js';
import { createMemoryPreview, type MemoryPreview } from '../server/am-preview.js';
import { hoursEvidenceIssue } from '../server/hours-evidence.js';
import { Workflow } from '../server/workflow.js';
import { ChatProposals } from '../server/chat-proposals.js';
import { TestMemory } from './support/test-memory.js';
import { nativeSemanticFixtures } from './support/native-semantic-fixtures.js';

const owner = 'user_test'; const now = '2026-10-24T20:00:00.000Z';
const binding = { ownerId: owner, endpoint: 'https://fixture.example', context: 'fixture', readKey: 'test-read', writeKey: 'test-write' };
const journals: Journal[] = [];
const open = () => { const j = new Journal(':memory:'); journals.push(j); return j; };
const evidence = () => analyzeHoursPreview(nativeSemanticFixtures[0]!.response).evidence;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { journals.splice(0).forEach(j => j.close()); vi.useRealTimers(); });

describe('private preview diagnostics', () => {
  it.each(['I now work 37 hours.', 'I now work 40 hours.', 'I can now work for 37 hours', 'I can now work for 40 hours'])('sends the diagnostic input unchanged with separate identical current context: %s', async message => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(nativeSemanticFixtures[0]!.response)));
    await createMemoryPreview(transport)(binding, hoursPreviewText(message, 38));
    const sent = JSON.parse(String(transport.mock.calls[0]![1]?.body));
    expect(sent).toEqual({ infer: 'preview', scopes: [['maple/approved']], text: 'SYNTHETIC SEMANTIC EVALUATION ONLY. Fictional test person.\nSaved context (background): the currently recorded work total is 38 hours per week.\nUser message (verbatim):\n' + message });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([
    { index: 0, reason: 'NATIVE_CANDIDATE' }, { index: 1, reason: 'NATIVE_CANDIDATE' },
    { index: 2, reason: 'NATIVE_NO_CANDIDATE' }, { index: 3, reason: 'NATIVE_EMPTY' },
  ])('distinguishes captured native result $reason', ({ index, reason }) => {
    expect(analyzeHoursPreview(nativeSemanticFixtures[index]!.response).reason).toBe(reason);
  });
  it('retains numeric field/unit evidence without source text, entity names or raw model prose', () => {
    const response = structuredClone(nativeSemanticFixtures[0]!.response);
    (response.extraction.attributes[0] as { value: string }).value = '37 hours per week RAW_PRIVATE_SENTINEL';
    const result = analyzeHoursPreview(response);
    expect(result.reason).toBe('NATIVE_VALUE_UNSUPPORTED');
    expect(result.evidence.candidates).toEqual([{ field: 'work_hours', values: [37], unit: 'weekly' }]);
    expect(JSON.stringify(result.evidence)).not.toContain('RAW_PRIVATE_SENTINEL');
  });
  it('distinguishes ambiguous extraction from a Maple source-evidence rejection', () => {
    const response = structuredClone(nativeSemanticFixtures[0]!.response);
    response.extraction.uncertainties = [{ id: '', reason: 'PRIVATE_REASON' }];
    expect(analyzeHoursPreview(response).reason).toBe('NATIVE_AMBIGUOUS');
    expect(hoursEvidenceIssue('I work 37 hours per shift.', 37)?.reason).toBe('MAPLE_CADENCE_UNRESOLVED');
    expect(hoursEvidenceIssue('I do not work 37 hours per week.', 37)?.reason).toBe('MAPLE_NONCURRENT_OR_NEGATED');
  });
  it('binds private diagnostics to the owner and redacts candidate evidence at the existing deadline', () => {
    const j = open(); const id = j.beginChat(owner, 0, 'PRIVATE_INPUT', now);
    j.recordChatDiagnostic(owner, id, 'NATIVE_CANDIDATE', evidence());
    j.finishChat(owner, id, 'held');
    expect(() => j.recordChatDiagnostic('user_other', id, 'MAPLE_NO_CHANGE')).toThrow('not found');
    expect(j.chatPreview(owner, id).utterance).toBeNull();
    vi.setSystemTime('2026-10-25T20:00:00.000Z'); j.expireChat(owner, new Date().toISOString());
    j.recordChatDiagnostic(owner, id, 'MAPLE_NO_CHANGE', evidence());
    expect(j.db.prepare('SELECT reason,evidence_json FROM chat_diagnostics WHERE id=?').get(id)).toEqual({ reason: 'MAPLE_NO_CHANGE', evidence_json: null });
    expect(j.db.prepare('SELECT COUNT(*) AS count FROM chat_previews').get()).toEqual({ count: 1 });
  });
  it.each([429, 503])('records provider HTTP %s without response body, retries or writes', async status => {
    const j = open(); const id = j.beginChat(owner, 0, 'I now work 40 hours.', now);
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"detail":"PRIVATE_PROVIDER_ERROR"}', { status }));
    await expect(new NativeHoursInterpreter(() => binding, j, createMemoryPreview(transport)).interpret(owner, 'I now work 40 hours.', id, 38)).rejects.toThrow();
    const row = j.db.prepare('SELECT reason,evidence_json,provider_status FROM chat_diagnostics WHERE id=?').get(id);
    expect(row).toEqual({ reason: 'PROVIDER_HTTP_ERROR', evidence_json: null, provider_status: status });
    expect(transport).toHaveBeenCalledTimes(1); expect(j.head(owner).revision).toBe(0);
    expect(() => j.beginChat(owner, 0, 'another request', now)).toThrow('needs review');
  });
  it('records response-shape failure separately and never exposes diagnostics in a proposal payload', async () => {
    const j = open(); const memory = new TestMemory(); const workflow = new Workflow(j, memory, () => binding, () => new Date(now));
    const employment = { employer: 'SYNTHETIC TEST ONLY - Diagnostic', title: 'Fixture', duties: '', startDate: '2025-01-01', currentJob: true, endDate: null, hoursPerWeek: 38, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
    const initial = await workflow.propose(owner, { baseRevision: 0, employment }); await workflow.confirm(owner, initial.id, { proposalRevision: 1 });
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(nativeSemanticFixtures[0]!.response)));
    const chat = new ChatProposals(workflow, new NativeHoursInterpreter(() => binding, j, createMemoryPreview(transport)), () => new Date(now), true);
    const result = await chat.propose(owner, { baseRevision: 1, message: 'I work 37 hours per week.', syntheticTest: true });
    expect(result.kind).toBe('proposal'); expect(memory.writes).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('PROPOSAL_PREPARED'); expect(JSON.stringify(result)).not.toContain('candidates');
    const row = j.db.prepare('SELECT reason,evidence_json FROM chat_diagnostics WHERE owner=?').get(owner) as {reason: string; evidence_json: string};
    expect(row.reason).toBe('PROPOSAL_PREPARED'); expect(JSON.parse(row.evidence_json).candidates[0].values).toEqual([37]);
    const bad = open(); const id = bad.beginChat(owner, 0, 'I now work 40 hours.', now);
    const malformed = { ...nativeSemanticFixtures[0]!.response, mode: 'full' } as unknown as MemoryPreview;
    await expect(new NativeHoursInterpreter(() => binding, bad, createMemoryPreview(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(malformed))))).interpret(owner, 'I now work 40 hours.', id, 38)).rejects.toThrow();
    expect(bad.db.prepare('SELECT reason FROM chat_diagnostics WHERE id=?').get(id)).toEqual({ reason: 'PROVIDER_RESPONSE_INVALID' });
  });
});
