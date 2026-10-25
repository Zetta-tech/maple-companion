import { z } from 'zod';

export const guideQuestionSchema = z.string().trim().min(1).max(2000);
/** Only codes whose discovery-route checks precede any provider POST. */
export function guideRequestNotSent(code: unknown): boolean {
  return ['VALIDATION_FAILED', 'OFFICIAL_SOURCE_UNAVAILABLE', 'OFFICIAL_SOURCE_CHANGED','CRS_SOURCES_REQUIRED',
    'DEMO_PROFILE_REQUIRED', 'DEMO_PROFILE_CHANGED', 'DEMO_MEMORY_UNVERIFIED',
    'DEMO_SAVE_PENDING', 'GUIDE_NOT_SENT'].includes(String(code));
}
