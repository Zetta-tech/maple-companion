import { useState, type FormEvent } from 'react';
import { clarificationQuestion, type HoursAnswer, type HoursClarification } from '../shared/chat.js';

export function HoursChat({ available, disabled, busy, onPropose, clarification, onAnswer }: {
  available: boolean; disabled: boolean; busy: boolean; onPropose: (message: string) => Promise<boolean>;
  clarification?: HoursClarification | null; onAnswer?: (answer: HoursAnswer) => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [synthetic, setSynthetic] = useState(false);
  if (!available) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || !synthetic || !message.trim()) return;
    if (await onPropose(message)) setMessage('');
  }
  return <section className="hours-chat" aria-labelledby="chat-heading">
    <p className="eyebrow">Synthetic test · weekly hours only</p>
    <h2 id="chat-heading">Describe an hours correction</h2>
    <p>Describe a correction to your current weekly hours in your own words. AM previews the meaning before Maple prepares a change for you to review. Nothing is saved to your employment record until you confirm it.</p>
    {clarification && onAnswer && <HoursClarificationCard value={clarification} disabled={disabled || busy} onAnswer={onAnswer} />}
    <form onSubmit={submit}><fieldset disabled={disabled || !!clarification}>
      <legend className="visually-hidden">A fictional weekly-hours correction</legend>
      <label>Your correction<textarea name="chatMessage" rows={2} maxLength={500} value={message} required
        onChange={event => setMessage(event.target.value)} placeholder="I now work 36 hours per week." /></label>
      <label className="checkbox"><input type="checkbox" checked={synthetic} onChange={event => setSynthetic(event.target.checked)} />
        <span>This describes fictional test data.</span></label>
      <button type="submit" disabled={!synthetic || !message.trim() || disabled}>{busy ? 'Please wait.' : 'Prepare proposal'}</button>
    </fieldset></form>
    <p className="hint">Weekly hours are the only supported field. Review any inferred weekly period carefully. Uncertain wording or conflicting values need clarification; use the employment form for employer, title or other details.</p>
    <p className="hint">AM may retain an empty preview session. Pending proposals expire after 24 hours. Their wording is cleared when saved, discarded or by the app’s expiry cleanup. This is not a zero-retention service.</p>
  </section>;
}

export function HoursClarificationCard({ value, disabled, onAnswer }: {
  value: HoursClarification; disabled: boolean; onAnswer: (answer: HoursAnswer) => Promise<void>;
}) {
  return <div className="notice" role="group" aria-labelledby="hours-clarification-heading">
    <h3 id="hours-clarification-heading">{clarificationQuestion(value)}</h3>
    <p>Choose what you mean. This answer does not save a fact. Actual weekly hours will still need a separate review and confirmation.</p>
    <div className="clarification-actions">
      <button type="button" disabled={disabled} onClick={() => void onAnswer('actual_weekly_work')}>{value.hours} is my actual weekly work total — prepare review</button>
      <button type="button" className="secondary" disabled={disabled} onClick={() => void onAnswer('availability_only')}>Availability only — leave my record unchanged</button>
      <button type="button" className="secondary" disabled={disabled} onClick={() => void onAnswer('different_period')}>Different period or unclear — start again</button>
    </div>
  </div>;
}
