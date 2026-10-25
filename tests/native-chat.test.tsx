import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import request from 'supertest';
import { NativeChat } from '../server/native-chat.js';
import type { NativeChatStore } from '../server/native-chat-store.js';
import type { NativeSession, createNativeMemory } from '../server/native-memory.js';
import { NATIVE_MESSAGE_MAX_LENGTH, nativeMessageTextSchema, nativeStatusText, type NativeMessageResult } from '../shared/native-chat.js';
import { nativePendingAfterFailure, readResponse, RequestError } from '../web/request.js';
import { NativeMemoryPanel, NativeMemoryView } from '../web/NativeMemoryPanel.js';
import { createApp } from '../server/app.js';
import { Workflow } from '../server/workflow.js';
import { Journal } from '../server/journal.js';
import { TestMemory } from './support/test-memory.js';
import { AppError } from '../server/errors.js';

const owner = 'user_alice';
const binding = { ownerId: owner, context: 'ctx', endpoint: 'https://memory.example.test', readKey: 'fixture-read', writeKey: 'fixture-write' };
function setup(found = true, syntheticOnly = true) {
  const records = new Map<string, { digest: string; result: NativeMessageResult | null }>();
  const sessions = new Map<string, NativeSession>();
  const key = (owner: string, id: string) => JSON.stringify([owner, id]);
  const store: NativeChatStore = {
    load: async (owner, id) => sessions.get(key(owner, id)) ?? null,
    save: async session => { sessions.set(key(session.ownerId, session.sessionId), session); },
    current: async owner => [...sessions.values()].find(s => s.ownerId === owner) ?? null,
    claim: async (owner, id, digest) => {
      const row = records.get(key(owner, id));
      if (row) { if (row.digest !== digest) throw new AppError(409, 'NATIVE_REQUEST_CONFLICT', 'Conflict'); return row.result!; }
      records.set(key(owner, id), { digest, result: null }); return null;
    },
    finish: async (owner, result) => {
      const completed = { ...result, completion: { version: 1 as const, employmentRevision: 0 } };
      records.get(key(owner, result.requestId))!.result = completed; return completed;
    },
    list: async owner => [...records.entries()].filter(([k]) => JSON.parse(k)[0] === owner).flatMap(([, v]) => v.result ? [v.result] : []),
  };
  const profile = { selfFacts: found ? [{ entity: 'Mira', key: 'work_hours', value: '28 hours per week' }] : [], static: [], dynamic: [], preferences: [], instructions: [] };
  const snapshot = { state: { unknowns: [], truncated: {}, identity: { attributes: [] }, knowledge: { attributes: [] }, context: { attributes: [] } }, profile, complete: true };
  const memory = {
    createSession: vi.fn(async (owner: string) => {
      const session = { ownerId: owner, sessionId: 'newsession', context: 'ctx', principalId: 'principal', scope: 'conversation' };
      await store.save(session); return session;
    }),
    read: vi.fn(async () => snapshot),
    remember: vi.fn(async () => ({ ...snapshot, ingestion: { mode: 'full', sessionId: 'newsession', preview: false,
      extraction: { attributes: [{ id: 'attr', key: 'work_hours', value: '28 hours per week' }], uncertainties: [], corrections: [] } },
      attributeVisibility: [{ id: 'attr', foundInState: found }] })),
  };
  const diagnostics = vi.fn(async (_owner: string, _requestId: string, _evidence: unknown) => {});
  const chat = new NativeChat(store, memory as unknown as ReturnType<typeof createNativeMemory>, diagnostics, () => new Date(), syntheticOnly);
  return { chat, memory, store, diagnostics };
}

