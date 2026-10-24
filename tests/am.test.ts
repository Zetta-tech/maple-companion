import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createAgentMemory, digestEnvelope, MemoryStorageError, type Binding, type Envelope } from '../server/am.js';

// The real alpha.11 SDK runs in every test. Only its HTTP transport is replaced.
const endpoint = 'https://memory.example.test';
const binding: Binding = { ownerId: 'user_alice', endpoint, context: 'ctx_alice', readKey: 'test-read-only', writeKey: 'test-write-only' };
const entityName = (ownerId = binding.ownerId) => `maple-${createHash('sha256').update(ownerId).digest('hex')}`;
const envelope: Envelope = {
  schema: 1, ownerId: binding.ownerId, operationId: 'operation-one', revision: 1,
  previousFactId: null, confirmedAt: '2026-10-24T00:00:00.000Z',
  employment: {
    employer: 'Test employer', title: 'Developer', duties: 'Writes and tests software.',
    startDate: '2025-01-01', currentJob: true, endDate: null, hoursPerWeek: 35,
    countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false,
  },
};
const receipt = { factId: 'attribute:one', digest: digestEnvelope(envelope) };

function row(value: Envelope = envelope, extra: Record<string, unknown> = {}) {
  return {
    id: 'attribute:one', entity: `entity:person/${entityName(value.ownerId)}`, key: 'employment_record',
    value: JSON.stringify(value), memoryCategory: 'identity', scope: [['maple/approved']],
    source: { kind: 'upsert' }, supersedes: value.previousFactId, supersededBy: null,
    ...extra,
  };
}
function page(attributes: unknown[], nextCursor?: string) {
  return { attributes, page: { hasMore: Boolean(nextCursor), ...(nextCursor ? { nextCursor } : {}) } };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
type Call = { url: URL; method: string; headers: Headers; body?: Record<string, unknown>; redirect?: RequestRedirect };
function transport(handler: (call: Call, index: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const call: Call = {
      url: new URL(input instanceof Request ? input.url : input.toString()),
      method: init?.method ?? 'GET', headers: new Headers(init?.headers), redirect: init?.redirect,
      ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) as Record<string, unknown> } : {}),
    };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  return { calls, fetchImpl };
}
function writeResult(value: string, extra: Record<string, unknown> = {}) {
  return {
    mode: 'triples', sessionId: 'session:one', turnId: 'turn:one',
    extraction: {
      turnId: 'turn:one',
      entities: [], attributes: [{ id: receipt.factId, entityId: 'entity:one', key: 'employment_record', value, memoryCategory: 'identity' }],
      relations: [], instructions: [], actions: [], uncertainties: [], corrections: [],
    },
    ...extra,
  };
}

