/** Read-only unit provenance for proposals stored by the retired hours-chat trial.
 * This never interprets a new message or gates native AM conversation.
 */
const otherCadence = /\b(?:days?|daily|months?|monthly|years?|yearly|fortnights?|fortnightly|(?:bi|semi)[ -]?weekly)\b|\b(?:every\s+(?:other|second)|twice\s+(?:a|per|each))\s+week\b|\balternat(?:e|ing)\s+weeks?\b/i;
// An explicitly supplied, unknown unit is different from an omitted unit. Do not
// silently turn "per shift" or "every pay period" into a weekly total.
const unresolvedCadence = /\b(?:hours?|hrs?)\s*(?:\b(?:per|a|each|every)\b\s+|\/\s*)(?!week\b|wk\b)[a-z]+/i;
const quantity = '(\\d+(?:\\.\\d+)?)';
const hours = '(?:hours?|hrs?)';
const weeklyUnit = '(?:(?:per|a|each|every)\\s+week|/\\s*(?:week|wk)|weekly)';
const weeklyMeasurements = [
  new RegExp(`\\b${quantity}\\s*${hours}\\s*${weeklyUnit}\\b`, 'gi'),
  new RegExp(`\\b${quantity}\\s+weekly\\s+${hours}\\b`, 'gi'),
  new RegExp(`\\b(?:weekly\\s+${hours}|${hours}\\s+${weeklyUnit})\\s*(?:(?:are|is|to)\\s+|[:=]\\s*)?${quantity}\\b`, 'gi'),
];

/** Positive unit provenance must attach to this quantity, not a nearby week word.
 * Unrecognized phrasing conservatively keeps the inferred-period disclosure.
 * This checks a historical measurement fragment only.
 */
export function weeklyPeriodWasStated(message: string, candidate: number | null): boolean {
  if (candidate === null || otherCadence.test(message) || unresolvedCadence.test(message)) return false;
  return weeklyMeasurements.some(pattern => [...message.matchAll(pattern)].some(match => Number(match[1]) === candidate));
}
