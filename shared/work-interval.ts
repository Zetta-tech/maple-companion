/** Convert a recorded actual last day to an exclusive bound, never counting
 * experience on/after the assessment day. Callers validate dates first. */
export function workIntervalEnd(lastDay: string | null | undefined, assessmentDate: string): string {
  if (!lastDay) return assessmentDate;
  const nextDay = new Date(Date.parse(lastDay + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
  return nextDay < assessmentDate ? nextDay : assessmentDate;
}