describe('native memory workflow (test transport only)', () => {
  it('separates explicitly configured personal input from fictional trial input before a claim', async () => {
    const real = setup(true, false), trial = setup();
    const body = { requestId: randomUUID(), message: 'Synthetic transport test of the real-input contract.', syntheticTest: false };
    await expect(trial.chat.send(owner, body)).rejects.toThrow();
    expect(trial.memory.remember).not.toHaveBeenCalled();
    await expect(real.chat.send(owner, { ...body, syntheticTest: true })).rejects.toThrow();
    expect(real.memory.remember).not.toHaveBeenCalled();
    expect((await real.chat.send(owner, body)).status).toBe('verified');
    expect(real.memory.remember).toHaveBeenCalledOnce();
  });
  it('passes unchanged natural text, retains native evidence and deduplicates the same request', async () => {
    const { chat, memory, diagnostics } = setup();
    const body = { requestId: randomUUID(), message: 'Correction: I currently work 28 hours per week, not 29.', syntheticTest: true };
    const result = await chat.send(owner, body);
    expect(result.status).toBe('verified');
    expect(memory.remember).toHaveBeenCalledWith(owner, 'newsession', body.message, body.requestId);
    expect(diagnostics.mock.calls[0]?.[2]).toMatchObject({ input: body.message, response: { ingestion: { extraction: { attributes: [{ key: 'work_hours' }] } } } });
    expect(await chat.send(owner, body)).toEqual(result);
    expect(memory.remember).toHaveBeenCalledTimes(1);
    await expect(chat.send(owner, { ...body, message: 'Different message' })).rejects.toMatchObject({ code: 'NATIVE_REQUEST_CONFLICT' });
    expect(await chat.history('user_bob')).toEqual([]);
  });
  it('keeps missing current-read facts unverified and does not claim saved success', async () => {
    const { chat } = setup(false);
    const result = await chat.send(owner, { requestId: randomUUID(), message: 'I work 28 hours a week.', syntheticTest: true });
    expect(result.status).toBe('unverified');
    const html = renderToStaticMarkup(<NativeMemoryView profile={{ checkedAt: new Date().toISOString(), complete: true, facts: [], instructions: [], unresolved: 0 }} history={[result]} />);
    expect(html).toContain('Update needs checking');
    expect(html).toContain(nativeStatusText.unverified);
    expect(html).toContain('Your earlier messages may still be stored');
    expect(html).not.toContain('Update confirmed');
  });
  it('records uncertainty rather than retrying a provider failure', async () => {
    const { chat, memory } = setup();
    memory.remember.mockRejectedValueOnce(new Error('Do not expose provider detail'));
    const result = await chat.send(owner, { requestId: randomUUID(), message: 'I work 28 hours.', syntheticTest: true });
    expect(result.status).toBe('uncertain');
    expect(JSON.stringify(result)).not.toContain('provider detail');
    expect(memory.remember).toHaveBeenCalledTimes(1);
  });
  it('does not expose raw provider evidence or other-entity legacy envelopes in the native profile', async () => {
    const { chat } = setup();
    const profile = await chat.profile(owner);
    expect(profile.facts).toEqual([{ entity: 'Mira', key: 'work_hours', value: '28 hours per week' }]);
    expect(profile).not.toHaveProperty('state');
    expect(profile).not.toHaveProperty('response');
  });
  it('renders plain status copy for historical receipts without changing their saved outcome', () => {
    const receipt: NativeMessageResult = { requestId: randomUUID(), status: 'unverified',
      message: 'AM processed this message. No saved-success claim is being made.',
      createdAt: '2026-10-25T03:54:55.649Z', warnings: ['Provider explanation'] };
    const original = JSON.stringify(receipt);
    const html = renderToStaticMarkup(<NativeMemoryView profile={null} history={[receipt]} />);
    expect(html).toContain(nativeStatusText.unverified);
    expect(html).not.toContain('No saved-success claim');
    expect(html).not.toContain('Update confirmed');
    expect(html).toContain('<details><summary>More details</summary>');
    expect(JSON.stringify(receipt)).toBe(original);
  });
  it.each(['processing', 'uncertain'] as const)('keeps %s distinct from a confirmed or failed update', status => {
    const html = renderToStaticMarkup(<NativeMemoryView profile={null} history={[{
      requestId: randomUUID(), status, createdAt: '2026-10-25T03:54:55.649Z', message: '', warnings: [],
    }]} />);
    expect(html).toContain(nativeStatusText[status]);
    expect(html).toContain(status === 'processing' ? 'Updating your details' : 'Update status unknown');
    expect(html).not.toContain('Update confirmed');
    expect(html).not.toContain('failed');
  });
  it('uses a plain Send label and discloses stored messages and the current test limitation', () => {
    const html = renderToStaticMarkup(<NativeMemoryPanel request={async <T,>() => ({} as T)} onChanged={() => {}} />);
    expect(html).toContain('>Send</button>');
    expect(html).toContain('Your messages may be stored');
    expect(html).toContain('Conversational replies are not available yet');
    expect(html).not.toContain('Send to AM memory');
    expect(html).toContain(`maxLength="${NATIVE_MESSAGE_MAX_LENGTH}"`);
    expect(html).toContain('Up to 5,000 characters per update.');
  });
  it('escapes native text instead of executing markup', () => {
    const html = renderToStaticMarkup(<NativeMemoryView profile={{ checkedAt: new Date().toISOString(), complete: true,
      facts: [{ entity: 'You', key: 'note', value: '<script>bad()</script>' }], instructions: [], unresolved: 0 }} history={[]} />);
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>');
  });
  it('rejects unsupported owner fields and non-synthetic requests before provider access', async () => {
    const { chat, memory } = setup();
    await expect(chat.send(owner, { requestId: randomUUID(), message: 'hello', syntheticTest: true, ownerId: 'user_bob' })).rejects.toThrow();
    await expect(chat.send(owner, { requestId: randomUUID(), message: 'hello', syntheticTest: false })).rejects.toThrow();
    expect(memory.remember).not.toHaveBeenCalled();
  });
});

