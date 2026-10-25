import { z } from 'zod';
import { cecWorkEvidenceSchema } from './cec-evidence.js';

/** An explicit answer; an unknown answer must never become a negative answer. */
const answerSchema = z.enum(['yes', 'no', 'unknown', 'not_applicable']);

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp)
    && new Date(timestamp).toISOString().slice(0, 10) === value;
}

const dateSchema = z.string().refine(isCalendarDate, 'Use a real date in YYYY-MM-DD format.');

/**
 * One employment record, not an eligibility conclusion or a complete work history.
 * Null hours mean unknown; zero hours are not a substitute for missing information.
 * Country codes are normalized uppercase two-letter identifiers, not a legal finding.
 * NOC codes are supplied/reviewed by the user; this schema never suggests a code.
 */
export const employmentSchema = z.strictObject({
  employer: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  duties: z.string().trim().max(10_000),
  startDate: dateSchema,
  currentJob: z.boolean(),
  endDate: dateSchema.nullable(),
  hoursPerWeek: z.number().finite().gt(0).lte(168).nullable(),
  countryCode: z.string().regex(/^[A-Z]{2}$/, 'Use an uppercase two-letter country code.'),
  paid: answerSchema,
  authorizedToWork: answerSchema,
  nocCode: z.string().regex(/^\d{5}$/, 'Use a five-digit NOC code.').nullable(),
  nocReviewed: z.boolean(),
  // Absence remains absence: adding defaults here would alter legacy receipt hashes.
  cecWork: cecWorkEvidenceSchema.optional(),
}).superRefine((employment, context) => {
  const interval = employment.cecWork;
  if (interval) {
    if (interval.startDate < employment.startDate) context.addIssue({ code: 'custom', path: ['cecWork', 'startDate'], message: 'The interval cannot start before this job.' });
    if (interval.ongoing && !employment.currentJob) context.addIssue({ code: 'custom', path: ['cecWork', 'ongoing'], message: 'A past job cannot have an ongoing interval.' });
    if (employment.endDate !== null && interval.endDate !== null && interval.endDate > employment.endDate) context.addIssue({ code: 'custom', path: ['cecWork', 'endDate'], message: 'The interval cannot end after this job.' });
  }
  if (employment.currentJob && employment.endDate !== null) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'An ongoing job must not have an end date.' });
  }
  if (!employment.currentJob && employment.endDate === null) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'A past job requires its actual end date.' });
  }
  if (employment.endDate !== null && employment.endDate < employment.startDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after start date.' });
  }
  if (employment.nocCode !== null) {
    if (employment.duties.length === 0) {
      context.addIssue({ code: 'custom', path: ['duties'], message: 'Review job duties before selecting a NOC code.' });
    }
    if (!employment.nocReviewed) {
      context.addIssue({ code: 'custom', path: ['nocReviewed'], message: 'A NOC code requires explicit user review.' });
    }
  } else if (employment.nocReviewed) {
    context.addIssue({ code: 'custom', path: ['nocReviewed'], message: 'A missing NOC code cannot be marked reviewed.' });
  }
});

export type Employment = z.infer<typeof employmentSchema>;

/** Validate dates against the server-selected assessment date, never a client clock. */
export function validateEmployment(input: unknown, assessmentDate: string): Employment {
  const assessment = z.strictObject({ assessmentDate: dateSchema }).parse({ assessmentDate }).assessmentDate;
  return employmentSchema.superRefine((employment, context) => {
    if (employment.startDate > assessment) {
      context.addIssue({ code: 'custom', path: ['startDate'], message: 'Start date cannot be after the assessment date.' });
    }
    if (employment.endDate !== null && employment.endDate > assessment) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be after the assessment date.' });
    }
    if (employment.cecWork?.startDate && employment.cecWork.startDate > assessment) context.addIssue({ code: 'custom', path: ['cecWork', 'startDate'], message: 'The interval cannot start after the assessment date.' });
    if (employment.cecWork?.endDate && employment.cecWork.endDate > assessment) context.addIssue({ code: 'custom', path: ['cecWork', 'endDate'], message: 'The interval cannot end after the assessment date.' });
  }).parse(input);
}

/**
 * Completed calendar years of elapsed duration only: NOT qualifying experience.
 * Hours, continuity, work authorization, duties and program rules require separate checks.
 * An ongoing record is evaluated as of assessmentDate without writing an end date.
 * For a Feb 29 start, a non-leap-year anniversary is reached on March 1.
 */
export function completedEmploymentYears(employment: Employment, assessmentDate: string): number {
  const valid = validateEmployment(employment, assessmentDate);
  const through = valid.currentJob ? assessmentDate : valid.endDate!;
  const years = Number(through.slice(0, 4)) - Number(valid.startDate.slice(0, 4));
  return years - (through.slice(5) < valid.startDate.slice(5) ? 1 : 0);
}
