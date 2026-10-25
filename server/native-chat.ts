import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { AppError } from './errors.js';
import { createNativeMemory, type NativeBinding } from './native-memory.js';
import type { NativeChatStore } from './native-chat-store.js';
import { nativeMessageTextSchema, nativeStatusText, type NativeMessageResult, type NativeProfile } from '../shared/native-chat.js';

export const nativeMessageSchema = z.strictObject({ requestId: z.uuid(), message: nativeMessageTextSchema, syntheticTest: z.literal(true) });
type NativePort = ReturnType<typeof createNativeMemory>;
export type NativeDiagnostic = (owner: string, requestId: string, evidence: unknown) => Promise<void>;

/** Synthetic development diagnostics only, in a Git-ignored server directory. No headers/credentials. */
export function privateNativeDiagnostics(directory: string): NativeDiagnostic {
  const root = resolve(directory);
  return async (owner, requestId, evidence) => {
    const path = resolve(root, createHash('sha256').update(JSON.stringify([owner, requestId])).digest('hex') + '.json');
    await mkdir(root, { recursive: true });
    await writeFile(path, JSON.stringify(evidence, null, 2), { flag: 'wx', mode: 0o600 });
  };
}

export class NativeChat {
  constructor(private store: NativeChatStore, private memory: NativePort,
    private diagnostic: NativeDiagnostic, private clock = () => new Date()) {}
  async history(owner: string) { return this.store.list(owner); }
  async profile(owner: string): Promise<NativeProfile> {
    const snapshot = await this.memory.read(owner);
    // Native self facts only. Other entities (including legacy assessment
    // envelopes) are not silently presented as a second personal profile.
    return { checkedAt: this.clock().toISOString(), complete: snapshot.complete,
      facts: snapshot.profile.selfFacts.map(fact => ({ entity: fact.entity ?? 'You', key: fact.key, value: fact.value })),
      instructions: snapshot.profile.instructions.map(i => ({ label: i.label, description: i.description })),
      unresolved: snapshot.state.unknowns.length };
  }
  async send(owner: string, input: unknown): Promise<NativeMessageResult> {
    const request = nativeMessageSchema.parse(input);
    if (!request.message.trim()) throw new AppError(400, 'MESSAGE_REQUIRED', 'Enter a message.');
    const createdAt = this.clock().toISOString();
    const digest = createHash('sha256').update(request.message).digest('hex');
    const previous = await this.store.claim(owner, request.requestId, digest, createdAt);
    if (previous) return previous;
    let evidence: unknown;
    let result: NativeMessageResult;
    try {
      const session = await this.store.current(owner) ?? await this.memory.createSession(owner, request.requestId);
      const response = await this.memory.remember(owner, session.sessionId, request.message, request.requestId);
      evidence = { at: createdAt, requestId: request.requestId, input: request.message, session, response };
      const extraction = response.ingestion.extraction!;
      const profileRows = response.profile.selfFacts;
      const visible = response.complete && extraction.attributes.length > 0
        && response.attributeVisibility.every(a => a.foundInState)
        && extraction.attributes.every(a => profileRows.some(row => row.key === a.key && row.value === a.value))
        && extraction.uncertainties.length === 0;
      result = { requestId: request.requestId, createdAt, status: visible ? 'verified' : 'unverified',
        message: visible ? nativeStatusText.verified : nativeStatusText.unverified,
        warnings: extraction.uncertainties.map(u => u.reason) };
    } catch (error) {
      evidence = { at: createdAt, requestId: request.requestId, input: request.message,
        error: { name: error instanceof Error ? error.name : 'unknown', code: error && typeof error === 'object' && 'code' in error ? error.code : null } };
      result = { requestId: request.requestId, createdAt, status: 'uncertain', message: nativeStatusText.uncertain, warnings: [] };
    }
    try { await this.diagnostic(owner, request.requestId, evidence); }
    catch { result = { ...result, status: 'uncertain', message: 'Diagnostic evidence could not be retained. The processing outcome needs review; do not resend this message.' }; }
    await this.store.finish(owner, result);
    return result;
  }
}

/** Constructed only after explicit development configuration/identity setup. */
export function createNativeChat(resolveBinding: (owner: string) => NativeBinding, store: NativeChatStore, diagnostic: NativeDiagnostic) {
  return new NativeChat(store, createNativeMemory(resolveBinding, store), diagnostic);
}
