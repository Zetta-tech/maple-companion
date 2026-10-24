const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Maple's assessment calendar. User-entered date-only strings are never converted. */
export function businessDate(now: Date): string {
  const parts = formatter.formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** First instant of the next Toronto day, including 23- and 25-hour DST days. */
export function nextBusinessDay(now: Date): Date {
  const date = businessDate(now);
  let before = now.getTime();
  let after = before + 26 * 60 * 60 * 1000;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (businessDate(new Date(middle)) === date) before = middle;
    else after = middle;
  }
  return new Date(after);
}
