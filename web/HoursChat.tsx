import { useState, type FormEvent } from 'react';

export function HoursChat({ available, disabled, busy, onPropose }: {
  available: boolean; disabled: boolean; busy: boolean; onPropose: (message: string) => Promise<boolean>;
}) {
  const [message, setMessage] = useState('');
  const [synthetic, setSynthetic] = useState(false);
  if (!available) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || !synthetic || !message.trim()) return;
    if (await onPropose(message.trim())) setMessage('');
  }
  return <section className="hours-chat" aria-labelledby="chat-heading">
    <p className="eyebrow">Synthetic test · weekly hours only</p>
    <h2 id="chat-heading">Describe an hours correction</h2>
    <p>Try “I now work 36 hours per week.” Maple will prepare a change for you to review. Nothing is saved to your employment record until you confirm it.</p>
    <form onSubmit={submit}><fieldset disabled={disabled}>
      <legend className="visually-hidden">A fictional weekly-hours correction</legend>
      <label>Your correction<textarea name="chatMessage" rows={2} maxLength={500} value={message} required
        onChange={event => setMessage(event.target.value)} placeholder="I now work 36 hours per week." /></label>
      <label className="checkbox"><input type="checkbox" checked={synthetic} onChange={event => setSynthetic(event.target.checked)} />
        <span>This describes fictional test data.</span></label>
      <button type="submit" disabled={!synthetic || !message.trim() || disabled}>{busy ? 'Please wait.' : 'Prepare proposal'}</button>
    </fieldset></form>
    <p className="hint">This limited trial accepts one explicit hours correction at a time. Questions, uncertain wording and other details need clarification or the employment form. Up to five previews per day.</p>
    <p className="hint">AM may retain an empty preview session. Pending proposals expire after 24 hours. Their wording is cleared when saved, discarded or by the app’s expiry cleanup. This is not a zero-retention service.</p>
  </section>;
}
