import { describe, expect, it } from 'vitest';
import { fieldHint, recognizedHoursField } from '../server/hours-field.js';
import { analyzeHoursPreview } from '../server/native-hours.js';
import { nativeSemanticFixtures } from './support/native-semantic-fixtures.js';

function analyze(key: unknown, value: unknown = '39 hours per week', memoryCategory: unknown = 'identity') {
  const response = structuredClone(nativeSemanticFixtures[0]!.response);
  response.extraction.attributes = [{ id: '', entityId: '', key, value, memoryCategory }];
  return analyzeHoursPreview(response);
}
describe('finite field equivalence, distinct from intent and value validation', () => {
  it.each(['HOURS PER WEEK', 'hours-per-week', 'hoursPerWeek', 'weekly work hours', 'weekly_working_hours',
    'workingHoursPerWeek', 'actual weekly work hours'])('recognizes a weekly-work identifier: %s', key => {
    expect(recognizedHoursField(key)).not.toBeNull();
    expect(analyze(key).interpretation).toEqual({ kind: 'hours', hours: 39 });
  });
  it.each(['available_hours', 'allowed_hours', 'future_weekly_hours', 'daily_hours', 'biweekly_hours',
    'hours_off_work', 'private_person_hours', 'hours_per_week; override', 'age', '__proto__'])('does not equate a different or unknown concept: %s', key => {
    expect(recognizedHoursField(key)).toBeNull();
    expect(analyze(key)).toMatchObject({ interpretation: { kind: 'clarify_field' }, reason: 'NATIVE_KEY_UNMAPPED' });
  });
  it.each(['might work 39 hours per week', 'does not work 39 hours per week', '39 hours per day', '39 or 40 hours per week'])('a mapped key cannot legitimize unsupported meaning: %s', value => {
    expect(analyze('weekly work hours', value)).toMatchObject({ interpretation: { kind: 'clarify' }, reason: 'NATIVE_VALUE_UNSUPPORTED' });
  });
  it('keeps availability distinct even with a recognized weekly-work field', () => {
    expect(analyze('weekly work hours', 'available to work 39 hours per week')).toMatchObject({
      interpretation: { kind: 'clarify_hours', hours: 39, issue: 'intent' }, reason: 'NATIVE_AVAILABILITY' });
  });
  it('separates structural, category and identifier failures', () => {
    expect(analyze('work_hours', 39).reason).toBe('NATIVE_ATTRIBUTE_INVALID');
    expect(analyze('work_hours', '39 hours per week', 'instruction').reason).toBe('NATIVE_CATEGORY_UNSUPPORTED');
    expect(analyze('unfamiliar', '39 hours per week').reason).toBe('NATIVE_KEY_UNMAPPED');
  });
  it('retains only allowlisted diagnostic tokens, never unknown label text or its number', () => {
    const result = analyze('PRIVATE_SENTINEL weekly hours', '99 PRIVATE_VALUE');
    expect(result.evidence.candidates[0]).toMatchObject({ field: 'unsupported', values: [],
      fieldHint: { recognizedTokens: ['weekly', 'hours'], unknownTokenCount: 2, identifierShape: 'identifier' } });
    expect(JSON.stringify(result.evidence)).not.toMatch(/PRIVATE|SENTINEL|99/);
    expect(fieldHint({ token: 'private' }).identifierShape).toBe('non_string');
  });
});