describe('native composer pre-send receipts versus uncertain outcomes', () => {
  function http() {
    const fixture = setup(), journal = new Journal(':memory:');
    const config = { origin: 'http://localhost:3000', publishableKey: 'pk_test_fixture', secretKey: 'sk_test_fixture',
      amAccessMode: 'single-user-development' as const, bindings: new Map([[owner, binding]]) };
    const authentication = { middleware: (_req: any, _res: any, next: () => void) => next(), owner: () => owner };
    const app = createApp({ config, nativeChat: fixture.chat, workflow: new Workflow(journal, new TestMemory(), () => binding), authentication });
    const claim = vi.spyOn(fixture.store, 'claim');
    const post = (body: object) => request(app).post('/api/native/messages').set('Origin', config.origin).send(body);
    return { ...fixture, journal, app, post, claim };
  }
  async function apiError(response: { status: number; body: unknown }) {
    try { await readResponse(new Response(JSON.stringify(response.body), { status: response.status })); }
    catch (error) { return error; }
    throw Error('Expected API rejection');
  }
  it('aligns client/server length checks with a payload that always fits the JSON body limit', async () => {
    const f = http();
    try {
      const body = { requestId: randomUUID(), message: '\u0000'.repeat(NATIVE_MESSAGE_MAX_LENGTH), syntheticTest: true };
      expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(32 * 1024);
      expect(nativeMessageTextSchema.safeParse(body.message).success).toBe(true);
      for (const message of [' ', 'x'.repeat(NATIVE_MESSAGE_MAX_LENGTH + 1)]) {
        expect(nativeMessageTextSchema.safeParse(message).success).toBe(false);
        const response = await f.post({ ...body, message });
        expect(response.status).toBe(400);
        expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED', nativeRequestState: 'not_started' });
        expect(nativePendingAfterFailure(body.requestId, await apiError(response))).toBeNull();
      }
      expect(f.claim).not.toHaveBeenCalled(); expect(f.memory.remember).not.toHaveBeenCalled();
    } finally { f.journal.close(); }
  });
  it('releases the pending ID on an actual Express 32 KiB rejection without a history record', async () => {
    const f = http(), id = randomUUID();
    try {
      const response = await f.post({ requestId: id, message: 'x'.repeat(33 * 1024), syntheticTest: true });
      expect(response.status).toBe(413);
      expect(response.body.error).toMatchObject({ code: 'BODY_TOO_LARGE', nativeRequestState: 'not_started' });
      expect(nativePendingAfterFailure(id, await apiError(response))).toBeNull();
      expect(f.claim).not.toHaveBeenCalled(); expect(f.memory.createSession).not.toHaveBeenCalled();
      expect(await f.chat.history(owner)).toEqual([]);
      // A deliberate edited resubmission can proceed; the app does not retry automatically.
      const next = await f.post({ requestId: randomUUID(), message: 'Synthetic correction.', syntheticTest: true });
      expect(next.status).toBe(200); expect(f.memory.remember).toHaveBeenCalledTimes(1);
    } finally { f.journal.close(); }
  });
  it('releases only the application rate limiter rejection before native dispatch', async () => {
    const f = http(), id = randomUUID();
    try {
      for (let i = 0; i < 60; i++) await request(f.app).get('/api/session').expect(200);
      const response = await f.post({ requestId: id, message: 'Synthetic correction.', syntheticTest: true });
      expect(response.status).toBe(429);
      expect(response.body.error).toMatchObject({ code: 'RATE_LIMITED', nativeRequestState: 'not_started' });
      expect(nativePendingAfterFailure(id, await apiError(response))).toBeNull();
      expect(f.claim).not.toHaveBeenCalled(); expect(f.memory.remember).not.toHaveBeenCalled();
      expect(await f.chat.history(owner)).toEqual([]);
    } finally { f.journal.close(); }
  });
  it.each([413, 429, 503])('does not infer no-send from HTTP %s after dispatch/claim begins', async status => {
    const f = http(), id = randomUUID();
    try {
      // A claim transport can fail after committing. Neither its status nor a
      // forged error property may become a pre-send receipt from the serializer.
      f.claim.mockRejectedValueOnce(Object.assign(new AppError(status, 'RATE_LIMITED', 'Check status.'), { nativeRequestState: 'not_started' }));
      const response = await f.post({ requestId: id, message: 'Synthetic correction.', syntheticTest: true });
      expect(response.status).toBe(status); expect(response.body.error).not.toHaveProperty('nativeRequestState');
      expect(nativePendingAfterFailure(id, await apiError(response))).toBe(id);
      expect(f.claim).toHaveBeenCalledTimes(1); expect(f.memory.remember).not.toHaveBeenCalled();
    } finally { f.journal.close(); }
  });
  it('retains uncertainty on interrupted response/invalid JSON/proxy rejection, without automatic retry', async () => {
    const id = randomUUID();
    expect(nativePendingAfterFailure(id, new RequestError('Interrupted', 'CONNECTION_INTERRUPTED'))).toBe(id);
    expect(nativePendingAfterFailure(id, new TypeError('Failed to fetch'))).toBe(id);
    let invalid: unknown;
    try { await readResponse(new Response('not JSON', { status: 413 })); } catch (error) { invalid = error; }
    expect(nativePendingAfterFailure(id, invalid)).toBe(id);
    for (const status of [413, 429]) {
      const proxy = await apiError({ status, body: { error: { code: 'RATE_LIMITED', message: 'Proxy rejected.' } } });
      expect(nativePendingAfterFailure(id, proxy)).toBe(id);
    }
    expect(nativePendingAfterFailure(id, { nativeRequestState: 'not_started' })).toBe(id);
    const f = http();
    try {
      f.memory.remember.mockRejectedValueOnce(new TypeError('Connection lost after possible persistence'));
      const response = await f.post({ requestId: id, message: 'Synthetic correction.', syntheticTest: true });
      expect(response.status).toBe(200); expect(response.body.status).toBe('uncertain');
      expect(response.body).not.toHaveProperty('nativeRequestState');
      expect(f.memory.remember).toHaveBeenCalledTimes(1);
      expect(await f.chat.history(owner)).toEqual([expect.objectContaining({ requestId: id, status: 'uncertain' })]);
    } finally { f.journal.close(); }
  });
});

