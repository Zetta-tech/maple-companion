import { AgentMemory } from '@surrealdb/memory';
import { z } from 'zod';
import type { Binding } from './am.js';

const textSchema = z.string().trim().min(1).max(500);
const responseSchema = z.object({
  // Hosted probe returned a persisted session despite no fact/turn writes. Keep
  // this adapter closed until that side effect has an explicitly accepted design.
  mode: z.literal('preview'), preview: z.literal(true), sessionId: z.literal(''),
  extraction: z.object({
    turnId: z.literal('').optional(), corrections: z.array(z.unknown()).max(0).optional(),
    entities: z.array(z.unknown()).max(20), attributes: z.array(z.unknown()).max(20),
    relations: z.array(z.unknown()).max(20), actions: z.array(z.unknown()).max(20),
    instructions: z.array(z.unknown()).max(20), uncertainties: z.array(z.unknown()).max(20),
  }),
  turnId: z.never().optional(), chunkId: z.never().optional(),
});
export type MemoryPreview = z.infer<typeof responseSchema>;
export class PreviewUnavailable extends Error {
  constructor() { super('The proposed correction could not be interpreted safely.'); }
}

/** Experimental only. Runtime does not instantiate this adapter; see docs/CHAT_PREVIEW.md. */
export function createMemoryPreview(fetchImpl: typeof fetch = globalThis.fetch) {
  return async (binding: Binding, text: string): Promise<MemoryPreview> => {
    try {
      const message = textSchema.parse(text);
      const origin = new URL(binding.endpoint);
      if (origin.protocol !== 'https:' || origin.origin !== binding.endpoint || origin.username || origin.password
        || !/^user_[A-Za-z0-9]+$/.test(binding.ownerId) || !/^[A-Za-z0-9_-]{1,128}$/.test(binding.context) || !binding.writeKey.trim()) throw new Error();
      const expectedPath = `/api/v1/${binding.context}/facts`;
      let sent = false;
      const guardedFetch: typeof fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        if (sent || url.origin !== origin.origin || url.pathname !== expectedPath || url.search
          || init?.method !== 'POST' || typeof init.body !== 'string') throw new Error();
        const body = JSON.parse(init.body);
        if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(['infer', 'scopes', 'text'])
          || body.infer !== 'preview' || body.text !== message || JSON.stringify(body.scopes) !== '[["maple/approved"]]') throw new Error();
        sent = true;
        const response = await fetchImpl(input, { ...init, redirect: 'error' });
        if (Number(response.headers.get('Content-Length') ?? 0) > 64 * 1024) { await response.body?.cancel(); throw new Error(); }
        if (!response.body) return response;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = []; let size = 0;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 64 * 1024) { await reader.cancel(); throw new Error(); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        return new Response(Buffer.concat(chunks), { status: response.status, headers: response.headers });
      };
      const client = new AgentMemory({ endpoint: origin.origin, context: binding.context, apiKey: binding.writeKey,
        timeoutMs: 15_000, maxRetries: 0, fetchImpl: guardedFetch });
      return responseSchema.parse(await client.remember(message, { infer: 'preview', scopes: [['maple/approved']] }));
    } catch { throw new PreviewUnavailable(); }
  };
}
