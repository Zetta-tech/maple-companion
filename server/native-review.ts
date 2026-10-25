import type { JournalStore } from './journal-store.js';
import type { NativeChatStore } from './native-chat-store.js';

/** No start-time comparison or guessed legacy completion. The barrier is written
 * atomically with native completion under the employment owner's commit guard. */
export async function nativeInputsReviewed(owner: string, store: Pick<NativeChatStore, 'list'>, journal: Pick<JournalStore, 'head'>): Promise<boolean> {
  const messages = await store.list(owner);
  if (!messages.length) return true;
  let requiredRevision = 0;
  for (const message of messages) {
    if (!['verified', 'unverified'].includes(message.status)) return false;
    const boundary = message.completion;
    if (boundary?.version !== 1 || !Number.isSafeInteger(boundary.employmentRevision) || boundary.employmentRevision < 0) return false;
    requiredRevision = Math.max(requiredRevision, boundary.employmentRevision);
  }
  const head = await journal.head(owner);
  return Number.isSafeInteger(head.revision) && head.revision > requiredRevision;
}
