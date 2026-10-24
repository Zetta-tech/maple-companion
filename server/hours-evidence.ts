import type { PreviewReason } from './preview-diagnostics.js';
/** Post-interpretation evidence checks, not a natural-language interpreter.
 * Every bounded message reaches the preview before these conservative checks.
 * They cannot prove meaning; exact review and production gating still apply.
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
 * This checks a measurement fragment; it does not gate input before AM preview.
 */
export function weeklyPeriodWasStated(message: string, candidate: number | null): boolean {
  if (candidate === null || otherCadence.test(message) || unresolvedCadence.test(message)) return false;
  return weeklyMeasurements.some(pattern => [...message.matchAll(pattern)].some(match => Number(match[1]) === candidate));
}

export function hoursEvidenceIssue(message: string, candidate: number): { reason: PreviewReason; message: string } | null {
  if (/\buser_[A-Za-z0-9]+\b/.test(message)) {
    return { reason: 'MAPLE_ACCOUNT_SELECTOR', message: 'A chat message cannot select an account. Please describe a correction to your own current weekly hours.' };
  }
  if (/\b(?:employer|title|country|noc|salary|unpaid)\b/i.test(message)) {
    return { reason: 'MAPLE_UNSUPPORTED_FIELD', message: 'This chat trial only changes weekly hours. Use the employment form for employer, job title, paid status or other details; no partial change was proposed.' };
  }
  // Hold explicit counterfactual, non-current, negative or question markers even
  // if a model drops them and returns a confident-looking positive attribute.
  if (/\?|\b(?:if|unless|might|may|could|would|will|hypothetical|maybe|perhaps|not|never|no|next|tomorrow|previously|formerly)\b|\b\w+n['’]t\b|\bused\s+to\b/i.test(message)) {
    return { reason: 'MAPLE_NONCURRENT_OR_NEGATED', message: 'Is this a confirmed change to your current hours, or a question or hypothetical? Please clarify before proposing a correction.' };
  }
  if (otherCadence.test(message) || unresolvedCadence.test(message)) {
    return { reason: 'MAPLE_CADENCE_UNRESOLVED', message: 'Please clarify one current total in hours per week. Maple will not convert a different or conflicting period automatically.' };
  }
  const numbers = message.match(/[-+]?\d+(?:\.\d+)?/g) ?? [];
  if (numbers.length !== 1 || Number(numbers[0]) !== candidate || !/\b(?:hours?|hrs?|weekly)\b/i.test(message)) {
    return { reason: 'MAPLE_VALUE_UNGROUNDED', message: 'Please clarify one current hours total in numbers. The preview did not establish a single value supported by your message.' };
  }
  return null;
}
export const hoursEvidence = (message: string, candidate: number) => hoursEvidenceIssue(message, candidate)?.message ?? null;

// A conservative post-preview signal, never a classifier of actual employment.
// If the model drops a capacity qualifier, ask the user instead of accepting it.
export const capacityWasMentioned = (message: string) => /\b(?:can|able|available|availability|capacity)\b/i.test(message);
