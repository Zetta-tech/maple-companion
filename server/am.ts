import { createHash } from 'node:crypto';
import { AgentMemory } from '@surrealdb/memory';
import { z } from 'zod';
import { employmentSchema, type Employment } from '../shared/employment.js';

export type Binding = { ownerId: string; endpoint: string; context: string; readKey: string; writeKey: string;
  nativePrincipalId?: string; nativeScope?: string };
export type Envelope = {
  schema: 1;
  ownerId: string;
  operationId: string;
  revision: number;
  previousFactId: string | null;
  confirmedAt: string;
  employment: Employment;
};
export type Receipt = { factId: string; digest: string };
export interface MemoryPort {
  read(binding: Binding, receipt: Receipt): Promise<Envelope>;
  write(binding: Binding, envelope: Envelope): Promise<Receipt>;
  reconcile(binding: Binding, envelope: Envelope): Promise<Receipt | null>;
}

const APPROVED_SCOPE = 'maple/approved';
const ATTRIBUTE_KEY = 'employment_record';
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const MAX_ROWS = PAGE_SIZE * MAX_PAGES;
const MAX_RESPONSE_BYTES = 512 * 1024;
const identifier = z.string().min(1).max(512);
const envelopeSchema = z.strictObject({
  schema: z.literal(1),
  ownerId: identifier,
  operationId: identifier,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  previousFactId: identifier.nullable(),
  confirmedAt: z.iso.datetime(),
  employment: employmentSchema,
}).superRefine((value, context) => {
  if ((value.revision === 1) !== (value.previousFactId === null)) {
    context.addIssue({ code: 'custom', message: 'Invalid revision chain.' });
  }
});
const receiptSchema = z.strictObject({ factId: identifier, digest: z.string().regex(/^[a-f0-9]{64}$/) });
const attributeSchema = z.object({
  id: identifier,
  entity: identifier,
  key: z.string(),
  value: z.string().max(50_000),
  memoryCategory: z.string(),
  scope: z.array(z.array(z.string())),
  source: z.object({ kind: z.string() }).nullable().optional(),
  supersedes: identifier.nullable().optional(),
  supersededBy: identifier.nullable().optional(),
  validFrom: z.iso.datetime({ offset: true }).nullable().optional(),
  validUntil: z.iso.datetime({ offset: true }).nullable().optional(),
});
type Attribute = z.infer<typeof attributeSchema>;
const pageSchema = z.object({
  attributes: z.array(attributeSchema).max(PAGE_SIZE),
  page: z.object({
    hasMore: z.boolean(),
    nextCursor: z.string().min(1).max(4096).nullable().optional(),
  }),
});
const writeResponseSchema = z.object({
  mode: z.literal('triples'),
  preview: z.literal(false).optional(),
  sessionId: identifier,
  extraction: z.object({
    attributes: z.array(z.object({
      id: identifier, entityId: identifier, key: z.string(), value: z.string(), memoryCategory: z.string(),
    })).length(1),
    uncertainties: z.array(z.unknown()).length(0),
    instructions: z.array(z.unknown()).length(0),
    relations: z.array(z.unknown()).length(0),
    actions: z.array(z.unknown()).length(0),
  }),
});

export class MemoryStorageError extends Error {
  constructor(readonly code: 'unavailable' | 'integrity' | 'conflict' | 'write_uncertain') {
    super(code === 'write_uncertain'
      ? 'The memory write outcome is uncertain. Reconciliation is required.'
      : 'Memory could not be verified. No confirmed information was returned.');
    this.name = 'MemoryStorageError';
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Bound bytes before the SDK's response.text()/JSON.parse(), including chunked responses. */
async function boundedResponse(response: Response): Promise<Response> {
  const declaredLength = response.headers.get('Content-Length');
  if (declaredLength !== null && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new MemoryStorageError('integrity');
  }
  if (!response.body) return response;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new MemoryStorageError('integrity');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(bytes, { status: response.status, headers: response.headers });
}

/** Stable across property insertion order; the caller must supply a valid envelope. */
export function digestEnvelope(envelope: Envelope): string {
  const parsed = envelopeSchema.safeParse(envelope);
  if (!parsed.success) throw new MemoryStorageError('integrity');
  return hash(canonicalJson(parsed.data));
}

function entityName(binding: Binding): string {
  return `maple-${hash(binding.ownerId)}`;
}

function validateBinding(binding: Binding): void {
  if (!binding || !identifier.safeParse(binding.ownerId).success
    || !/^[A-Za-z0-9_-]{1,128}$/.test(binding.context)
    || typeof binding.readKey !== 'string' || !binding.readKey.trim()
    || typeof binding.writeKey !== 'string' || !binding.writeKey.trim()) {
    throw new MemoryStorageError('integrity');
  }
  validateEndpoint(binding.endpoint);
}

function validateEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.origin !== endpoint || url.username || url.password) throw new Error();
    return url.origin;
  } catch { throw new MemoryStorageError('integrity'); }
}

