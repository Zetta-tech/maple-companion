import { createHash } from 'node:crypto';
import { AgentMemory } from '@surrealdb/memory';
import type { Binding } from './am.js';

/** Server-owned identity mapping. Never construct this from a message or request body. */
export type NativeBinding = Binding & {
  principalId: string;
  principalMode: 'token' | 'delegated';
  scope: string;
};
export type NativeSession = {
  ownerId: string; context: string; principalId: string; scope: string; sessionId: string;
};
export interface NativeSessions {
  load(ownerId: string, sessionId: string): Promise<NativeSession | null>;
  save(session: NativeSession): Promise<void>;
}
export class NativeMemoryError extends Error {
  constructor(readonly code: 'binding' | 'identity' | 'session' | 'unavailable' | 'write_uncertain') {
    super(`Native memory ${code}.`);
  }
}
type State = Awaited<ReturnType<AgentMemory['state']>>;

/**
 * Called through the development-gated native coordinator. This adapter uses
 * native memory without translating attributes into a second canonical profile.
 * The caller must durably claim an operation before invoking a write. The
 * provider's idempotency receipt is time-limited, not a permanent replay guard.
 */
export function createNativeMemory(resolve: (ownerId: string) => NativeBinding,
  sessions: NativeSessions, fetchImpl: typeof fetch = globalThis.fetch) {
  function bindingFor(ownerId: string): NativeBinding {
    const binding = resolve(ownerId);
    if (!binding || binding.ownerId !== ownerId || !/^user_[a-zA-Z0-9]+$/.test(ownerId)
      || !/^[a-zA-Z0-9_-]+$/.test(binding.context) || !/^[a-zA-Z0-9_-]+$/.test(binding.principalId)
      || !['token', 'delegated'].includes(binding.principalMode)
      || !binding.scope || binding.scope.startsWith('/') || binding.scope.endsWith('/')
      || !/^[a-zA-Z0-9_/-]+$/.test(binding.scope)) throw new NativeMemoryError('binding');
    let endpoint: URL;
    try { endpoint = new URL(binding.endpoint); } catch { throw new NativeMemoryError('binding'); }
    if (endpoint.protocol !== 'https:' || endpoint.origin !== binding.endpoint || endpoint.username || endpoint.password
      || !binding.readKey?.trim() || !binding.writeKey?.trim()) throw new NativeMemoryError('binding');
    return binding;
  }

  async function clientFor(binding: NativeBinding, mode: 'read' | 'write', operationId?: string) {
    const prefix = `/api/v1/${binding.context}/`;
    const client = new AgentMemory({ endpoint: binding.endpoint, context: binding.context,
      apiKey: mode === 'read' ? binding.readKey : binding.writeKey, maxRetries: 0,
      fetchImpl: async (input, init) => {
        const target = new URL(input instanceof Request ? input.url : input.toString());
        const method = init?.method ?? 'GET';
        const resource = target.pathname.slice(prefix.length);
        const allowed = method === 'GET' && ['me', 'state', 'profile'].includes(resource)
          || mode === 'write' && method === 'POST' && ['sessions', 'facts'].includes(resource);
        if (target.origin !== binding.endpoint || !target.pathname.startsWith(prefix) || !allowed)
          throw new NativeMemoryError('binding');
        const headers = new Headers(init?.headers);
        if (method === 'POST') {
          if (!operationId?.trim()) throw new NativeMemoryError('binding');
          const hash = createHash('sha256').update(JSON.stringify([
            binding.endpoint, binding.context, binding.ownerId, binding.principalId, resource, operationId,
          ])).digest('hex');
          headers.set('Idempotency-Key', `maple-native-${hash}`);
        }
        return fetchImpl(input, { ...init, headers, redirect: 'error' });
      },
    });
    // Delegation is opt-in server configuration for an already provisioned
    // principal. This code never creates principals, keys, or grants.
    const scoped = binding.principalMode === 'delegated' ? client.onBehalfOf(`principal:${binding.principalId}`) : client;
    let identity: Awaited<ReturnType<AgentMemory['whoami']>>;
    try { identity = await scoped.whoami(); } catch { throw new NativeMemoryError('unavailable'); }
    const effectiveId = binding.principalMode === 'delegated' ? identity.delegatedPrincipalId : identity.principalId;
    if (effectiveId?.replace(/^principal:/, '') !== binding.principalId
      || binding.principalMode === 'token' && identity.delegatedPrincipalId) throw new NativeMemoryError('identity');
    return scoped;
  }

  async function snapshot(client: AgentMemory) {
    const state = await client.state({ limit: 500 }); // Documented state endpoint maximum.
    const profile = await client.profile();
    return { state, profile, complete: !Object.values(state.truncated).some(Boolean) };
  }
  function attributes(state: State) {
    return [...state.identity.attributes, ...state.knowledge.attributes, ...state.context.attributes];
  }

  return {
    async createSession(ownerId: string, operationId: string): Promise<NativeSession> {
      const binding = bindingFor(ownerId);
      const client = await clientFor(binding, 'write', operationId);
      try {
        const created = await client.sessions.create({ scopes: [[binding.scope]] });
        if (!created.id) throw new Error('Missing session');
        const session = { ownerId, context: binding.context, principalId: binding.principalId,
          scope: binding.scope, sessionId: created.id };
        await sessions.save(session);
        return session;
      } catch { throw new NativeMemoryError('write_uncertain'); }
    },
    async read(ownerId: string) {
      const client = await clientFor(bindingFor(ownerId), 'read');
      try { return await snapshot(client); } catch { throw new NativeMemoryError('unavailable'); }
    },
    async remember(ownerId: string, sessionId: string, message: string, operationId: string) {
      const binding = bindingFor(ownerId);
      const session = await sessions.load(ownerId, sessionId);
      if (!session || session.ownerId !== ownerId || session.sessionId !== sessionId
        || session.context !== binding.context || session.principalId !== binding.principalId || session.scope !== binding.scope)
        throw new NativeMemoryError('session');
      if (typeof message !== 'string' || !message.trim()) throw new NativeMemoryError('binding');
      const client = await clientFor(binding, 'write', operationId);
      try {
        const ingestion = await client.remember(message, { infer: 'full', role: 'user', sessionId, scopes: [[binding.scope]] });
        if (ingestion.mode !== 'full' || ingestion.preview || ingestion.sessionId !== sessionId || !ingestion.extraction)
          throw new Error('Unexpected ingestion response');
        const current = await snapshot(client);
        const visible = attributes(current.state);
        // Extraction is evidence, not proof of durable current state. Preserve
        // all native fields/uncertainties/corrections; never coerce unknown keys.
        const attributeVisibility = ingestion.extraction.attributes.map(attribute => ({
          id: attribute.id, foundInState: visible.some(row => row.id === attribute.id),
        }));
        return { ingestion, ...current, attributeVisibility };
      } catch { throw new NativeMemoryError('write_uncertain'); }
    },
  };
}
