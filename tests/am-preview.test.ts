import { describe, expect, it, vi } from 'vitest';
import { createMemoryPreview, PreviewUnavailable } from '../server/am-preview.js';
const binding = { ownerId: 'user_A', endpoint: 'https://a.memory.example.test', context: 'ctx_a', readKey: 'fixture-read', writeKey: 'fixture-write' };
const preview = { mode: 'preview', preview: true, sessionId: '', extraction: {
  entities: [], attributes: [], relations: [], actions: [], instructions: [], uncertainties: [],
} };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

describe('experimental AM preview transport', () => {
  it('uses the real SDK and sends only one explicit preview request to the bound Context', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response(preview));
    expect(await createMemoryPreview(transport)(binding, 'I now work 36 hours per week.')).toEqual(preview);
    expect(transport).toHaveBeenCalledTimes(1);
    const [input, init] = transport.mock.calls[0]!;
    expect(String(input)).toBe('https://a.memory.example.test/api/v1/ctx_a/facts');
    expect(init?.method).toBe('POST'); expect(init?.redirect).toBe('error');
    expect(JSON.parse(String(init?.body))).toEqual({ text: 'I now work 36 hours per week.', infer: 'preview', scopes: [['maple/approved']] });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-write');
  });
  it.each([
    { ...preview, mode: 'full' }, { ...preview, preview: false }, { ...preview, preview: undefined },
    { ...preview, chunkId: 'unexpected-persistent-chunk' }, { ...preview, turnId: 'unexpected-persistent-turn' },
    { ...preview, sessionId: '../../unexpected-path' },
    { ...preview, extraction: { ...preview.extraction, turnId: 'unexpected-nested-turn' } },
    { ...preview, extraction: { ...preview.extraction, attributes: [{ id: 'unexpected-saved-fact' }] } },
  ])('fails closed on a response that does not prove the expected preview shape %#', async wire => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response(wire));
    await expect(createMemoryPreview(transport)(binding, 'Synthetic test.')).rejects.toBeInstanceOf(PreviewUnavailable);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([429, 500, 503])('does not retry or fall back to full extraction after HTTP %s', async status => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response({ detail: 'do not reflect provider content' }, status));
    await expect(createMemoryPreview(transport)(binding, 'Synthetic test.')).rejects.toThrow('interpreted safely');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each(['', ' '.repeat(5), 'x'.repeat(501)])('does not transmit invalid text %#', async text => {
    const transport = vi.fn<typeof fetch>();
    await expect(createMemoryPreview(transport)(binding, text)).rejects.toBeInstanceOf(PreviewUnavailable);
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['http://a.example.test', 'https://a.example.test/path', 'https://user:password@a.example.test'])('rejects unsafe routing %s', async endpoint => {
    const transport = vi.fn<typeof fetch>();
    await expect(createMemoryPreview(transport)({ ...binding, endpoint }, 'Synthetic test.')).rejects.toBeInstanceOf(PreviewUnavailable);
    expect(transport).not.toHaveBeenCalled();
  });
  it('bounds provider responses before SDK parsing', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(65 * 1024)));
    await expect(createMemoryPreview(transport)(binding, 'Synthetic test.')).rejects.toBeInstanceOf(PreviewUnavailable);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