function boundEnvelope(binding: Binding, value: unknown): Envelope {
  const result = envelopeSchema.safeParse(value);
  if (!result.success || result.data.ownerId !== binding.ownerId) throw new MemoryStorageError('integrity');
  return result.data;
}

function parseAttribute(binding: Binding, row: Attribute): Envelope {
  const exactScope = row.scope.length === 1 && row.scope[0]?.length === 1
    && row.scope[0][0]?.replace(/\/$/, '') === APPROVED_SCOPE;
  if (row.entity !== `entity:person/${entityName(binding)}` || row.key !== ATTRIBUTE_KEY
    || row.memoryCategory !== 'identity' || !exactScope || row.source?.kind !== 'upsert'
    || row.supersededBy || row.validUntil
    || (row.validFrom && Date.parse(row.validFrom) > Date.now())) {
    throw new MemoryStorageError('integrity');
  }
  let value: unknown;
  try { value = JSON.parse(row.value); } catch { throw new MemoryStorageError('integrity'); }
  const envelope = boundEnvelope(binding, value);
  if ((row.supersedes ?? null) !== envelope.previousFactId) throw new MemoryStorageError('integrity');
  return envelope;
}

/**
 * Real SDK adapter. No simulator or fallback exists here. Bindings come only from
 * the server's owner registry. Grants and Context isolation still require live QA.
 */
