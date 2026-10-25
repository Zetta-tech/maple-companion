import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { NATIVE_MESSAGE_MAX_LENGTH, nativeMessageTextSchema, nativeStatusText, type NativeMessageResult, type NativeProfile } from '../shared/native-chat.js';
import { nativePendingAfterFailure } from './request.js';
import { NativeAssessmentGate, sendWithAssessmentHold } from './native-assessment-gate.js';
import './NativeMemoryPanel.css';

const statusHeading = {
  verified: 'Update confirmed', processing: 'Updating your details',
  unverified: 'Update needs checking', uncertain: 'Update status unknown',
} as const;

function MemoryUpdate({ item }: { item: NativeMessageResult }) {
  const tone = item.status === 'verified' ? 'success' : item.status === 'processing' ? 'pending' : 'warning';
  return <article className={`memory-update memory-update--${tone}`}>
    <div className="memory-update-heading"><strong>{statusHeading[item.status]}</strong>
      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>
    <p>{nativeStatusText[item.status]}</p>
    {item.warnings.length > 0 && <details><summary>More details</summary>{item.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</details>}
  </article>;
}

export function NativeMemoryView({ profile, history, loading = false }: {
  profile: NativeProfile | null; history: NativeMessageResult[]; loading?: boolean;
}) {
  const [latest, ...earlier] = history;
  return <div className="memory-overview">
    <div aria-live="polite" aria-atomic="true">{!loading && latest && <><p className="hint">Latest conversation update — separate from your saved assessment inputs.</p><MemoryUpdate item={latest} /></>}</div>
    <div className="memory-current">
      <h3>Current details</h3>
      {loading ? <p className="memory-placeholder" role="status">Checking your remembered details…</p>
        : profile ? <>
          <p className="memory-source">From your remembered profile · Checked <time dateTime={profile.checkedAt}>{new Date(profile.checkedAt).toLocaleString()}</time></p>
          {!profile.complete && <p className="memory-caution">Some details could not be loaded. This may not be your complete profile.</p>}
          {profile.unresolved > 0 && <p className="memory-caution">Some details still need clarification. Check them before relying on this profile.</p>}
          {profile.facts.length ? <dl className="memory-facts">{profile.facts.map((fact, index) => <div key={`${fact.key}-${index}`}><dt>{fact.key.replaceAll('_', ' ')}</dt><dd>{fact.value}</dd></div>)}</dl>
            : <div className="memory-placeholder"><strong>No details to show yet</strong><p>Your earlier messages may still be stored. Share an update, then refresh to check what is remembered.</p></div>}
          {profile.instructions.length > 0 && <details className="memory-disclosure"><summary>Remembered instructions</summary><ul>{profile.instructions.map((instruction, index) => <li key={index}><strong>{instruction.label}</strong><p>{instruction.description}</p></li>)}</ul></details>}
          <p className="hint"><a href="#employment-heading">Review assessment inputs</a> before using these details for an assessment.</p>
        </> : <p className="memory-placeholder">Your remembered details are not available right now. Refresh to check again.</p>}
    </div>
    {earlier.length > 0 && <details className="memory-disclosure memory-history"><summary>Earlier updates ({earlier.length})</summary>
      {earlier.map(item => <MemoryUpdate item={item} key={item.requestId} />)}
    </details>}
  </div>;
}

const noAssessmentHold = (_held: boolean) => {};
export function NativeMemoryPanel({ request, onChanged, onAssessmentHold = noAssessmentHold }: {
  request: <T>(path: string, body?: unknown) => Promise<T>; onChanged: () => void; onAssessmentHold?: (held: boolean) => void;
}) {
  const assessmentGate = useMemo(() => new NativeAssessmentGate(onAssessmentHold), [onAssessmentHold]);
  const [available, setAvailable] = useState(false);
  const [profile, setProfile] = useState<NativeProfile | null>(null);
  const [history, setHistory] = useState<NativeMessageResult[]>([]);
  const [message, setMessage] = useState('');
  const [synthetic, setSynthetic] = useState(false);
  const [syntheticOnly, setSyntheticOnly] = useState(true);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notSent, setNotSent] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  async function refresh() {
    assessmentGate.checking();
    setBusy(true); setError(''); setNotSent(false); setProfile(null);
    try {
      const status = await request<{ available: boolean; history: NativeMessageResult[]; syntheticOnly?: boolean }>('/api/native/status');
      setAvailable(status.available); setHistory(status.history); setSyntheticOnly(status.syntheticOnly !== false);
      assessmentGate.refresh(status.history);
      if (requestId && status.history.some(item => item.requestId === requestId && item.status !== 'processing')) { setRequestId(null); setMessage(''); }
      if (status.available) setProfile(await request<NativeProfile>('/api/native/profile'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Current memory could not be verified.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, [request, assessmentGate]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if ((syntheticOnly && !synthetic) || !message.trim() || busy || !available || requestId) return;
    if (!nativeMessageTextSchema.safeParse(message).success) {
      setNotSent(true); setError('Keep each update to 5,000 characters or fewer. Shorten it and send it again.'); return;
    }
    const id = crypto.randomUUID();
    setRequestId(id); setBusy(true); setError(''); setNotSent(false); setProfile(null);
    try {
      const result = await sendWithAssessmentHold(assessmentGate, id,
        () => request<NativeMessageResult>('/api/native/messages', { requestId: id, message, syntheticTest: syntheticOnly }));
      setHistory(current => [result, ...current.filter(item => item.requestId !== id)]);
      setRequestId(null); setMessage(''); onChanged();
      setProfile(await request<NativeProfile>('/api/native/profile'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The message outcome is unknown. Refresh status before submitting again.');
      const pending = nativePendingAfterFailure(id, reason);
      if (pending === null) { setRequestId(null); setNotSent(true); }
      else onChanged(); // Possible write: refresh reads status; never replay ingestion.
    } finally { setBusy(false); }
  }
  const unresolved = history.some(item => item.status === 'processing' || item.status === 'uncertain');
  const processing = busy && requestId !== null || history.some(item => item.status === 'processing');
  return <section className="form-panel native-memory" aria-labelledby="native-memory-heading">
    <div className="section-heading"><h2 id="native-memory-heading">Your remembered information</h2><button type="button" className="secondary" disabled={busy} onClick={refresh}>Refresh memory</button></div>
    <p className="memory-intro">See what is remembered, then share anything that has changed.</p>
    {!available && !busy && !error && <p className="memory-caution">Profile updates aren't available yet. You can still review the assessment inputs below.</p>}
    {error && <div className="notice error" role="alert"><strong>{notSent ? 'Message not sent' : requestId ? 'Update status unknown' : 'Your details could not be checked'}</strong>
      {notSent ? <p>{error} Your message is still here to edit and send when you're ready.</p>
        : <><p>Refresh to check the latest status.{requestId && ' Please do not send the message again yet.'}</p>
          <details><summary>More details</summary><p>{error}</p></details></>}
    </div>}
    {(unresolved || requestId) && <p className="memory-caution" role="status">{processing
      ? 'Your message is being processed. Please wait before sending anything else.'
      : "We couldn't confirm whether your earlier update finished. Refresh its status before sending anything else."}</p>}
    <div className="memory-layout">
    <NativeMemoryView profile={profile} history={history} loading={busy} />
    <form className="memory-composer" onSubmit={send}><h3>Share an update</h3>
      <p className="hint">Correct a detail or tell us what has changed, in your own words.</p>
      {syntheticOnly && <p className="memory-test-note">Test version: use fictional information only. Your messages may be stored.</p>}
      <fieldset disabled={!available || busy || unresolved || requestId !== null}>
      <legend className="visually-hidden">Update remembered information</legend>
      <label>What has changed?<textarea rows={3} maxLength={NATIVE_MESSAGE_MAX_LENGTH} aria-describedby="native-message-size" value={message} onChange={event => setMessage(event.target.value)} /></label>
      <p className="hint" id="native-message-size">Up to 5,000 characters per update.</p>
      {syntheticOnly && <label className="checkbox"><input type="checkbox" checked={synthetic} onChange={event => setSynthetic(event.target.checked)} /><span>This message contains fictional test information.</span></label>}
      <button type="submit" disabled={(syntheticOnly && !synthetic) || !message.trim() || busy}>{busy && requestId ? 'Sending…' : 'Send'}</button>
      <p className="hint">Sending stores your message. The assessment inputs below change only when you review and save them.</p>
    </fieldset><p className="hint memory-conversation-note">Conversational replies are not available yet.</p></form>
    </div>
  </section>;
}
