import type { NativeMessageResult } from '../shared/native-chat.js';
import { nativePendingAfterFailure } from './request.js';

/** Local uncertainty cannot be cleared by an empty history read before a claim. */
export class NativeAssessmentGate {
  private pending: string | null = null;
  private history: NativeMessageResult[] = [];
  constructor(private report: (held: boolean) => void) {}
  checking() { this.report(true); }
  begin(id: string) { this.pending = id; this.report(true); }
  refresh(history: NativeMessageResult[]) {
    this.history = history;
    if (history.some(item => item.requestId === this.pending && item.status !== 'processing')) this.pending = null;
    this.publish();
  }
  complete(result: NativeMessageResult) {
    this.refresh([result, ...this.history.filter(item => item.requestId !== result.requestId)]);
  }
  fail(id: string, error: unknown) {
    this.pending = nativePendingAfterFailure(id, error);
    this.publish();
  }
  private publish() {
    this.report(this.pending !== null || this.history.some(item => item.status === 'processing' || item.status === 'uncertain'));
  }
}

export async function sendWithAssessmentHold<T extends NativeMessageResult>(gate: NativeAssessmentGate, id: string, send: () => Promise<T>): Promise<T> {
  gate.begin(id); // Before dispatch: a status reload alone could beat the server claim.
  try { const result = await send(); gate.complete(result); return result; }
  catch (error) { gate.fail(id, error); throw error; }
}
