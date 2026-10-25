import { createHash } from 'node:crypto';
import { RecordId, type Surreal } from 'surrealdb';
import { AppError } from './errors.js';
import type { NativeSession, NativeSessions } from './native-memory.js';
import type { NativeMessageResult } from '../shared/native-chat.js';

export interface NativeChatStore extends NativeSessions {
  current(owner: string): Promise<NativeSession | null>;
  claim(owner: string, requestId: string, digest: string, at: string): Promise<NativeMessageResult | null>;
  finish(owner: string, result: NativeMessageResult): Promise<void>;
  list(owner: string): Promise<NativeMessageResult[]>;
}
const record = (table: string, owner: string, key = owner) => new RecordId(table,
  createHash('sha256').update(JSON.stringify([owner, key])).digest('hex'));
const unavailable = () => new AppError(503, 'NATIVE_JOURNAL_UNAVAILABLE', 'Native memory status could not be verified. No automatic retry will be sent.');

/** No canonical facts here: owner/session bindings and processing receipts only. */
export class SurrealNativeChatStore implements NativeChatStore {
  constructor(private db: Surreal) {}
  async ready() {
    const [rows] = await this.db.query<[{ version: number }[]]>('SELECT version FROM maple_schema:native_chat_v1;').retry(false);
    if (rows.length !== 1 || rows[0]?.version !== 1) throw new AppError(503, 'NATIVE_SCHEMA_REQUIRED', 'Native chat storage setup is pending.');
  }
  async load(owner: string, sessionId: string) {
    const [rows] = await this.db.query<[{ session_json: string }[]]>(
      'SELECT session_json FROM maple_native_sessions WHERE owner = $owner AND key = $key LIMIT 1;', { owner, key: sessionId }).retry(false);
    return rows[0] ? JSON.parse(rows[0].session_json) as NativeSession : null;
  }
  async save(session: NativeSession) {
    await this.db.query('CREATE $record CONTENT $data;', { record: record('maple_native_sessions', session.ownerId, session.sessionId),
      data: { owner: session.ownerId, key: session.sessionId, session_json: JSON.stringify(session), created_at: new Date().toISOString() } }).retry(false);
  }
  async current(owner: string) {
    const [rows] = await this.db.query<[{ session_json: string; created_at: string }[]]>(
      'SELECT session_json, created_at FROM maple_native_sessions WHERE owner = $owner ORDER BY created_at DESC LIMIT 1;', { owner }).retry(false);
    return rows[0] ? JSON.parse(rows[0].session_json) as NativeSession : null;
  }
  async claim(owner: string, requestId: string, digest: string, at: string) {
    const tx = await this.db.beginTransaction();
    try {
      await tx.query('UPSERT $record SET owner = $owner, epoch = (epoch ?? 0) + 1;', { record: record('maple_native_guard', owner), owner }).retry(false);
      const [same] = await tx.query<[{ digest: string; status: NativeMessageResult['status']; created_at: string; result_json: string | null }[]]>(
        'SELECT * FROM maple_native_requests WHERE owner = $owner AND key = $key LIMIT 1;', { owner, key: requestId }).retry(false);
      if (same[0]) {
        if (same[0].digest !== digest) throw new AppError(409, 'NATIVE_REQUEST_CONFLICT', 'This request ID belongs to a different message.');
        await tx.cancel();
        return same[0].result_json ? JSON.parse(same[0].result_json) as NativeMessageResult
          : { requestId, status: same[0].status, createdAt: same[0].created_at, message: 'This message is already being processed. Do not resend it.', warnings: [] };
      }
      const [active] = await tx.query<unknown[][]>(
        "SELECT key FROM maple_native_requests WHERE owner = $owner AND status IN ['processing', 'uncertain'] LIMIT 1;", { owner }).retry(false);
      if (!active) throw unavailable();
      if (active.length) throw new AppError(409, 'NATIVE_REQUEST_PENDING', 'An earlier message has an unresolved processing outcome. Check its status before sending another.');
      await tx.query('CREATE $record CONTENT $data;', { record: record('maple_native_requests', owner, requestId),
        data: { owner, key: requestId, digest, status: 'processing', created_at: at, result_json: null } }).retry(false);
      await tx.commit();
      return null;
    } catch (error) {
      try { await tx.cancel(); } catch { /* Unknown commit stays unknown; never send AM after this error. */ }
      if (error instanceof AppError) throw error;
      throw unavailable();
    }
  }
  async finish(owner: string, result: NativeMessageResult) {
    const [rows] = await this.db.query<unknown[][]>(
      "UPDATE $record SET status = $status, result_json = $json WHERE owner = $owner AND status = 'processing' RETURN AFTER;",
      { record: record('maple_native_requests', owner, result.requestId), owner, status: result.status, json: JSON.stringify(result) }).retry(false);
    if (rows?.length !== 1) throw unavailable();
  }
  async list(owner: string) {
    const [rows] = await this.db.query<[{ key: string; status: NativeMessageResult['status']; created_at: string; result_json: string | null }[]]>(
      'SELECT key, status, created_at, result_json FROM maple_native_requests WHERE owner = $owner ORDER BY created_at DESC;', { owner }).retry(false);
    return rows.map(row => row.result_json ? JSON.parse(row.result_json) as NativeMessageResult
      : { requestId: row.key, status: row.status, createdAt: row.created_at, message: 'Processing outcome is not yet verified. No automatic retry will be sent.', warnings: [] });
  }
}
