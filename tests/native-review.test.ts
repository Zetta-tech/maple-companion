import { describe, expect, it } from 'vitest';
import { nativeInputsReviewed } from '../server/native-review.js';
import type { NativeMessageResult } from '../shared/native-chat.js';

const owner = 'user_review';
const receipt: NativeMessageResult = { requestId: 'test', createdAt: '2026-10-25T12:00:00Z',
  status: 'verified', message: '', warnings: [], completion: { version: 1, employmentRevision: 4 } };
function check(messages: NativeMessageResult[], revision: number) {
  return nativeInputsReviewed(owner, { list: async requested => { expect(requested).toBe(owner); return messages; } },
    { head: async requested => { expect(requested).toBe(owner); return { revision, receipt: null }; } });
}
describe('native completion review boundary', () => {
  it('requires a later confirmed revision, independent of identical wall-clock timestamps', async () => {
    expect(await check([receipt], 4)).toBe(false);
    expect(await check([receipt], 5)).toBe(true);
  });
  it.each(['processing', 'uncertain'] as const)('holds %s regardless of a newer employment save', async status => {
    expect(await check([{ ...receipt, status }], 100)).toBe(false);
  });
  it('permits explicit input review after a completed but unverified extraction', async () => {
    expect(await check([{ ...receipt, status: 'unverified' }], 5)).toBe(true);
  });
  it('does not invent a boundary for legacy or malformed records', async () => {
    expect(await check([{ ...receipt, completion: undefined }], 100)).toBe(false);
    expect(await check([{ ...receipt, completion: { version: 1, employmentRevision: NaN } }], 100)).toBe(false);
  });
  it('checks all completions rather than ordering by their start timestamps', async () => {
    const laterCompletion = { ...receipt, createdAt: '2026-10-25T11:00:00Z', completion: { version: 1 as const, employmentRevision: 7 } };
    expect(await check([receipt, laterCompletion], 6)).toBe(false);
    expect(await check([receipt, laterCompletion], 8)).toBe(true);
    expect(await check([], 0)).toBe(true);
  });
});
