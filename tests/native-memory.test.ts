import { describe, expect, it } from 'vitest';
import { createNativeMemory, type NativeBinding, type NativeSession } from '../server/native-memory.js';

// SDK transport contracts only: these fixtures do not test model understanding.
const binding: NativeBinding = { ownerId: 'user_alice', context: 'ctx_alice', endpoint: 'https://memory.example.test',
  readKey: 'fixture-read', writeKey: 'fixture-write', principalId: 'alice', principalMode: 'token', scope: 'user/alice' };
const session: NativeSession = { ownerId: binding.ownerId, context: binding.context, principalId: binding.principalId,
  scope: binding.scope, sessionId: 'session_one' };
const emptyState = () => ({ identity: { attributes: [] }, knowledge: { attributes: [] }, context: { attributes: [] },
  truncated: { attributes: false, entities: false, instructions: false, relations: false, actions: false, unknowns: false } });
const extraction = { entities: [], attributes: [{ id: 'attr_one', entityId: 'principal:alice', key: 'work_schedule', value: '31 hours per week', memoryCategory: 'context' }],
  relations: [], actions: [], instructions: [], uncertainties: [], corrections: [] };
type Options = { binding?: NativeBinding; stored?: NativeSession | null; identity?: object; missing?: boolean; truncated?: boolean; failWrite?: boolean; failReadback?: boolean };
function harness(options: Options = {}) {
  const b = options.binding ?? binding;
  const calls: { method: string; path: string; headers: Headers; body: unknown }[] = [];
  let stored: NativeSession | null = options.stored === undefined ? session : options.stored;
  const adapter = createNativeMemory(() => b, {
    load: async () => stored,
    save: async value => { stored = value; },
  }, async (input, init) => {
    const url = new URL(String(input));
    calls.push({ method: init?.method ?? 'GET', path: url.pathname, headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    const resource = url.pathname.split('/').at(-1);
    let body: unknown;
    if (resource === 'me') body = options.identity ?? { principalId: 'alice' };
    else if (resource === 'sessions') body = { id: 'session_new', createdAt: new Date().toISOString(), scopes: [[b.scope]] };
    else if (resource === 'facts') {
      if (options.failWrite) throw Error('Transport failed');
      body = { mode: 'full', preview: false, sessionId: 'session_one', turnId: 'turn_one', extraction };
    } else if (resource === 'state') {
      if (options.failReadback) throw Error('Readback failed');
      const state: ReturnType<typeof emptyState> & { context: { attributes: object[] } } = emptyState();
      if (!options.missing) state.context.attributes.push({ id: 'attr_one', key: 'work_schedule', value: '31 hours per week' });
      state.truncated.attributes = options.truncated ?? false;
      body = state;
    } else if (resource === 'profile') body = { selfFacts: [], static: [], dynamic: [], preferences: [], instructions: [] };
    else throw Error('Unexpected request');
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return { adapter, calls, stored: () => stored };
}

describe('inactive native raw-turn adapter', () => {
  it('sends the exact user message through full inference, preserving native output without the label mapper', async () => {
    const h = harness();
    const text = "I'm Mira TestHours. My actual work schedule is 31 hours per week.";
    const result = await h.adapter.remember('user_alice', 'session_one', text, 'operation_one');
    expect(h.calls.find(c => c.path.endsWith('/facts'))?.body).toEqual({ text, infer: 'full', role: 'user', session_id: 'session_one', scopes: [['user/alice']] });
    expect(result.ingestion.extraction).toEqual(extraction);
    expect(result.attributeVisibility).toEqual([{ id: 'attr_one', foundInState: true }]);
    expect(h.calls.every(c => !c.headers.has('X-Spectron-On-Behalf-Of'))).toBe(true);
  });
  it('reports an absent extraction attribute honestly rather than treating extraction as successful readback', async () => {
    const h = harness({ missing: true });
    const result = await h.adapter.remember('user_alice', 'session_one', 'My schedule is 31 hours per week.', 'operation_one');
    expect(result.attributeVisibility).toEqual([{ id: 'attr_one', foundInState: false }]);
    expect(result.complete).toBe(true);
  });
  it('marks a truncated snapshot incomplete', async () => {
    expect((await harness({ truncated: true }).adapter.read('user_alice')).complete).toBe(false);
  });
  it('rejects cross-owner routing before any request', async () => {
    const h = harness();
    await expect(h.adapter.read('user_bob')).rejects.toMatchObject({ code: 'binding' });
    expect(h.calls).toHaveLength(0);
  });
  it.each(['ownerId', 'context', 'principalId', 'scope', 'sessionId'] as const)('rejects a mismatched stored session %s before any request', async field => {
    const h = harness({ stored: { ...session, [field]: 'different' } });
    await expect(h.adapter.remember('user_alice', 'session_one', 'My schedule is 31 hours per week.', 'op')).rejects.toMatchObject({ code: 'session' });
    expect(h.calls).toHaveLength(0);
  });
  it('refuses a key resolving to another principal before ingestion', async () => {
    const h = harness({ identity: { principalId: 'bob' } });
    await expect(h.adapter.remember('user_alice', 'session_one', 'My schedule is 31 hours per week.', 'op')).rejects.toMatchObject({ code: 'identity' });
    expect(h.calls.map(c => c.method)).toEqual(['GET']);
  });
  it('keeps an explicitly configured delegation on identity, ingestion and every read', async () => {
    const h = harness({ binding: { ...binding, principalMode: 'delegated' }, identity: { principalId: 'service', delegatedPrincipalId: 'alice' } });
    await h.adapter.remember('user_alice', 'session_one', 'My schedule is 31 hours per week.', 'op');
    expect(h.calls.every(c => c.headers.get('X-Spectron-On-Behalf-Of') === 'principal:alice')).toBe(true);
  });
  it('does not silently fall back when delegation is not reflected by the provider', async () => {
    const h = harness({ binding: { ...binding, principalMode: 'delegated' }, identity: { principalId: 'service' } });
    await expect(h.adapter.read('user_alice')).rejects.toMatchObject({ code: 'identity' });
    expect(h.calls).toHaveLength(1);
  });
  it.each([{ failWrite: true }, { failReadback: true }])('does not retry an uncertain write or readback failure %j', async options => {
    const h = harness(options);
    await expect(h.adapter.remember('user_alice', 'session_one', 'My schedule is 31 hours per week.', 'op')).rejects.toMatchObject({ code: 'write_uncertain' });
    expect(h.calls.filter(c => c.path.endsWith('/facts'))).toHaveLength(1);
  });
  it('registers new sessions against the verified owner and principal without provisioning access', async () => {
    const h = harness();
    await h.adapter.createSession('user_alice', 'op_session');
    expect(h.stored()).toEqual({ ...session, sessionId: 'session_new' });
    expect(h.calls.map(c => c.path.split('/').at(-1))).toEqual(['me', 'sessions']);
  });
});
