export type HoursClarification = {
  id: string;
  hours: number;
  issue: 'period' | 'intent';
  expiresAt: string;
};
export type HoursAnswer = 'actual_weekly_work' | 'availability_only' | 'different_period';
export function clarificationQuestion(value: HoursClarification) {
  return value.issue === 'intent'
    ? `Are ${value.hours} hours your actual weekly working hours, or only your availability?`
    : `Do you mean ${value.hours} hours per week of actual work in your current job?`;
}
