export type HoursClarification = {
  id: string;
  hours: number | null;
  issue: 'period' | 'intent' | 'field';
  expiresAt: string;
};
export type HoursAnswer = 'actual_weekly_work' | 'availability_only' | 'different_period';
export function clarificationQuestion(value: HoursClarification) {
  if (value.issue === 'field') return 'Do you want to update your actual weekly working hours?';
  return value.issue === 'intent'
    ? `Are ${value.hours} hours your actual weekly working hours, or only your availability?`
    : `Do you mean ${value.hours} hours per week of actual work in your current job?`;
}
export function validHoursQuestion(hours: number | null, issue: HoursClarification['issue']) {
  return issue === 'field' ? hours === null : ['period', 'intent'].includes(issue) && hours !== null && Number.isFinite(hours) && hours > 0 && hours <= 168;
}
