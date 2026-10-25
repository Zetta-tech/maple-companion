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