it('native HTTP endpoints bind authenticated owners, deny unmapped owners and remain off in normal mode', async () => {
  const { chat, memory } = setup();
  const journal = new Journal(':memory:');
  const workflow = new Workflow(journal, new TestMemory(), () => binding);
  const config = { origin: 'http://localhost:3000', publishableKey: 'pk_test_fixture', secretKey: 'sk_test_fixture',
    amAccessMode: 'single-user-development' as const, bindings: new Map([[owner, binding]]) };
  const authentication = { middleware: (_req: any, _res: any, next: () => void) => next(), owner: (req: any) => req.get('X-Test-Owner') ?? null };
  try {
    const app = createApp({ config, workflow, nativeChat: chat, authentication });
    await request(app).get('/api/native/profile').expect(401);
    await request(app).get('/api/native/profile').set('X-Test-Owner', 'user_bob').expect(503);
    expect(memory.read).not.toHaveBeenCalled();
    await request(app).get('/api/native/profile').set('X-Test-Owner', owner).expect(200);
    expect(memory.read).toHaveBeenCalledWith(owner);
    await request(app).post('/api/native/messages').set('X-Test-Owner', owner).set('Origin', config.origin)
      .send({ requestId: randomUUID(), message: 'I work 28 hours.', syntheticTest: true, ownerId: 'user_bob' }).expect(400);
    const off = createApp({ config: { ...config, amAccessMode: 'restricted' }, workflow, nativeChat: chat, authentication });
    await request(off).get('/api/native/profile').set('X-Test-Owner', owner).expect(503);
    expect(memory.remember).not.toHaveBeenCalled();
  } finally { journal.close(); }
});
