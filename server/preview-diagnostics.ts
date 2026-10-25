import { z } from 'zod';
import type { MemoryPreview } from './am-preview.js';
import { candidateFields, diagnosticFieldTokens, fieldHint, recognizedHoursField } from './hours-field.js';
export { candidateFields } from './hours-field.js';

export const previewReasonSchema = z.enum([
  'NATIVE_CANDIDATE', 'NATIVE_EMPTY', 'NATIVE_NO_CANDIDATE', 'NATIVE_AMBIGUOUS', 'NATIVE_SUBJECT_UNSUPPORTED',
  'NATIVE_FIELD_UNSUPPORTED', 'NATIVE_VALUE_UNSUPPORTED', 'NATIVE_OUT_OF_RANGE',
  'PROVIDER_HTTP_ERROR', 'PROVIDER_TRANSPORT_UNCERTAIN', 'PROVIDER_RESPONSE_INVALID', 'LOCAL_PREVIEW_REJECTED',
  'MAPLE_ACCOUNT_SELECTOR', 'MAPLE_UNSUPPORTED_FIELD', 'MAPLE_NONCURRENT_OR_NEGATED',
  'MAPLE_CADENCE_UNRESOLVED', 'MAPLE_VALUE_UNGROUNDED', 'MAPLE_NO_CHANGE', 'PROPOSAL_PREPARED',
  'INTERPRETER_FAILED', 'STALE_DURING_PREVIEW', 'POST_PREVIEW_READ_FAILED',
  'NATIVE_PERIOD_MISSING', 'NATIVE_AVAILABILITY', 'CLARIFICATION_REQUIRED', 'CLARIFICATION_DECLINED',
  'NATIVE_KEY_UNMAPPED', 'NATIVE_ATTRIBUTE_INVALID', 'NATIVE_CATEGORY_UNSUPPORTED',
]);
export type PreviewReason = z.infer<typeof previewReasonSchema>;
export const previewEvidenceSchema = z.strictObject({
  counts: z.record(z.enum(['entities', 'attributes', 'instructions', 'uncertainties', 'relations', 'actions', 'corrections']), z.number().int().min(0).max(20)),
  candidates: z.array(z.strictObject({
    field: z.enum([...candidateFields, 'unsupported']),
    values: z.array(z.number().finite().min(-10000).max(10000)).max(3),
    unit: z.enum(['weekly', 'weekly_field', 'other', 'unspecified']),
    fieldHint: z.strictObject({ recognizedTokens: z.array(z.enum(diagnosticFieldTokens)).max(16),
      unknownTokenCount: z.number().int().min(0).max(16), identifierShape: z.enum(['identifier', 'redacted', 'non_string']) }).optional(),
  })).max(20),
});
export type PreviewEvidence = z.infer<typeof previewEvidenceSchema>;
/** No input, raw model text, entity names, error bodies or credentials are kept. */
export function previewEvidence(preview: MemoryPreview): PreviewEvidence {
  const e = preview.extraction;
  return previewEvidenceSchema.parse({
    counts: Object.fromEntries(['entities', 'attributes', 'instructions', 'uncertainties', 'relations', 'actions', 'corrections'].map(key => [key, (e[key as keyof typeof e] as unknown[] | undefined)?.length ?? 0])),
    candidates: e.attributes.map(row => {
      const value = typeof row === 'object' && row !== null ? row as Record<string, unknown> : {};
      const field = recognizedHoursField(value.key) ?? 'unsupported';
      const text = typeof value.value === 'string' && field !== 'unsupported' ? value.value.slice(0, 500) : '';
      const values = (text.match(/[-+]?\d+(?:\.\d+)?/g) ?? []).map(Number).filter(n => Number.isFinite(n) && Math.abs(n) <= 10000).slice(0, 3);
      const unit = /\b(?:day|daily|month|monthly|year|yearly|biweekly|fortnightly)\b/i.test(text) ? 'other'
        : /\b(?:week|weekly)\b/i.test(text) ? 'weekly' : ['hours_per_week', 'weekly_hours', 'hoursPerWeek'].includes(field) ? 'weekly_field' : 'unspecified';
      return { field, values, unit, ...(field === 'unsupported' ? { fieldHint: fieldHint(value.key) } : {}) };
    }),
  });
}
