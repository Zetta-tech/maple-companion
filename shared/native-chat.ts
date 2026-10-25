import { z } from 'zod';

// 5,000 UTF-16 units fit within Express's 32 KiB JSON body limit even when
// each unit is escaped as six ASCII bytes, plus the UUID/consent envelope.
// This is a per-message payload bound, not a request or spending quota.
export const NATIVE_MESSAGE_MAX_LENGTH = 5_000;
export const nativeMessageTextSchema = z.string().min(1).max(NATIVE_MESSAGE_MAX_LENGTH).refine(value => !!value.trim());

export type NativeFact = { entity: string; key: string; value: string };
export type NativeMessageResult = {
  requestId: string;
  status: 'processing' | 'verified' | 'unverified' | 'uncertain';
  message: string;
  createdAt: string;
  warnings: string[];
};
export type NativeProfile = {
  checkedAt: string;
  complete: boolean;
  facts: NativeFact[];
  instructions: { label: string; description: string }[];
  unresolved: number;
};
export const nativeStatusText = {
  processing: 'Your message is still being processed. Check its status before sending it again.',
  verified: 'Your updated details are available in your profile.',
  unverified: 'I couldn’t confirm your profile was updated. Please check your details before relying on this change.',
  uncertain: 'I couldn’t check whether this update finished. Refresh its status, and don’t resend the message.',
} as const;
