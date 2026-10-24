export function HoursReviewNote({ utterance, oldHours, newHours, periodSource, expiresAt }: {
  utterance: string; oldHours: number | null; newHours: number; periodSource: 'message' | 'interpretation'; expiresAt: string;
}) {
  return <aside className="notice">
    <strong>Update weekly hours from {oldHours ?? 'not recorded'} to {newHours}?</strong>
    <p>Your message: {utterance}</p>
    {periodSource === 'interpretation' && <p>Your message did not state a weekly period. This proposal interprets the total as hours per week. Confirm only if that matches what you meant.</p>}
    <p>Review the exact change below. Your saved record stays unchanged until you select Confirm and save.</p>
    <p className="hint">This proposal expires {new Date(expiresAt).toLocaleString()}.</p>
  </aside>;
}
