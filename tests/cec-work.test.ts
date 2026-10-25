import { describe, expect, it } from 'vitest';
import { evaluateCecWork } from '../server/cec-work.js';
import { validateEmployment, employmentSchema, type Employment } from '../shared/employment.js';
import type { CecWorkEvidence } from '../shared/cec-evidence.js';
import { PolicyRegistry, evaluatePolicy, policyDigest } from '../server/policies.js';
import { testCecEmployment, testCecPolicy } from './support/test-cec.js';
import { businessDate } from '../shared/business-date.js';

const date = '2026-01-01';
function sample(patch: Partial<CecWorkEvidence> = {}, job: Partial<Employment> = {}) {
  const value = { ...testCecEmployment(), ...job };
  return { ...value, cecWork: { ...value.cecWork!, ...patch } };
}
const run = (patch: Partial<CecWorkEvidence> = {}, job: Partial<Employment> = {}) => evaluateCecWork(sample(patch, job), date);
describe('draft single-interval CEC calculation, synthetic facts only', () => {
  it('requires interval evidence rather than reinterpreting current hours or country', () => {
    const { cecWork: _, ...legacy } = sample();
    expect(evaluateCecWork(legacy, date)).toMatchObject({ status: 'needs_information', reasonCodes: ['interval_missing'] });
    expect(evaluateCecWork(null, date).status).toBe('needs_information');
    expect(employmentSchema.parse(legacy)).not.toHaveProperty('cecWork');
  });
  it('supports 12 calendar months at 30 hours and caps overtime without acceleration', () => {
    expect(run()).toMatchObject({ status: 'met', scope: 'recorded_work_interval' });
    expect(run({ hoursPerWeek: 60, startDate: '2025-02-01' })).toMatchObject({ status: 'not_met', reasonCodes: ['duration_short'] });
    expect(run({ hoursPerWeek: 168, startDate: '2025-01-02' }).status).toBe('not_met');
  });
  it('allows equivalent part-time duration, without rounding incomplete time or hours up', () => {
    expect(run({ startDate: '2024-01-01', hoursPerWeek: 15 }).status).toBe('met');
    expect(run({ startDate: '2024-02-01', hoursPerWeek: 15 })).toMatchObject({ status: 'not_met', reasonCodes: ['hours_short'] });
    expect(run({ startDate: '2024-01-01', hoursPerWeek: 14.99 })).toMatchObject({ status: 'needs_information', reasonCodes: ['partial_week_review'] });
  });
  it.each(['unknown', 'no', 'not_applicable'] as const)('holds incomplete or complex history: %s', value => {
    expect(run({ singleIntervalComplete: value })).toMatchObject({ status: 'needs_information', reasonCodes: ['history_needs_review'] });
    expect(run({ conditionsConsistent: value }).status).toBe('needs_information');
  });
  it.each(['physicallyInCanada', 'authorizedTemporaryResident', 'paid', 'fullTimeStudy', 'nocDutiesMatch'] as const)('does not turn unknown or N/A %s into an answer', field => {
    expect(run({ [field]: 'unknown' }).status).toBe('needs_information');
    expect(run({ [field]: 'not_applicable' }).status).toBe('needs_information');
  });
  it.each([
    [{ physicallyInCanada: 'no' }, 'outside_canada'],
    [{ authorizedTemporaryResident: 'no' }, 'unauthorized'],
    [{ paid: 'no' }, 'unpaid'], [{ fullTimeStudy: 'yes' }, 'full_time_study'],
    [{ nocDutiesMatch: 'no' }, 'noc_mismatch'],
  ] as const)('reports a known exclusion for this recorded interval', (patch, reason) => {
    expect(run(patch, { paid: 'unknown', authorizedToWork: 'unknown' })).toMatchObject({ status: 'not_met', reasonCodes: [reason] });
  });
  it('holds conflicts with saved general evidence and an ongoing schedule', () => {
    expect(run({ paid: 'no' }).reasonCodes).toEqual(['evidence_conflict']);
    expect(run({}, { countryCode: 'US' }).reasonCodes).toEqual(['evidence_conflict']);
    expect(run({ ongoing: true, endDate: null, hoursPerWeek: 35 }).reasonCodes).toEqual(['current_hours_conflict']);
  });
  it('requires employer evidence for remote and mixed work and excludes foreign remote work', () => {
    expect(run({ workArrangement: 'remote', canadianEmployer: 'unknown' }).status).toBe('needs_information');
    expect(run({ workArrangement: 'mixed', canadianEmployer: 'no' }).reasonCodes).toEqual(['foreign_remote_employer']);
    expect(run({ workArrangement: 'remote', canadianEmployer: 'yes' }).status).toBe('met');
  });
  it('does not calculate physician exceptions or infer employee status', () => {
    expect(run({ relationship: 'unknown' }).status).toBe('needs_information');
    expect(run({ relationship: 'self_employed', physicianException: 'no' }).reasonCodes).toEqual(['self_employed']);
    for (const physicianException of ['yes', 'unknown', 'not_applicable'] as const) {
      expect(run({ relationship: 'self_employed', physicianException }).reasonCodes).toEqual(['physician_review']);
    }
  });
  it('requires reviewed duties and uses the second NOC digit for TEER, not job title', () => {
    expect(run({}, { nocCode: null, nocReviewed: false, title: 'Software engineer' }).status).toBe('needs_information');
    expect(run({}, { nocCode: '64100' }).reasonCodes).toEqual(['teer_excluded']);
    expect(run({}, { nocCode: '29222' }).reasonCodes).toContain('noc_unknown');
  });
  it('clips to the three years before applying and never uses the CRS ten-year window', () => {
    expect(run({ startDate: '2021-01-01', endDate: '2022-12-31' }).reasonCodes).toEqual(['outside_window']);
    expect(run({ startDate: '2021-01-01', endDate: '2023-12-31' }).status).toBe('met');
    expect(run({ startDate: '2021-01-01', endDate: '2023-11-30' }).reasonCodes).toEqual(['duration_short']);
  });
  it('requires all essential duties without adding defaults to previously approved evidence', () => {
    const input = sample();
    const { nocEssentialDutiesMatch: _, ...legacyEvidence } = input.cecWork;
    const legacy = { ...input, cecWork: legacyEvidence };
    expect(employmentSchema.parse(legacy).cecWork).not.toHaveProperty('nocEssentialDutiesMatch');
    expect(evaluateCecWork(legacy, date)).toMatchObject({ status: 'needs_information', reasonCodes: ['essential_duties_unknown'] });
    for (const value of ['unknown', 'not_applicable'] as const) {
      expect(run({ nocEssentialDutiesMatch: value }).reasonCodes).toEqual(['essential_duties_unknown']);
    }
    expect(run({ nocEssentialDutiesMatch: 'no' })).toMatchObject({ status: 'not_met', reasonCodes: ['essential_duties_mismatch'] });
    expect(run({ nocEssentialDutiesMatch: 'yes' }).status).toBe('met');
  });
  it('uses assessment date for ongoing work and leaves the end date absent', () => {
    const employment = sample({ ongoing: true, endDate: null });
    expect(evaluateCecWork(employment, '2025-12-31').status).toBe('not_met');
    expect(evaluateCecWork(employment, '2026-01-01').status).toBe('met');
    expect(employment.cecWork.endDate).toBeNull();
  });
  it('does not round a leap-day anniversary or Toronto midnight forward', () => {
    const employment = sample({ startDate: '2024-02-29', ongoing: true, endDate: null });
    expect(evaluateCecWork(employment, '2025-02-28')).toMatchObject({ status: 'needs_information', reasonCodes: ['calendar_boundary_review'] });
    expect(evaluateCecWork(employment, '2025-03-01').status).toBe('met');
    const rollover = sample({ startDate: '2025-10-25', ongoing: true, endDate: null });
    expect(evaluateCecWork(rollover, businessDate(new Date('2026-10-25T01:00:00Z'))).status).toBe('not_met');
    const lookback = sample({ startDate: '2020-01-01', ongoing: true, endDate: null });
    expect(evaluateCecWork(lookback, '2024-02-29').reasonCodes).toEqual(['calendar_boundary_review']);
  });
  it('rejects future, out-of-job and fabricated ongoing end dates', () => {
    for (const patch of [{ startDate: '2019-12-01' }, { endDate: '2026-01-02' }, { ongoing: true }]) {
      expect(() => validateEmployment(sample(patch), date)).toThrow();
    }
    expect(() => validateEmployment(sample({ ongoing: true, endDate: null }, { currentJob: false, endDate: '2025-12-31' }), date)).toThrow();
  });
  it('requires an allowlisted reviewed rule and explicit server date; draft cannot activate', () => {
    const policy = testCecPolicy();
    const reviewedDate = '2026-10-24';
    const selection = new PolicyRegistry([policy], [policyDigest(policy)]).active(policy.id, reviewedDate);
    expect(evaluatePolicy(selection, sample(), reviewedDate)[0]?.status).toBe('met');
    expect(() => evaluatePolicy(selection, sample())).toThrowError(expect.objectContaining({ code: 'ASSESSMENT_DATE_REQUIRED' }));
    const draft = { ...policy, review: { status: 'draft', reviewerId: null, reviewedAt: null } };
    expect(new PolicyRegistry([draft], [policyDigest(draft)]).available(reviewedDate)).toEqual([]);
  });
});
