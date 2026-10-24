import { describe, expect, it, vi } from 'vitest';
import { createMemoryPreview } from '../server/am-preview.js';

// These are transport assertions, not evidence of the live model's understanding.
export const semanticCases = [
  { category: 'paraphrase/typo', message: 'I currenly put in 37 hours each week at my fictional job.' },
  { category: 'missing period', message: 'I now work 37 hours.' },
  { category: 'negation', message: 'I do not work 37 hours per week. Do not change my current hours.' },
  { category: 'hypothetical', message: 'If I worked 37 hours per week next month, what would change? This is hypothetical.' },
];
const binding = { ownerId: 'user_test', endpoint: 'https://test.memory.example', context: 'synthetic-test', readKey: 'fixture-read', writeKey: 'fixture-write' };

describe('proposed semantic evaluation: preview-only transport, test responses only', () => {
  it.each(semanticCases)('preserves the full $category input without full extraction or a second request', async ({ message }) => {
    const text = `SYNTHETIC SEMANTIC EVALUATION ONLY. Fictional test person: ${message}`;
    const response = { mode: 'preview', preview: true, sessionId: 'synthetic-test-session', extraction: {
      turnId: '', entities: [], attributes: [], relations: [], actions: [], instructions: [], uncertainties: [], corrections: [],
    } };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(response)));
    await expect(createMemoryPreview(fetchImpl)(binding, text)).resolves.toEqual(response);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('https://test.memory.example/api/v1/synthetic-test/facts');
    expect(init?.method).toBe('POST'); expect(init?.redirect).toBe('error');
    expect(JSON.parse(String(init?.body))).toEqual({ text, infer: 'preview', scopes: [['maple/approved']] });
  });
});