export function createAgentMemory(fetchImpl: typeof fetch = globalThis.fetch): MemoryPort {
  function client(binding: Binding, mode: 'read' | 'write', operationId?: string): AgentMemory {
    validateBinding(binding);
    // Hosted AM assigns a different host to each Context. Never use a global host
    // or accept routing from an HTTP/model input; the owner's binding owns both.
    const origin = validateEndpoint(binding.endpoint);
    const path = `/api/v1/${binding.context}/${mode === 'read' ? 'attributes' : 'facts'}`;
    const guardedFetch: typeof fetch = async (input, init) => {
      const target = new URL(input instanceof Request ? input.url : input.toString());
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (target.origin !== origin || target.pathname !== path
        || method !== (mode === 'read' ? 'GET' : 'POST')) throw new MemoryStorageError('integrity');
      const headers = new Headers(init?.headers);
      if (mode === 'write') {
        // SDK keys use a 30s time bucket. Override with one durable operation key.
        // A changed body with the same operation ID must conflict, not get a new key.
        headers.set('Idempotency-Key', `maple-${hash(`${origin}\0${binding.context}\0${binding.ownerId}\0${operationId}`)}`);
      }
      return boundedResponse(await fetchImpl(input, { ...init, headers, redirect: 'error' }));
    };
    return new AgentMemory({
      endpoint: origin,
      context: binding.context,
      apiKey: mode === 'read' ? binding.readKey : binding.writeKey,
      maxRetries: 0,
      timeoutMs: 10_000,
      fetchImpl: guardedFetch,
    });
  }

  async function currentRows(binding: Binding): Promise<Attribute[]> {
    const reader = client(binding, 'read');
    const rows: Attribute[] = [];
    const cursors = new Set<string>();
    const ids = new Set<string>();
    let cursor: string | undefined;
    for (let index = 0; index < MAX_PAGES; index++) {
      let wire: unknown;
      try {
        wire = await reader.facts.attributes({ entity: `person/${entityName(binding)}`, key: ATTRIBUTE_KEY, limit: PAGE_SIZE, cursor });
      } catch { throw new MemoryStorageError('unavailable'); }
      const parsed = pageSchema.safeParse(wire);
      if (!parsed.success) throw new MemoryStorageError('integrity');
      for (const row of parsed.data.attributes) {
        if (ids.has(row.id)) throw new MemoryStorageError('integrity');
        ids.add(row.id);
        rows.push(row);
      }
      if (rows.length > MAX_ROWS) throw new MemoryStorageError('integrity');
      const next = parsed.data.page.nextCursor ?? undefined;
      if (parsed.data.page.hasMore !== Boolean(next)) throw new MemoryStorageError('integrity');
      if (!next) return rows;
      if (cursors.has(next)) throw new MemoryStorageError('integrity');
      cursors.add(next);
      cursor = next;
    }
    throw new MemoryStorageError('integrity');
  }

  async function read(binding: Binding, receipt: Receipt): Promise<Envelope> {
    validateBinding(binding);
    if (!receiptSchema.safeParse(receipt).success) throw new MemoryStorageError('integrity');
    const rows = await currentRows(binding);
    if (rows.length > 1) throw new MemoryStorageError('conflict');
    const row = rows[0];
    if (!row || row.id !== receipt.factId) throw new MemoryStorageError('integrity');
    const envelope = parseAttribute(binding, row);
    if (digestEnvelope(envelope) !== receipt.digest) throw new MemoryStorageError('integrity');
    return envelope;
  }

  return {
    read,
    async write(binding, input) {
      validateBinding(binding);
      const envelope = boundEnvelope(binding, input);
      // A fresh local journal does not establish that the remote Context is empty.
      // Refuse an unexpected head before sending anything that could supersede it.
      const before = await currentRows(binding);
      if (envelope.previousFactId === null) {
        if (before.length !== 0) throw new MemoryStorageError('conflict');
      } else {
        const previous = before[0];
        if (before.length !== 1 || !previous || previous.id !== envelope.previousFactId) {
          throw new MemoryStorageError('conflict');
        }
        if (parseAttribute(binding, previous).revision !== envelope.revision - 1) {
          throw new MemoryStorageError('conflict');
        }
      }
      // This preflight is not server-side CAS. Owner serialization and exclusive
      // write credentials remain mandatory; readback catches an unexpected race.
      const value = canonicalJson(envelope);
      const writer = client(binding, 'write', envelope.operationId);
      try {
        const response = writeResponseSchema.parse(await writer.remember(undefined, {
          infer: 'triples',
          scopes: [[APPROVED_SCOPE]],
          triples: [{
            entity: { type: 'person', name: entityName(binding) },
            key: ATTRIBUTE_KEY,
            value,
            memory_category: 'identity',
            source_clause: `Confirmed Maple operation ${envelope.operationId}`,
          }],
        }));
        const attribute = response.extraction.attributes[0]!;
        if (attribute.key !== ATTRIBUTE_KEY || attribute.value !== value || attribute.memoryCategory !== 'identity') {
          throw new MemoryStorageError('integrity');
        }
        const receipt = { factId: attribute.id, digest: digestEnvelope(envelope) };
        await read(binding, receipt);
        return receipt;
      } catch {
        // A rejected/invalid response, timeout, or failed readback cannot prove that
        // nothing committed. The workflow must persist uncertainty and reconcile.
        throw new MemoryStorageError('write_uncertain');
      }
    },
    async reconcile(binding, input) {
      validateBinding(binding);
      const envelope = boundEnvelope(binding, input);
      const digest = digestEnvelope(envelope);
      const rows = await currentRows(binding);
      if (rows.length > 1) throw new MemoryStorageError('conflict');
      const row = rows[0];
      if (!row) return null; // Absence is not proof that an uncertain write never ran.
      const stored = parseAttribute(binding, row);
      if (stored.operationId === envelope.operationId && digestEnvelope(stored) === digest) {
        return { factId: row.id, digest };
      }
      if (row.id === envelope.previousFactId && stored.revision === envelope.revision - 1) return null;
      throw new MemoryStorageError('conflict');
    },
  };
}
