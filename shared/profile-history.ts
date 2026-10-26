import { z } from 'zod';
import { languageEvidenceSchema } from './crs.js';
import { policyDateSchema } from './policy.js';

const notes = z.string().trim().max(500);
const educationRecordSchema = z.strictObject({
  id: z.string().uuid(), institution: z.string().trim().min(1).max(200),
  program: z.string().trim().min(1).max(200), credential: z.string().trim().max(200),
  startDate: policyDateSchema.nullable(), endDate: policyDateSchema.nullable(), notes,
}).refine(record => !record.startDate || !record.endDate || record.endDate >= record.startDate, {
  message: 'Study end date must be on or after the start date.', path: ['endDate'],
});
const languageRecordSchema = languageEvidenceSchema.extend({
  id: z.string().uuid(), language: z.enum(['english', 'french']), notes,
});
/** Optional history within the existing Guide envelope, not another profile store.
 * A history entry does not establish ECA equivalency or replace current CRS evidence. */
export const profileHistorySchema = z.strictObject({
  version: z.literal(1), education: z.array(educationRecordSchema).max(20),
  languageTests: z.array(languageRecordSchema).max(20),
}).superRefine((value, context) => {
  if(new TextEncoder().encode(JSON.stringify(value)).byteLength > 16_000) context.addIssue({ code:'custom', message:'History is too large. Shorten notes or remove unneeded entries before saving.' });
  for (const field of ['education', 'languageTests'] as const) {
    const ids = value[field].map(record => record.id);
    if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: [field], message: 'History entries must have distinct IDs.' });
  }
});
export type ProfileHistory = z.infer<typeof profileHistorySchema>;
export const emptyProfileHistory = (): ProfileHistory => ({ version: 1, education: [], languageTests: [] });
