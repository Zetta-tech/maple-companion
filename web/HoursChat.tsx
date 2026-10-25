import { useState, type FormEvent } from 'react';
import { clarificationQuestion, type HoursAnswer, type HoursClarification } from '../shared/chat.js';

export function HoursChat({ available, disabled, busy, onPropose, clarification, onAnswer, blockedBy, activity }: {
  available: boolean; disabled: boolean; busy: boolean; onPropose: (message: string) => Promise<boolean>;
  clarification?: HoursClarification | null; onAnswer?: (answer: HoursAnswer, hours?: number) => Promise<void>;
  blockedBy?: 'pending' | 'save' | 'unavailable';
  activity?: 'preview' | 'clarification';
}) {
  const [message, setMessage] = useState('');
  const [synthetic, setSynthetic] = useState(false);
  if (!available) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || clarification || !synthetic || !message.trim()) return;
    if (await onPropose(message)) setMessage('');
  }
  return <section className="hours-chat" aria-labelledby="chat-heading">
    <p className="eyebrow">Synthetic test · weekly hours only</p>
    <h2 id="chat-heading" tabIndex={-1}>Describe an hours correction</h2>
    <p>Describe a correction to your current weekly hours in your own words. AM previews the meaning before Maple prepares a change for you to review. Nothing is saved to your employment record until you confirm it.</p>
    {blockedBy && <p className="notice" id="chat-blocked-reason" role="status">
      {blockedBy === 'pending' ? 'Chat is paused because a change is awaiting your review. Finish or discard that change before entering another correction. '
        : blockedBy === 'save' ? 'Chat is paused while an earlier save needs checking. Check its status before entering another correction. '
          : 'Chat is paused because your saved information could not be verified. Use Refresh status before entering a correction.'}
      {blockedBy !== 'unavailable' && <a href="#changes-heading">Go to Changes to review</a>}
    </p>}
    {clarification && onAnswer && <HoursClarificationCard key={clarification.id} value={clarification} disabled={disabled || busy} onAnswer={onAnswer} preparing={activity === 'clarification'} />}
    <form onSubmit={submit}><fieldset disabled={disabled || !!clarification} aria-describedby={blockedBy ? 'chat-blocked-reason' : clarification ? 'hours-clarification-heading' : undefined}>
      <legend className="visually-hidden">A fictional weekly-hours correction</legend>
      <label>Your correction<textarea name="chatMessage" rows={2} maxLength={500} value={message} required
        onChange={event => setMessage(event.target.value)} placeholder="I now work 36 hours per week." /></label>
      <label className="checkbox"><input type="checkbox" checked={synthetic} onChange={event => setSynthetic(event.target.checked)} />
        <span>This describes fictional test data.</span></label>
      <button type="submit" aria-busy={activity === 'preview'} disabled={!synthetic || !message.trim() || disabled}>{activity === 'preview' ? 'Interpreting your correction…' : 'Prepare proposal'}</button>
    </fieldset></form>
    {activity === 'preview' && <p className="work-progress" role="status">Checking the meaning of your message. Your saved record is unchanged.</p>}
    <p className="hint">Weekly hours are the only supported field. Review any inferred weekly period carefully. Uncertain wording or conflicting values need clarification; use the employment form for employer, title or other details.</p>
    <p className="hint">AM may retain an empty preview session. Pending proposals expire after 24 hours. Their wording is cleared when saved, discarded or by the app’s expiry cleanup. This is not a zero-retention service.</p>
  </section>;
}

export function HoursClarificationCard({ value, disabled, onAnswer, preparing = false }: {
  value: HoursClarification; disabled: boolean; onAnswer: (answer: HoursAnswer, hours?: number) => Promise<void>;
  preparing?: boolean;
}) {
  const [enteredHours, setEnteredHours] = useState('');
  const needsEntry = value.issue === 'field';
  const hours = needsEntry ? Number(enteredHours) : value.hours;
  const valid = hours !== null && Number.isFinite(hours) && hours > 0 && hours <= 168;
  return <div className="notice clarification" role="group" aria-labelledby="hours-clarification-heading">
    <p className="eyebrow">One detail to clarify</p>
    <h3 id="hours-clarification-heading" tabIndex={-1}>{clarificationQuestion(value)}</h3>
    <p>Choose what you mean. This answer does not save a fact. Actual weekly hours will still need a separate review and confirmation.</p>
    {needsEntry && <><p>AM returned a field Maple could not map. No value was adopted. You can enter a fresh answer here, or leave your record unchanged.</p>
      <label>My actual weekly working hours<input name="clarifiedWeeklyHours" type="number" min="0.01" max="168" step="any" value={enteredHours} disabled={disabled} onChange={event => setEnteredHours(event.target.value)} /></label></>}
    <div className="clarification-actions">
      <button type="button" disabled={disabled || !valid} onClick={() => void onAnswer('actual_weekly_work', needsEntry && valid ? hours! : undefined)}>{needsEntry ? 'Use my entered actual weekly hours - prepare review' : `${value.hours} is my actual weekly work total - prepare review`}</button>
      <button type="button" className="secondary" disabled={disabled} onClick={() => void onAnswer('availability_only')}>Availability only — leave my record unchanged</button>
      <button type="button" className="secondary" disabled={disabled} onClick={() => void onAnswer('different_period')}>Different period or unclear — start again</button>
    </div>
    {preparing && <p className="work-progress" role="status">Applying your answer. Any change still needs your separate confirmation.</p>}
  </div>;
}
