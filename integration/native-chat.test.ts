import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { connectOperationalDatabase, loadDatabaseConfig } from '../server/operational-db.js';
import { SurrealNativeChatStore } from '../server/native-chat-store.js';

it('persists owner-private native sessions and replay/concurrency state in real SurrealDB', async () => {
  const db = await connectOperationalDatabase(loadDatabaseConfig('test'));
  const owner = 'user_native' + randomUUID().replaceAll('-', ''), other = owner + 'other';
  const requestId = randomUUID(), now = new Date().toISOString();
  try {
    const store = new SurrealNativeChatStore(db); await store.ready();
    const session = { ownerId: owner, context: 'synthetic_context', principalId: 'synthetic', scope: 'synthetic/conversation', sessionId: randomUUID() };
    await store.save(session);
    expect(await store.load(owner, session.sessionId)).toEqual(session);
    expect(await store.load(other, session.sessionId)).toBeNull();
    expect(await store.current(other)).toBeNull();
    expect(await store.claim(owner, requestId, 'synthetic-digest', now)).toBeNull();
    await expect(store.claim(owner, randomUUID(), 'second', now)).rejects.toMatchObject({ code: 'NATIVE_REQUEST_PENDING' });
    await store.finish(owner, { requestId, createdAt: now, status: 'unverified', message: 'Synthetic unverified fixture', warnings: [] });
    expect((await store.claim(owner, requestId, 'synthetic-digest', now))?.status).toBe('unverified');
    await expect(store.claim(owner, requestId, 'different-digest', now)).rejects.toMatchObject({ code: 'NATIVE_REQUEST_CONFLICT' });
    expect(await store.list(other)).toEqual([]);
    expect(await store.list(owner)).toHaveLength(1);
    const second = new SurrealNativeChatStore(db);
    expect((await second.list(owner))[0]?.status).toBe('unverified');
    const attempts = await Promise.allSettled([
      store.claim(owner, randomUUID(), 'race-a', now), second.claim(owner, randomUUID(), 'race-b', now),
    ]);
    expect(attempts.filter(result => result.status === 'fulfilled' && result.value === null)).toHaveLength(1);
    console.info('Retained synthetic native metadata:', JSON.stringify({ owner, sessions: 1, requests: 2, guards: 1 }));
  } finally { await db.close(); }
});
