import type { Employment } from '../../shared/employment.js';
import type { PolicyCriterion } from '../../shared/policy.js';
import { makeTestPolicy } from './test-policy.js';

export const testCecCriterion: PolicyCriterion = { id: 'synthetic-cec-work', title: 'SYNTHETIC CEC work-interval test',
  kind: 'cec_work_experience', calculation: 'single-interval-v1', minimumCalendarMonths: 12,
  minimumHours: 1560, weeklyCap: 30, lookbackYears: 3 };
export function testCecPolicy() { return { ...makeTestPolicy(), criteria: [testCecCriterion] }; }
export function testCecEmployment(): Employment {
  return { employer: 'SYNTHETIC CEC FIXTURE employer', title: 'SYNTHETIC analyst', duties: 'SYNTHETIC duties reviewed only for isolated automated tests.',
    startDate: '2020-01-01', currentJob: true, endDate: null, hoursPerWeek: 30, countryCode: 'CA', paid: 'yes',
    authorizedToWork: 'yes', nocCode: '21221', nocReviewed: true,
    cecWork: { startDate: '2025-01-01', ongoing: false, endDate: '2025-12-31', hoursPerWeek: 30,
      singleIntervalComplete: 'yes', conditionsConsistent: 'yes', physicallyInCanada: 'yes',
      authorizedTemporaryResident: 'yes', paid: 'yes', relationship: 'employee', physicianException: 'not_applicable',
      fullTimeStudy: 'no', workArrangement: 'onsite', canadianEmployer: 'unknown', nocDutiesMatch: 'yes', nocEssentialDutiesMatch: 'yes' } };
}
