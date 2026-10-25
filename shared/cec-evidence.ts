import { z } from 'zod';
import { policyDateSchema } from './policy.js';

const answer = z.enum(['yes', 'no', 'unknown', 'not_applicable']);
/** Optional, explicitly confirmed interval evidence. Never default this into old AM envelopes. */
export const cecWorkEvidenceSchema = z.strictObject({
  startDate: policyDateSchema,
  ongoing: z.boolean(),
  endDate: policyDateSchema.nullable(),
  hoursPerWeek: z.number().finite().gt(0).lte(168).nullable(),
  singleIntervalComplete: answer,
  conditionsConsistent: answer,
  physicallyInCanada: answer,
  authorizedTemporaryResident: answer,
  paid: answer,
  relationship: z.enum(['employee', 'self_employed', 'unknown', 'not_applicable']),
  physicianException: answer,
  fullTimeStudy: answer,
  workArrangement: z.enum(['onsite', 'remote', 'mixed', 'unknown', 'not_applicable']),
  canadianEmployer: answer,
  nocDutiesMatch: answer,
  // Optional for receipt compatibility. Absence is not approval of essential duties.
  nocEssentialDutiesMatch: answer.optional(),
}).superRefine((value, context) => {
  if (value.ongoing && value.endDate !== null) context.addIssue({ code: 'custom', path: ['endDate'], message: 'An ongoing interval must not have an end date.' });
  if (!value.ongoing && value.endDate === null) context.addIssue({ code: 'custom', path: ['endDate'], message: 'A completed interval needs its actual last day.' });
  if (value.endDate !== null && value.endDate < value.startDate) context.addIssue({ code: 'custom', path: ['endDate'], message: 'The last day cannot precede the first day.' });
});
export type CecWorkEvidence = z.infer<typeof cecWorkEvidenceSchema>;

export const cecReasonMessages = {
  interval_missing: 'Add the work interval and its qualifying details.',
  history_needs_review: 'Gaps, other periods, concurrent jobs or incomplete history need a broader work-history review.',
  conditions_unknown: 'Confirm that hours and qualifying conditions were consistent throughout this interval.',
  hours_unknown: 'Record the weekly hours that applied throughout this interval.',
  evidence_conflict: 'The interval conflicts with other saved employment answers. Review those answers before checking it.',
  current_hours_conflict: 'Current weekly hours differ from this ongoing constant-hours interval. Review the interval instead of applying today’s hours to past work.',
  presence_unknown: 'Confirm physical presence in Canada throughout the interval.',
  outside_canada: 'This interval includes work performed outside Canada.',
  authorization_unknown: 'Confirm authorization to work under temporary resident status throughout the interval.',
  unauthorized: 'The interval does not establish authorized work under temporary resident status.',
  paid_unknown: 'Confirm whether wages or commission were paid throughout the interval.',
  unpaid: 'Unpaid work does not meet this work-experience requirement.',
  relationship_unknown: 'Confirm employee or self-employed status for the interval.',
  self_employed: 'Ordinary self-employment is excluded from this check.',
  physician_review: 'The physician self-employment exception requires separate review and is not calculated here.',
  study_unknown: 'Confirm whether any part of the interval overlapped full-time study.',
  full_time_study: 'Work during full-time study is excluded from this check.',
  arrangement_unknown: 'Confirm whether work was onsite, remote or mixed.',
  employer_unknown: 'Remote or mixed work needs confirmation of a Canadian employer.',
  foreign_remote_employer: 'Remote work for a non-Canadian employer does not qualify in this check.',
  noc_unknown: 'Review a NOC 2021 code against the lead statement and main duties performed in this interval.',
  noc_mismatch: 'The reviewed duties do not match the selected NOC for this interval.',
  essential_duties_unknown: 'Confirm that you performed all essential duties of the selected NOC during this interval.',
  essential_duties_mismatch: 'The recorded interval does not establish all essential duties of the selected NOC.',
  teer_excluded: 'The reviewed NOC is outside TEER 0–3.',
  outside_window: 'The recorded interval is outside the three-year application lookback.',
  duration_short: 'The recorded interval does not establish twelve calendar months; overtime cannot shorten that period.',
  hours_short: 'The recorded interval does not establish 1,560 hours after the weekly cap.',
  partial_week_review: 'The threshold depends on a partial week; actual hours for that boundary need review.',
  calendar_boundary_review: 'A leap-day anniversary or lookback boundary needs a date review before this interval can be assessed.',
  interval_sufficient: 'This recorded interval meets the supported work-experience criterion. Other CEC requirements are not assessed.',
} as const;
export type CecReason = keyof typeof cecReasonMessages;
