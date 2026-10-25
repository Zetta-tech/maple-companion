import { validateEmployment, type Employment } from '../shared/employment.js';
import type { CecReason } from '../shared/cec-evidence.js';
import type { PolicyCriterionResult } from '../shared/policy.js';

type Outcome = Pick<PolicyCriterionResult, 'status' | 'scope' | 'reasonCodes'>;
const result = (status: Outcome['status'], ...reasonCodes: CecReason[]): Outcome => ({ status, scope: 'recorded_work_interval', reasonCodes });
const day = (date: string) => Date.parse(date + 'T00:00:00Z');
const iso = (date: Date) => date.toISOString().slice(0, 10);
// Feb 29 rolls to March 1 in a non-leap year; never round an incomplete year up.
const yearsFrom = (date: string, years: number) => iso(new Date(Date.UTC(Number(date.slice(0, 4)) + years, Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))));

/** Draft algorithm, reachable only through an explicitly reviewed/allowlisted policy.
 * No conversation context, current-hours assumption, NOC suggestion or full-program verdict.
 */
export function evaluateCecWork(input: Employment | null, assessmentDate: string): Outcome {
  if (input === null) return result('needs_information', 'interval_missing');
  const employment = validateEmployment(input, assessmentDate);
  const evidence = employment.cecWork;
  if (!evidence) return result('needs_information', 'interval_missing');
  if (evidence.singleIntervalComplete !== 'yes') return result('needs_information', 'history_needs_review');
  if (evidence.conditionsConsistent !== 'yes') return result('needs_information', 'conditions_unknown');
  const disagrees = (a: string, b: string) => ['yes', 'no'].includes(a) && ['yes', 'no'].includes(b) && a !== b;
  if (disagrees(employment.paid, evidence.paid) || disagrees(employment.authorizedToWork, evidence.authorizedTemporaryResident)
    || (employment.countryCode !== 'CA' && evidence.physicallyInCanada === 'yes')) return result('needs_information', 'evidence_conflict');
  if (evidence.ongoing && employment.hoursPerWeek !== null && evidence.hoursPerWeek !== null && employment.hoursPerWeek !== evidence.hoursPerWeek) return result('needs_information', 'current_hours_conflict');
  const unknown: CecReason[] = [], excluded: CecReason[] = [];
  const answer = (value: string, expected: 'yes' | 'no', missing: CecReason, failure: CecReason) => {
    if (value !== 'yes' && value !== 'no') unknown.push(missing);
    else if (value !== expected) excluded.push(failure);
  };
  answer(evidence.physicallyInCanada, 'yes', 'presence_unknown', 'outside_canada');
  answer(evidence.authorizedTemporaryResident, 'yes', 'authorization_unknown', 'unauthorized');
  answer(evidence.paid, 'yes', 'paid_unknown', 'unpaid');
  answer(evidence.fullTimeStudy, 'no', 'study_unknown', 'full_time_study');
  if (evidence.relationship === 'self_employed') {
    if (evidence.physicianException === 'no') excluded.push('self_employed');
    else unknown.push('physician_review');
  } else if (evidence.relationship !== 'employee') unknown.push('relationship_unknown');
  if (evidence.workArrangement === 'remote' || evidence.workArrangement === 'mixed') answer(evidence.canadianEmployer, 'yes', 'employer_unknown', 'foreign_remote_employer');
  else if (evidence.workArrangement !== 'onsite') unknown.push('arrangement_unknown');
  if (!employment.nocCode || !employment.nocReviewed || !employment.duties.trim() || Number(employment.nocCode[1]) > 5) unknown.push('noc_unknown');
  else {
    answer(evidence.nocDutiesMatch, 'yes', 'noc_unknown', 'noc_mismatch');
    answer(evidence.nocEssentialDutiesMatch ?? 'unknown', 'yes', 'essential_duties_unknown', 'essential_duties_mismatch');
    if (Number(employment.nocCode[1]) > 3) excluded.push('teer_excluded');
  }
  if (evidence.hoursPerWeek === null) unknown.push('hours_unknown');
  if (excluded.length) return result('not_met', ...excluded);
  if (unknown.length) return result('needs_information', ...new Set(unknown));

  const from = [evidence.startDate, yearsFrom(assessmentDate, -3)].sort().at(-1)!;
  // Closed interval includes its stated actual last day. Ongoing work excludes the
  // application day, because the basis is experience gained before applying today.
  const until = evidence.ongoing ? assessmentDate : [iso(new Date(day(evidence.endDate!) + 86_400_000)), assessmentDate].sort()[0]!;
  if (until <= from) return result('not_met', 'outside_window');
  // The reviewed sources do not specify leap-day anniversary/clipping rules.
  // Hold potentially material edge cases rather than present our convention as law.
  if (from.endsWith('-02-29') && until === `${Number(from.slice(0, 4)) + 1}-02-28`
    || assessmentDate.endsWith('-02-29') && evidence.startDate <= `${Number(assessmentDate.slice(0, 4)) - 3}-02-28`
      && until > `${Number(assessmentDate.slice(0, 4)) - 3}-02-28`) {
    return result('needs_information', 'calendar_boundary_review');
  }
  if (until < yearsFrom(from, 1)) return result('not_met', 'duration_short');
  const days = (day(until) - day(from)) / 86_400_000;
  const weekly = Math.min(evidence.hoursPerWeek!, 30);
  const lowerHours = Math.floor(days / 7) * weekly;
  if (lowerHours >= 1560) return result('met', 'interval_sufficient');
  // Unknown distribution within the final partial week must not create a false
  // negative or positive at the threshold. No fractional-year rounding.
  if (days % 7 !== 0 && (Math.floor(days / 7) + 1) * weekly >= 1560) return result('needs_information', 'partial_week_review');
  return result('not_met', 'hours_short');
}
