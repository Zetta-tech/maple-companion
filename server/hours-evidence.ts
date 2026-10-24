/** Post-interpretation evidence checks, not a natural-language interpreter.
 * Every bounded message reaches the preview before these conservative checks.
 * They cannot prove meaning; exact review and production gating still apply.
 */
export const weeklyPeriodWasStated = (message: string) => /\b(?:weeks?|weekly)\b/i.test(message);

export function hoursEvidence(message: string, candidate: number): string | null {
  if (/\buser_[A-Za-z0-9]+\b/.test(message)) {
    return 'A chat message cannot select an account. Please describe a correction to your own current weekly hours.';
  }
  if (/\b(?:employer|title|country|noc|salary)\b/i.test(message)) {
    return 'This chat trial only changes weekly hours. Use the employment form for employer, job title or other details; no partial change was proposed.';
  }
  // Hold explicit counterfactual, non-current, negative or question markers even
  // if a model drops them and returns a confident-looking positive attribute.
  if (/\?|\b(?:if|unless|might|may|could|would|will|hypothetical|maybe|perhaps|not|never|no|next|tomorrow|previously|formerly)\b|\b\w+n['’]t\b|\bused\s+to\b/i.test(message)) {
    return 'Is this a confirmed change to your current hours, or a question or hypothetical? Please clarify before proposing a correction.';
  }
  if (/\b(?:days?|daily|months?|monthly|years?|yearly|fortnights?|fortnightly)\b/i.test(message)) {
    return 'Please clarify one current total in hours per week. Maple will not convert a different or conflicting period automatically.';
  }
  const numbers = message.match(/[-+]?\d+(?:\.\d+)?/g) ?? [];
  if (numbers.length !== 1 || Number(numbers[0]) !== candidate || !/\b(?:hours?|hrs?|weekly)\b/i.test(message)) {
    return 'Please clarify one current hours total in numbers. The preview did not establish a single value supported by your message.';
  }
  return null;
}
