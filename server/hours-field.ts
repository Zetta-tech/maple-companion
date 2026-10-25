export const candidateFields = ['employment_record', 'hours_per_week', 'weekly_hours', 'hoursPerWeek', 'working_hours', 'work_hours'] as const;
type Field = typeof candidateFields[number];
function formattedKey(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().trim().replace(/[ _-]+/g, '_');
}
const aliases: Record<string, Field> = {
  weekly_work_hours: 'hours_per_week', weekly_working_hours: 'hours_per_week', work_hours_per_week: 'hours_per_week',
  working_hours_per_week: 'hours_per_week', actual_weekly_work_hours: 'hours_per_week',
};
/** Known work-hours concepts plus formatting equivalence; not a substring matcher. */
export function recognizedHoursField(value: unknown): Field | null {
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z _-]+$/.test(value)) return null;
  const normalized = formattedKey(value);
  return candidateFields.find(field => formattedKey(field) === normalized) ?? (Object.hasOwn(aliases, normalized) ? aliases[normalized]! : null);
}
export const diagnosticFieldTokens = ['employment', 'record', 'hours', 'per', 'week', 'weekly', 'working', 'work', 'current', 'actual', 'total', 'time', 'schedule', 'availability'] as const;
/** Model keys may contain personal text. Unknown token text is never retained. */
export function fieldHint(value: unknown) {
  const text = typeof value === 'string' ? value.slice(0, 64) : '';
  const tokens = formattedKey(text).split(/[^a-z]+/).filter(Boolean).slice(0, 16);
  const recognized = tokens.filter((token): token is typeof diagnosticFieldTokens[number] => diagnosticFieldTokens.includes(token as typeof diagnosticFieldTokens[number]));
  return { recognizedTokens: [...new Set(recognized)], unknownTokenCount: tokens.length - recognized.length,
    identifierShape: typeof value !== 'string' ? 'non_string' as const : value.length > 64 || !/^[A-Za-z _-]+$/.test(value) ? 'redacted' as const : 'identifier' as const };
}
