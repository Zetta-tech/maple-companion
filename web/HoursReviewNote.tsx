export function HoursReviewNote({ utterance, oldHours, newHours, periodSource, expiresAt, clarificationAnswer, clarificationSource }: {
  utterance: string; oldHours: number | null; newHours: number; periodSource: 'message' | 'interpretation'; expiresAt: string;
  clarificationAnswer?: 'actual_weekly_work';
  clarificationSource?: 'user_entered';
}) {
  return <aside className="notice">
    <strong>Update weekly hours from {oldHours ?? 'not recorded'} to {newHours}?</strong>
    <p>Your message: {utterance}</p>
    {clarificationSource === 'user_entered' ? <p>You entered {newHours} as your actual weekly work total after Maple could not map AM’s candidate. This is your explicit answer, not a successful AM interpretation. It prepared this review and has not saved the change.</p>
      : clarificationAnswer ? <p>You clarified that {newHours} is your actual weekly work total. This answer prepared the review; it did not save the change.</p>
      : periodSource === 'interpretation' && <p>Maple could not clearly link a weekly period to this amount in your message. This proposal interprets the total as hours per week. Confirm only if that matches what you meant.</p>}
    <p>This proposal changes only weekly hours. It does not apply other changes mentioned in your message. Use the employment form for other details.</p>
    <p>Review the exact change below. Your saved record stays unchanged until you select Confirm and save.</p>
    <p className="hint">This proposal expires {new Date(expiresAt).toLocaleString()}.</p>
  </aside>;
}
