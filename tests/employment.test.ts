import { describe, expect, it } from 'vitest';
import { completedEmploymentYears, employmentSchema, validateEmployment, type Employment } from '../shared/employment.js';

const assessmentDate = '2026-10-24';
const currentJob: Employment = {
  employer: 'Example employer',
  title: 'Software developer',
  duties: 'Implement and maintain software applications.',
  startDate: '2025-10-25',
  currentJob: true,
  endDate: null,
  hoursPerWeek: 30,
  countryCode: 'CA',
  paid: 'yes',
  authorizedToWork: 'unknown',
  nocCode: null,
  nocReviewed: false,
};

describe('employment validation', () => {
  it('accepts an ongoing job without fabricating its end date', () => {
    const result = validateEmployment(currentJob, assessmentDate);
    expect(result.endDate).toBeNull();
    expect(currentJob.endDate).toBeNull();
  });

  it('requires an actual end date for a past job', () => {
    expect(() => validateEmployment({ ...currentJob, currentJob: false }, assessmentDate)).toThrow();
    expect(validateEmployment({ ...currentJob, currentJob: false, endDate: '2026-10-23' }, assessmentDate).endDate)
      .toBe('2026-10-23');
  });

  it('rejects an end date on an ongoing job', () => {
    expect(() => validateEmployment({ ...currentJob, endDate: assessmentDate }, assessmentDate)).toThrow();
  });

  it('rejects an end date before the start date', () => {
    expect(() => validateEmployment({ ...currentJob, currentJob: false, endDate: '2025-10-24' }, assessmentDate)).toThrow();
  });

  it('accepts same-day employment without claiming a completed year', () => {
    const job = { ...currentJob, currentJob: false, endDate: currentJob.startDate };
    expect(completedEmploymentYears(job, assessmentDate)).toBe(0);
  });

  it.each(['2025-02-29', '2024-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '0000-01-01', '2026-1-01', '2026-01-01T00:00:00Z'])
    ('rejects invalid calendar dates: %s', (startDate) => {
      expect(() => validateEmployment({ ...currentJob, startDate }, assessmentDate)).toThrow();
    });

  it('accepts a genuine leap day', () => {
    expect(validateEmployment({ ...currentJob, startDate: '2024-02-29' }, assessmentDate).startDate).toBe('2024-02-29');
  });

  it('rejects future start and end dates', () => {
    expect(() => validateEmployment({ ...currentJob, startDate: '2026-10-25' }, assessmentDate)).toThrow();
    expect(() => validateEmployment({ ...currentJob, currentJob: false, endDate: '2026-10-25' }, assessmentDate)).toThrow();
  });

  it('validates the assessment date itself', () => {
    expect(() => validateEmployment(currentJob, '2026-02-30')).toThrow();
    expect(() => validateEmployment(currentJob, 'tomorrow')).toThrow();
  });

  it('rejects extra fields including client-selected ownership', () => {
    expect(() => validateEmployment({ ...currentJob, owner: 'another-user' }, assessmentDate)).toThrow();
  });

  it.each([0, -1, 169, Infinity, NaN, '30'])('rejects invalid hours: %s', (hoursPerWeek) => {
    expect(() => validateEmployment({ ...currentJob, hoursPerWeek }, assessmentDate)).toThrow();
  });

  it('preserves unknown hours and distinct answer states', () => {
    for (const answer of ['yes', 'no', 'unknown', 'not_applicable'] as const) {
      const result = validateEmployment({ ...currentJob, hoursPerWeek: null, paid: answer, authorizedToWork: answer }, assessmentDate);
      expect(result.hoursPerWeek).toBeNull();
      expect(result.paid).toBe(answer);
      expect(result.authorizedToWork).toBe(answer);
    }
    expect(() => validateEmployment({ ...currentJob, paid: false }, assessmentDate)).toThrow();
  });

  it('accepts a reviewed NOC only with duties', () => {
    const reviewed = { ...currentJob, nocCode: '21232', nocReviewed: true };
    expect(validateEmployment(reviewed, assessmentDate).nocCode).toBe('21232');
    expect(() => validateEmployment({ ...reviewed, duties: '  ' }, assessmentDate)).toThrow();
    expect(() => validateEmployment({ ...reviewed, nocReviewed: false }, assessmentDate)).toThrow();
    expect(() => validateEmployment({ ...currentJob, nocReviewed: true }, assessmentDate)).toThrow();
  });

  it('allows duties to remain unrecorded when no NOC is selected', () => {
    expect(validateEmployment({ ...currentJob, duties: '' }, assessmentDate).duties).toBe('');
  });

  it('rejects missing required answers and malformed NOC/country codes', () => {
    expect(employmentSchema.safeParse({ ...currentJob, paid: undefined }).success).toBe(false);
    expect(employmentSchema.safeParse({ ...currentJob, countryCode: 'Canada' }).success).toBe(false);
    expect(employmentSchema.safeParse({ ...currentJob, nocCode: '2123', nocReviewed: true }).success).toBe(false);
  });
});

describe('completed elapsed calendar years, not qualifying experience', () => {
  it('does not round nearly one year up to a completed year', () => {
    expect(completedEmploymentYears(currentJob, assessmentDate)).toBe(0);
    expect(completedEmploymentYears(currentJob, '2026-10-25')).toBe(1);
  });

  it('uses the assessment date only for ongoing employment', () => {
    expect(completedEmploymentYears(currentJob, '2027-10-25')).toBe(2);
    const pastJob = { ...currentJob, currentJob: false, endDate: '2026-10-24' };
    expect(completedEmploymentYears(pastJob, '2027-10-25')).toBe(0);
    expect(currentJob.endDate).toBeNull();
  });

  it('uses March 1 for a February 29 anniversary in a non-leap year', () => {
    const leapJob = { ...currentJob, startDate: '2024-02-29' };
    expect(completedEmploymentYears(leapJob, '2025-02-28')).toBe(0);
    expect(completedEmploymentYears(leapJob, '2025-03-01')).toBe(1);
    expect(completedEmploymentYears(leapJob, '2028-02-29')).toBe(4);
  });

  it('rejects invalid date order instead of returning negative duration', () => {
    expect(() => completedEmploymentYears(currentJob, '2025-10-24')).toThrow();
  });
});
