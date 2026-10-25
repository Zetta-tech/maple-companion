import { z } from 'zod';
import type { CecReason } from './cec-evidence.js';

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

export const policyDateSchema = z.string().refine(isCalendarDate, 'Use a real date in YYYY-MM-DD format.');
const timestampSchema = z.iso.datetime({ offset: true });
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const title = z.string().min(1).max(300).refine((value) => value.trim().length > 0);

function isOfficialSource(value: string): boolean {
  try {
    const url = new URL(value);
    return value === value.trim()
      && url.protocol === 'https:'
      && url.username === '' && url.password === ''
      && url.port === ''
      && ['canada.ca', 'ontario.ca'].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

const criterionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    id: identifier, title, kind: z.literal('cec_work_experience'),
    calculation: z.literal('single-interval-v1'),
    minimumCalendarMonths: z.literal(12), minimumHours: z.literal(1560),
    weeklyCap: z.literal(30), lookbackYears: z.literal(3),
  }),
  z.strictObject({
    id: identifier,
    title,
    kind: z.literal('answer_equals'),
    field: z.enum(['paid', 'authorizedToWork']),
    expected: z.enum(['yes', 'no']),
  }),
  z.strictObject({
    id: identifier,
    title,
    kind: z.literal('number_gte'),
    field: z.literal('hoursPerWeek'),
    minimum: z.number().finite().min(0).max(168),
  }),
]);

/**
 * A reviewed policy version, not a complete immigration eligibility model.
 * effectiveTo is exclusive. Content is never fetched or promoted by this contract.
 * The server additionally verifies the SHA-256 of the exact UTF-8 source body.
 */
export const policyVersionSchema = z.strictObject({
  id: identifier,
  version: identifier,
  program: title,
  title,
  effectiveFrom: policyDateSchema,
  effectiveTo: policyDateSchema.nullable(),
  source: z.strictObject({
    url: z.string().max(4096).refine(isOfficialSource, 'Use an HTTPS source on canada.ca or ontario.ca.'),
    body: z.string().min(1).max(1_000_000),
    bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
    retrievedAt: timestampSchema,
  }),
  review: z.strictObject({
    status: z.enum(['draft', 'held', 'reviewed', 'superseded']),
    reviewerId: z.string().min(1).max(200).refine((value) => value.trim().length > 0).nullable(),
    reviewedAt: timestampSchema.nullable(),
  }),
  criteria: z.array(criterionSchema).min(1).max(100),
}).superRefine((record, context) => {
  if (record.effectiveTo !== null && record.effectiveTo <= record.effectiveFrom) {
    context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'The exclusive end date must follow the start date.' });
  }
  if ((record.review.reviewerId === null) !== (record.review.reviewedAt === null)) {
    context.addIssue({ code: 'custom', path: ['review'], message: 'Reviewer and review time must be recorded together.' });
  }
  if (record.review.status === 'reviewed' && record.review.reviewerId === null) {
    context.addIssue({ code: 'custom', path: ['review'], message: 'A reviewed version requires reviewer and review time.' });
  }
  if (record.review.reviewedAt !== null && Date.parse(record.review.reviewedAt) < Date.parse(record.source.retrievedAt)) {
    context.addIssue({ code: 'custom', path: ['review', 'reviewedAt'], message: 'A review cannot precede source retrieval.' });
  }
  if (new Set(record.criteria.map((criterion) => criterion.id)).size !== record.criteria.length) {
    context.addIssue({ code: 'custom', path: ['criteria'], message: 'Criterion identifiers must be unique within a version.' });
  }
});

export type PolicyVersion = z.infer<typeof policyVersionSchema>;
export type PolicyCriterion = PolicyVersion['criteria'][number];
export type PolicySelection = { readonly policy: PolicyVersion; readonly digest: string };
export type PolicyCriterionResult = {
  criterionId: string;
  title: string;
  status: 'met' | 'not_met' | 'needs_information';
  scope?: 'recorded_work_interval';
  reasonCodes?: CecReason[];
};
export type PolicySummary = {
  id: string;
  version: string;
  program: string;
  title: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string;
  digest: string;
};