describe('real Agent Memory SDK adapter', () => {
  it('keeps concurrent owners on their own hosted endpoints and credentials for writes and reads', async () => {
    const bob: Binding = { ownerId: 'user_bob', endpoint: 'https://bob.memory.example.test', context: 'ctx_bob', readKey: 'test-bob-read', writeKey: 'test-bob-write' };
    const bobEnvelope: Envelope = { ...envelope, ownerId: bob.ownerId, operationId: 'bob-operation' };
    const stored = new Map<string, Envelope>();
    const fake = transport(call => {
      const target = call.url.origin === binding.endpoint ? binding : call.url.origin === bob.endpoint ? bob : undefined;
      expect(target).toBeDefined();
      expect(call.url.pathname).toBe(`/api/v1/${target!.context}/${call.method === 'POST' ? 'facts' : 'attributes'}`);
      expect(call.headers.get('Authorization')).toBe(`Bearer ${call.method === 'POST' ? target!.writeKey : target!.readKey}`);
      if (call.method === 'POST') {
        const value = (call.body!.triples as { value: string }[])[0]!.value;
        const parsed = JSON.parse(value) as Envelope;
        expect(parsed.ownerId).toBe(target!.ownerId);
        stored.set(target!.endpoint, parsed);
        return json(writeResult(value));
      }
      const value = stored.get(target!.endpoint);
      return json(page(value ? [row(value)] : []));
    });
    const memory = createAgentMemory(fake.fetchImpl);
    const [aliceReceipt, bobReceipt] = await Promise.all([memory.write(binding, envelope), memory.write(bob, bobEnvelope)]);
    const [aliceRead, bobRead] = await Promise.all([memory.read(binding, aliceReceipt), memory.read(bob, bobReceipt)]);
    expect(aliceRead).toEqual(envelope);
    expect(bobRead).toEqual(bobEnvelope);
    expect(new Set(fake.calls.map(call => call.url.origin))).toEqual(new Set([binding.endpoint, bob.endpoint]));
    await expect(memory.read(bob, aliceReceipt)).rejects.toMatchObject({ code: 'integrity' });
  });
  it('writes one structured approved attribute with stable operation idempotency, then verifies readback', async () => {
    let stored = '';
    const fake = transport((call) => {
      if (call.method === 'POST') {
        const triples = call.body?.triples as { value: string }[];
        stored = triples[0]!.value;
        return json(writeResult(stored));
      }
      return json(page(stored ? [row(envelope, { value: stored })] : []));
    });
    const memory = createAgentMemory(fake.fetchImpl);
    await expect(memory.write(binding, envelope)).resolves.toEqual(receipt);
    const post = fake.calls[1]!;
    expect(post.url.pathname).toBe('/api/v1/ctx_alice/facts');
    expect(post.headers.get('Authorization')).toBe('Bearer test-write-only');
    expect(post.headers.get('Idempotency-Key')).toBe(`maple-${createHash('sha256')
      .update(`${binding.endpoint}\0${binding.context}\0${binding.ownerId}\0${envelope.operationId}`).digest('hex')}`);
    expect(post.body).toEqual({
      infer: 'triples', scopes: [['maple/approved']], triples: [{
        entity: { type: 'person', name: entityName() }, key: 'employment_record',
        value: stored, memory_category: 'identity', source_clause: 'Confirmed Maple operation operation-one',
      }],
    });
    expect(JSON.parse(stored)).toEqual(envelope);
    expect(fake.calls[0]!.headers.get('Authorization')).toBe('Bearer test-read-only');
    expect(fake.calls[2]!.headers.get('Authorization')).toBe('Bearer test-read-only');
    expect(fake.calls.every((call) => call.redirect === 'error')).toBe(true);
    expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'POST', 'GET']);
    await expect(memory.write(binding, envelope)).rejects.toMatchObject({ code: 'conflict' });
    expect(fake.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  });

  it('hashes envelopes deterministically across property insertion order', () => {
    const reordered = Object.fromEntries(Object.entries(envelope).reverse()) as Envelope;
    expect(digestEnvelope(reordered)).toBe(receipt.digest);
    expect(digestEnvelope({ ...envelope, employment: { ...envelope.employment, employer: 'Other' } })).not.toBe(receipt.digest);
  });

  it('uses owner-bound Context and exact structural filters, including a short intermediate page', async () => {
    const fake = transport((_call, index) => json(index === 0 ? page([], 'next-page') : page([row()])));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, receipt)).resolves.toEqual(envelope);
    expect(fake.calls).toHaveLength(2);
    for (const call of fake.calls) {
      expect(call.method).toBe('GET');
      expect(call.url.pathname).toBe('/api/v1/ctx_alice/attributes');
      expect(call.url.searchParams.get('entity')).toBe(`person/${entityName()}`);
      expect(call.url.searchParams.get('key')).toBe('employment_record');
      expect(call.url.searchParams.get('limit')).toBe('100');
    }
    expect(fake.calls[1]!.url.searchParams.get('cursor')).toBe('next-page');
  });

  it.each([
    ['derived source', { source: { kind: 'consolidation' } }],
    ['conversation scope', { scope: [['maple/conversation']] }],
    ['co-owned scope', { scope: [['maple/approved'], ['other']] }],
    ['unscoped row', { scope: [] }],
    ['wrong entity', { entity: 'entity:person/other' }],
    ['wrong attribute', { key: 'other' }],
    ['decaying category', { memoryCategory: 'context' }],
    ['superseded row', { supersededBy: 'attribute:new' }],
    ['closed validity', { validUntil: '2026-01-01T00:00:00.000Z' }],
    ['future validity', { validFrom: '2099-01-01T00:00:00.000Z' }],
    ['broken history', { supersedes: 'attribute:unexpected' }],
    ['invalid JSON', { value: '{' }],
    ['wrong owner in value', { value: JSON.stringify({ ...envelope, ownerId: 'user_bob' }) }],
    ['modified fact value', { value: JSON.stringify({ ...envelope, employment: { ...envelope.employment, hoursPerWeek: 40 } }) }],
  ])('rejects %s even when the fact ID matches', async (_label, change) => {
    const fake = transport(() => json(page([row(envelope, change as Record<string, unknown>)])));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, receipt)).rejects.toMatchObject({ code: 'integrity' });
  });

  it('accepts the documented optional trailing slash on scope paths', async () => {
    const fake = transport(() => json(page([row(envelope, { scope: [['maple/approved/']] })])));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, receipt)).resolves.toEqual(envelope);
  });

  it('rejects a receipt from another Context or owner without accepting remote cross-talk', async () => {
    const other: Binding = { ownerId: 'user_bob', endpoint: 'https://bob.memory.example.test', context: 'ctx_bob', readKey: 'test-bob-read', writeKey: 'test-bob-write' };
    const fake = transport(() => json(page([row()])));
    await expect(createAgentMemory(fake.fetchImpl).read(other, receipt)).rejects.toMatchObject({ code: 'integrity' });
    expect(fake.calls[0]!.url.pathname).toBe('/api/v1/ctx_bob/attributes');
    expect(fake.calls[0]!.url.origin).toBe(other.endpoint);
    expect(fake.calls[0]!.url.searchParams.get('entity')).toBe(`person/${entityName(other.ownerId)}`);
    expect(fake.calls[0]!.headers.get('Authorization')).toBe('Bearer test-bob-read');
  });

  it('rejects multiple live values, including an unconfirmed derived contender', async () => {
    const fake = transport(() => json(page([row(), row(envelope, { id: 'attribute:derived', source: { kind: 'reflect' } })])));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, receipt)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('requires an exact receipt and does not substitute another live fact', async () => {
    const fake = transport(() => json(page([row(envelope, { id: 'attribute:replacement' })])));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, receipt)).rejects.toMatchObject({ code: 'integrity' });
  });

  it.each([
    ['missing pagination', { attributes: [row()] }],
    ['contradictory cursor', { attributes: [], page: { hasMore: false, nextCursor: 'more' } }],
    ['missing cursor', { attributes: [], page: { hasMore: true } }],
    ['invalid records', page([{ id: 'partial' }])],
  ])('fails closed on %s', async (_label, response) => {
    const fake = transport(() => json(response));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, receipt)).rejects.toMatchObject({ code: 'integrity' });
  });

  it('stops a repeated pagination cursor', async () => {
    const fake = transport(() => json(page([], 'loop')));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, receipt)).rejects.toMatchObject({ code: 'integrity' });
    expect(fake.calls).toHaveLength(2);
  });

  it('bounds an endless pagination walk without returning incomplete evidence', async () => {
    const fake = transport((_call, index) => json(page([], `page-${index}`)));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, receipt)).rejects.toMatchObject({ code: 'integrity' });
    expect(fake.calls).toHaveLength(20);
  });

  it('does not retry an uncertain write or expose upstream response details', async () => {
    const fake = transport((call) => call.method === 'GET' ? json(page([]))
      : json({ message: 'PRIVATE upstream diagnostic test-write-only' }, 503));
    const error = await createAgentMemory(fake.fetchImpl).write(binding, envelope).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(MemoryStorageError);
    expect(error).toMatchObject({ code: 'write_uncertain' });
    expect(String(error)).not.toContain('PRIVATE');
    expect(String(error)).not.toContain(binding.writeKey);
    expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'POST']);
  });

  it('marks success followed by failed readback uncertain', async () => {
    const fake = transport((call, index) => index === 0 ? json(page([])) : call.method === 'POST'
      ? json(writeResult((call.body?.triples as { value: string }[])[0]!.value))
      : json({ message: 'Unavailable' }, 503));
    await expect(createAgentMemory(fake.fetchImpl).write(binding, envelope)).rejects.toMatchObject({ code: 'write_uncertain' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'POST', 'GET']);
  });

  it('rejects a write response containing uncertainties before accepting a receipt', async () => {
    const fake = transport((call) => call.method === 'GET' ? json(page([])) : json({
      ...writeResult('anything'), extraction: { attributes: [], uncertainties: [{ id: 'uncertain' }], instructions: [], relations: [], actions: [] },
    }));
    await expect(createAgentMemory(fake.fetchImpl).write(binding, envelope)).rejects.toMatchObject({ code: 'write_uncertain' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'POST']);
  });

  it('refuses a first save into a nonempty remote Context before any POST', async () => {
    const fake = transport(() => json(page([row()])));
    await expect(createAgentMemory(fake.fetchImpl).write(binding, envelope)).rejects.toMatchObject({ code: 'conflict' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('checks the remote prior ID and revision before a replacement, then verifies its new head', async () => {
    const next: Envelope = { ...envelope, operationId: 'operation-two', revision: 2, previousFactId: 'attribute:old' };
    const fake = transport((call, index) => {
      if (index === 0) return json(page([row(envelope, { id: 'attribute:old' })]));
      if (call.method === 'POST') return json(writeResult((call.body?.triples as { value: string }[])[0]!.value));
      return json(page([row(next)]));
    });
    await expect(createAgentMemory(fake.fetchImpl).write(binding, next))
      .resolves.toEqual({ factId: receipt.factId, digest: digestEnvelope(next) });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'POST', 'GET']);
  });

  it.each([
    ['missing prior', []],
    ['wrong prior ID', [row(envelope, { id: 'attribute:unexpected' })]],
    ['conflicting heads', [row(), row(envelope, { id: 'attribute:other' })]],
  ])('does not POST when preflight finds %s', async (_label, attributes) => {
    const next: Envelope = { ...envelope, operationId: 'operation-two', revision: 2, previousFactId: receipt.factId };
    const fake = transport(() => json(page(attributes)));
    await expect(createAgentMemory(fake.fetchImpl).write(binding, next)).rejects.toMatchObject({ code: 'conflict' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it.each([
    ['derived prior', { source: { kind: 'consolidation' } }],
    ['wrong prior scope', { scope: [['maple/conversation']] }],
    ['wrong prior owner', { value: JSON.stringify({ ...envelope, ownerId: 'user_bob' }) }],
  ])('does not POST when preflight finds %s', async (_label, extra) => {
    const next: Envelope = { ...envelope, operationId: 'operation-two', revision: 2, previousFactId: receipt.factId };
    const fake = transport(() => json(page([row(envelope, extra)])));
    await expect(createAgentMemory(fake.fetchImpl).write(binding, next)).rejects.toMatchObject({ code: 'integrity' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('does not POST when the prior revision differs from the proposed predecessor', async () => {
    const next: Envelope = { ...envelope, operationId: 'operation-three', revision: 3, previousFactId: receipt.factId };
    const fake = transport(() => json(page([row()])));
    await expect(createAgentMemory(fake.fetchImpl).write(binding, next)).rejects.toMatchObject({ code: 'conflict' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('does not POST when the storage preflight is unavailable', async () => {
    const fake = transport(() => json({ message: 'Private diagnostic' }, 503));
    await expect(createAgentMemory(fake.fetchImpl).write(binding, envelope)).rejects.toMatchObject({ code: 'unavailable' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('cancels an oversized streamed response before SDK JSON parsing', async () => {
    let cancelled = false;
    const fake = transport(() => new Response(new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(300_000)); },
      cancel() { cancelled = true; },
    })));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, receipt)).rejects.toMatchObject({ code: 'unavailable' });
    expect(cancelled).toBe(true);
    expect(fake.calls).toHaveLength(1);
  });

  it('rejects a declared oversized response without accepting a successful save', async () => {
    const fake = transport((call) => call.method === 'GET' ? json(page([]))
      : new Response('{}', { headers: { 'Content-Length': '524289' } }));
    await expect(createAgentMemory(fake.fetchImpl).write(binding, envelope)).rejects.toMatchObject({ code: 'write_uncertain' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'POST']);
  });

  it('reconciles a previously uncertain write solely by exact read-only evidence', async () => {
    const fake = transport(() => json(page([row()])));
    await expect(createAgentMemory(fake.fetchImpl).reconcile(binding, envelope)).resolves.toEqual(receipt);
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('does not infer commit from the same operation ID with a different envelope', async () => {
    const altered = { ...envelope, employment: { ...envelope.employment, hoursPerWeek: 40 } };
    const fake = transport(() => json(page([row(altered)])));
    await expect(createAgentMemory(fake.fetchImpl).reconcile(binding, envelope)).rejects.toMatchObject({ code: 'conflict' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('returns no reconciled receipt when only the previous revision is visible, without resending', async () => {
    const next: Envelope = { ...envelope, operationId: 'operation-two', revision: 2, previousFactId: receipt.factId };
    const fake = transport(() => json(page([row()])));
    await expect(createAgentMemory(fake.fetchImpl).reconcile(binding, next)).resolves.toBeNull();
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('returns null on an empty reconciliation read, not a successful save', async () => {
    const fake = transport(() => json(page([])));
    await expect(createAgentMemory(fake.fetchImpl).reconcile(binding, envelope)).resolves.toBeNull();
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('accepts a later revision only with its matching AM supersession link', async () => {
    const next: Envelope = { ...envelope, operationId: 'operation-two', revision: 2, previousFactId: 'attribute:old' };
    const fake = transport(() => json(page([row(next)])));
    await expect(createAgentMemory(fake.fetchImpl).read(binding, { factId: receipt.factId, digest: digestEnvelope(next) })).resolves.toEqual(next);
  });

  it('fails before transport on missing config or an envelope owned by another user', async () => {
    const fake = transport(() => { throw new Error('Should not be called'); });
    const memory = createAgentMemory(fake.fetchImpl);
    await expect(memory.write({ ...binding, context: '../other' }, envelope)).rejects.toMatchObject({ code: 'integrity' });
    await expect(memory.write({ ...binding, writeKey: '' }, envelope)).rejects.toMatchObject({ code: 'integrity' });
    await expect(memory.write(binding, { ...envelope, ownerId: 'user_bob' })).rejects.toMatchObject({ code: 'integrity' });
    expect(fake.calls).toHaveLength(0);
  });

  it.each(['', 'http://memory.example.test', 'https://user:password@memory.example.test', `${endpoint}/unexpected`, `${endpoint}?token=x`])(
    'rejects an unsafe bound endpoint before sending credentials', async (url) => {
      const fake = transport(() => { throw new Error('Should never reach transport'); });
      await expect(createAgentMemory(fake.fetchImpl).read({ ...binding, endpoint: url }, receipt)).rejects.toBeInstanceOf(MemoryStorageError);
      expect(fake.calls).toHaveLength(0);
    },
  );
});
