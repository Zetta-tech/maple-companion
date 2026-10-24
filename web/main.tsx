/// <reference types="vite/client" />
import { ClerkProvider, SignIn, UserButton, useAuth } from '@clerk/react';
import { StrictMode, useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { employmentSchema, type Employment } from '../shared/employment.js';
import './styles.css';
import { AssessmentPanel } from './AssessmentPanel.js';

type Snapshot = { revision: number; employment: Employment | null };
type Proposal = {
  id: string;
  proposalRevision: number;
  baseRevision: number;
  status: string;
  oldValue: Employment | null;
  newValue: Employment;
};
type Notification = { id: string; operationId: string | null; assessmentId: string | null; kind: 'saved' | 'assessed'; createdAt: string; revision: number };
type ApiErrorBody = { error?: { code?: string; message?: string } };

class RequestError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

async function readResponse<T>(response: Response): Promise<T> {
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new RequestError('The server returned an unreadable response. Check your connection and try again.', 'INVALID_RESPONSE'); }
  if (!response.ok) {
    const failure = body as ApiErrorBody;
    throw new RequestError(failure.error?.message ?? 'The request could not be completed.', failure.error?.code ?? 'REQUEST_FAILED');
  }
  return body as T;
}

const blankEmployment: Employment = {
  employer: '', title: '', duties: '', startDate: '', currentJob: true, endDate: null,
  hoursPerWeek: null, countryCode: '', paid: 'unknown', authorizedToWork: 'unknown',
  nocCode: null, nocReviewed: false,
};

const fields: ReadonlyArray<[keyof Employment, string]> = [
  ['employer', 'Employer'], ['title', 'Job title'], ['duties', 'Duties'],
  ['startDate', 'Start date'], ['currentJob', 'Current job'], ['endDate', 'End date'],
  ['hoursPerWeek', 'Hours per week'], ['countryCode', 'Country code'], ['paid', 'Paid work'],
  ['authorizedToWork', 'Authorized to work'], ['nocCode', 'NOC code'], ['nocReviewed', 'NOC reviewed by you'],
];

function displayValue(employment: Employment | null, field: keyof Employment): string {
  if (!employment) return 'Not recorded';
  const value = employment[field];
  if (field === 'endDate' && employment.currentJob) return 'None — ongoing job';
  if (value === null || value === '') return field === 'hoursPerWeek' ? 'Unknown' : 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === 'not_applicable') return 'Not applicable';
  if (value === 'unknown') return 'Unknown';
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return String(value);
}

function Shell({ children, account }: { children: ReactNode; account?: ReactNode }) {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><a className="brand" href="/" aria-label="Maple home">maple<span aria-hidden="true">.</span></a><span className="header-note">Your immigration companion</span>{account}</header>
    <main id="main">{children}</main>
    <footer>Your information stays yours to review. Employment details alone do not determine immigration eligibility.</footer>
  </>;
}

function Bootstrap() {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailure('');
    fetch('/api/config', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15_000) })
      .then(readResponse<{ clerkPublishableKey: string }>)
      .then((config) => {
        if (!config.clerkPublishableKey || !/^pk_(test|live)_/.test(config.clerkPublishableKey)) {
          throw new RequestError('Sign-in configuration is unavailable.', 'CONFIGURATION_REQUIRED');
        }
        if (active) setPublishableKey(config.clerkPublishableKey);
      })
      .catch(() => { if (active) setFailure('Maple cannot connect to sign-in yet. Your information has not been loaded or saved.'); });
    return () => { active = false; };
  }, [attempt]);
  if (!publishableKey) return <Shell><section className="narrow intro"><p className="eyebrow">Welcome to Maple</p><h1>Your next step starts with you.</h1>{failure
    ? <div className="notice error" role="alert"><p>{failure}</p><button type="button" className="secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>
    : <p role="status">Connecting to secure sign-in…</p>}</section></Shell>;
  return <ClerkProvider publishableKey={publishableKey}><AuthenticatedApp /></ClerkProvider>;
}

function AuthenticatedApp() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded) return <Shell><p className="loading" role="status">Loading secure sign-in…</p></Shell>;
  if (!isSignedIn) return <Shell><div className="sign-in-layout"><section className="intro"><p className="eyebrow">A little clarity for your next step</p><h1>Your story.<br />Your say.</h1><p>Keep your employment information up to date. You will review every change before it is saved.</p><p className="muted">Sign in to continue to your private workspace.</p></section><section className="sign-in" aria-label="Sign in"><SignIn routing="hash" /></section></div></Shell>;
  return <Workspace key={userId} />;
}

function Workspace() {
  const { getToken } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [form, setForm] = useState<Employment>({ ...blankEmployment });
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);

  const request = useCallback(async <T,>(path: string, body?: unknown): Promise<T> => {
    const token = await getToken();
    if (!token) throw new RequestError('Your session has ended. Sign in again before continuing.', 'UNAUTHENTICATED');
    let response: Response;
    try {
      response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(25_000),
      });
    } catch { throw new RequestError('The connection was interrupted. Refresh the change status before trying again.', 'CONNECTION_INTERRUPTED'); }
    return readResponse<T>(response);
  }, [getToken]);

  const load = useCallback(async (resetForm = false) => {
    // An uncertain write deliberately blocks the authoritative snapshot. Operational
    // statuses must still load so a restarted client can reach reconciliation.
    setSnapshot(null);
    const [nextSnapshot, changes, inbox] = await Promise.allSettled([
      request<Snapshot>('/api/employment'),
      request<{ proposals: Proposal[] }>('/api/proposals'),
      request<{ notifications: Notification[] }>('/api/notifications'),
    ]);
    if (changes.status === 'fulfilled') setProposals(changes.value.proposals);
    if (inbox.status === 'fulfilled') setNotifications(inbox.value.notifications);

    const hasUncertainSave = changes.status === 'fulfilled'
      && changes.value.proposals.some((proposal) => ['applying', 'uncertain'].includes(proposal.status));
    if (nextSnapshot.status === 'fulfilled' && changes.status === 'fulfilled' && !hasUncertainSave) {
      setSnapshot(nextSnapshot.value);
      if (resetForm) setForm(nextSnapshot.value.employment ?? { ...blankEmployment });
    }

    // Apply every successful response before reporting a partial failure. Never
    // restore an older snapshot when the current save or status cannot be verified.
    if (nextSnapshot.status === 'rejected') throw nextSnapshot.reason;
    if (changes.status === 'rejected') throw changes.reason;
    if (hasUncertainSave) throw new RequestError('A previous save needs reconciliation. Use Check save status before editing.', 'RECONCILIATION_REQUIRED');
    if (inbox.status === 'rejected') throw inbox.reason;
    return nextSnapshot.value;
  }, [request]);

  useEffect(() => {
    let active = true;
    load(true).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Your information could not be loaded.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  function update<K extends keyof Employment>(field: K, value: Employment[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...((field === 'duties' || field === 'title') && value !== current[field] ? { nocReviewed: false } : {}),
    }));
  }

  async function refresh() {
    setBusy(true); setError(''); setMessage('');
    try { await load(snapshot === null); setMessage('Your saved information and change statuses are up to date.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Your information could not be refreshed.'); }
    finally { setBusy(false); }
  }

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    setError(''); setMessage('');
    const parsed = employmentSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => `${fields.find(([key]) => key === issue.path[0])?.[1] ?? 'Employment'}: ${issue.message}`).join(' '));
      return;
    }
    setBusy(true);
    try {
      const proposal = await request<Proposal>('/api/proposals', { baseRevision: snapshot.revision, employment: parsed.data });
      setProposals((current) => [proposal, ...current.filter((item) => item.id !== proposal.id)]);
      setReviewId(proposal.id);
      setMessage('Your change is ready for review. It has not been saved to your employment record.');
      requestAnimationFrame(() => document.getElementById('review-heading')?.focus());
    } catch (reason) {
      setError(`Your employment record has not been changed. ${reason instanceof Error ? reason.message : 'The proposal could not be created.'}`);
    } finally { setBusy(false); }
  }

  async function decide(proposal: Proposal, decision: 'confirm' | 'reject') {
    setBusy(true); setError(''); setMessage('');
    try {
      const outcome = await request<{ status: string }>(`/api/proposals/${encodeURIComponent(proposal.id)}/${decision}`, { proposalRevision: proposal.proposalRevision });
      await load(decision === 'confirm' && outcome.status === 'committed');
      if (decision === 'reject') {
        setReviewId(null); setMessage('The proposed change was discarded.');
      } else if (outcome.status === 'committed') {
        setReviewId(null); setMessage('Your employment change was saved.');
      } else {
        setMessage('This change is still being checked. Its save is not confirmed; review its status before making another change.');
      }
    } catch (reason) {
      setError(`${decision === 'confirm' ? 'We could not confirm that this change was saved. Check its status before retrying.' : 'We could not confirm that the proposal was discarded.'} ${reason instanceof Error ? reason.message : 'Please refresh the status.'}`);
      if (decision === 'confirm' && reason instanceof RequestError
        && ['SAVE_UNCERTAIN', 'CONNECTION_INTERRUPTED', 'INVALID_RESPONSE'].includes(reason.code)) {
        setSnapshot(null);
        setReviewId(null);
        // This reflects an uncertain response, not a claimed server state. Keep a
        // safe check-only action if the subsequent status request also fails.
        setProposals((current) => current.map((item) => item.id === proposal.id ? { ...item, status: 'uncertain' } : item));
      }
      // Do not replay an uncertain write. Read-only refresh can reveal its durable status.
      try { await load(); } catch { /* Successful status/inbox reads have still been applied. */ }
    } finally { setBusy(false); }
  }

  async function reconcile(proposal: Proposal) {
    setBusy(true); setError(''); setMessage('');
    try {
      const outcome = await request<{ status: string }>(`/api/proposals/${encodeURIComponent(proposal.id)}/reconcile`, {});
      await load(outcome.status === 'committed');
      setMessage(outcome.status === 'committed'
        ? 'Your employment change was saved.'
        : 'This save is still unconfirmed. The change has not been sent again. Check its status later.');
    } catch (reason) {
      setError(`The save status could not be confirmed. ${reason instanceof Error ? reason.message : 'Please try checking again later.'}`);
    } finally { setBusy(false); }
  }

  const review = proposals.find((proposal) => proposal.id === reviewId && proposal.status === 'pending');
  const unresolved = proposals.filter((proposal) => !['committed', 'rejected', 'stale'].includes(proposal.status));
  const canEdit = snapshot !== null && !loading && !busy && unresolved.length === 0;
  const refreshNotifications = useCallback(async () => {
    const inbox = await request<{ notifications: Notification[] }>('/api/notifications');
    setNotifications(inbox.notifications);
  }, [request]);

  return <Shell account={<div className="account"><UserButton /></div>}>
    <div className="page-heading"><div><p className="eyebrow">Your information</p><h1>Let’s start with your work.</h1><p>Record one job, then review the details before saving.</p></div><button type="button" className="secondary" disabled={busy || loading} onClick={refresh}>{busy ? 'Please wait…' : 'Refresh status'}</button></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    {message && <div className="notice" role="status">{message}</div>}
    {loading && <p role="status">Loading your saved information…</p>}
    {!loading && !snapshot && <p className="muted">Your saved information is unavailable. Use Refresh status to reconnect before editing.</p>}

    {unresolved.length > 0 && <section className="changes" aria-labelledby="changes-heading"><h2 id="changes-heading">Changes to review</h2><p className="muted">Finish or discard the current change before starting another.</p><ul className="change-list">{unresolved.map((proposal) => <li key={proposal.id}><div><strong>{proposal.newValue.title} · {proposal.newValue.employer}</strong><span className="status-label">{proposal.status === 'pending' ? 'Awaiting your confirmation' : `${proposal.status} — save not confirmed`}</span></div>{proposal.status === 'pending' && <button className="secondary" type="button" disabled={busy} onClick={() => { setReviewId(proposal.id); requestAnimationFrame(() => document.getElementById('review-heading')?.focus()); }}>Review change</button>}{['applying', 'uncertain'].includes(proposal.status) && <button className="secondary" type="button" disabled={busy} onClick={() => reconcile(proposal)}>Check save status</button>}</li>)}</ul></section>}

    {review && <section className="review" aria-labelledby="review-heading"><p className="eyebrow">Nothing changes until you confirm</p><h2 id="review-heading" tabIndex={-1}>Review this exact change</h2><p>Confirmation applies only to the values below. If your saved information has changed since this proposal was made, Maple will ask you to review again.</p><div className="comparison"><div className="comparison-head" aria-hidden="true"><span>Detail</span><span>Currently saved</span><span>Proposed</span></div>{fields.map(([key, label]) => <div className={`comparison-row${displayValue(review.oldValue, key) !== displayValue(review.newValue, key) ? ' changed' : ''}`} key={key}><strong>{label}</strong><div><span className="mobile-label">Currently saved</span>{displayValue(review.oldValue, key)}</div><div><span className="mobile-label">Proposed</span>{displayValue(review.newValue, key)}</div></div>)}</div><div className="actions"><button type="button" disabled={busy} onClick={() => decide(review, 'confirm')}>{busy ? 'Please wait…' : 'Confirm and save'}</button><button type="button" className="secondary" disabled={busy} onClick={() => decide(review, 'reject')}>Discard change</button></div></section>}

    <div className="workspace-grid"><section className="form-panel" aria-labelledby="employment-heading"><div className="section-heading"><h2 id="employment-heading">Employment details</h2><span className="muted">{snapshot ? (snapshot.employment ? `Saved revision ${snapshot.revision}` : 'No saved record') : 'Saved record unavailable'}</span></div><p className="muted">Enter what you know. Leave hours blank if you are unsure; keep other unknown answers as “Unknown”.</p><form onSubmit={propose}><fieldset disabled={!canEdit}><legend className="visually-hidden">Your employment record</legend><div className="field-grid"><label>Employer<input name="employer" autoComplete="organization" value={form.employer} maxLength={200} required onChange={(event) => update('employer', event.target.value)} /></label><label>Job title<input name="title" autoComplete="organization-title" value={form.title} maxLength={200} required onChange={(event) => update('title', event.target.value)} /></label></div><div className="field-grid"><label>Start date<input type="date" name="startDate" value={form.startDate} required onChange={(event) => update('startDate', event.target.value)} /></label><label>Country code<input name="countryCode" value={form.countryCode} placeholder="For example, CA" minLength={2} maxLength={2} pattern="[A-Z]{2}" required onChange={(event) => update('countryCode', event.target.value.toUpperCase())} /><span className="hint">Two-letter country code for where you worked.</span></label></div><label className="checkbox"><input type="checkbox" checked={form.currentJob} onChange={(event) => setForm((current) => ({ ...current, currentJob: event.target.checked, endDate: null }))} /><span>I currently work in this job</span></label>{!form.currentJob && <label>Actual end date<input type="date" name="endDate" value={form.endDate ?? ''} required onChange={(event) => update('endDate', event.target.value || null)} /></label>}<label>Hours per week <span className="optional">(optional)</span><input name="hoursPerWeek" type="number" min="0.01" max="168" step="any" value={form.hoursPerWeek ?? ''} onChange={(event) => update('hoursPerWeek', event.target.value === '' ? null : Number(event.target.value))} /><span className="hint">Leave blank if unknown.</span></label><div className="field-grid"><AnswerField label="Was this paid work?" value={form.paid} onChange={(value) => update('paid', value)} /><AnswerField label="Were you authorized to work?" value={form.authorizedToWork} onChange={(value) => update('authorizedToWork', value)} /></div><label>What were your main duties? <span className="optional">(optional)</span><textarea name="duties" rows={4} value={form.duties} maxLength={10_000} onChange={(event) => update('duties', event.target.value)} /><span className="hint">Describe your actual work. Duties are needed before recording a NOC code.</span></label><details className="noc-details"><summary>Add a NOC code you have reviewed</summary><p className="hint">A job title alone is not enough to choose a NOC code. Review its description against your duties before adding it.</p><label>NOC code<input name="nocCode" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={form.nocCode ?? ''} onChange={(event) => setForm((current) => ({ ...current, nocCode: event.target.value || null, nocReviewed: false }))} /></label><label className="checkbox"><input type="checkbox" disabled={!form.nocCode || !canEdit} checked={form.nocReviewed} onChange={(event) => update('nocReviewed', event.target.checked)} /><span>I reviewed this NOC code against my job duties.</span></label></details><div className="form-actions"><button type="submit">Review change</button><p className="hint">You will see the exact change before confirming.</p></div></fieldset></form></section>
      <aside className="inbox" aria-labelledby="notifications-heading"><p className="eyebrow">Notification centre</p><h2 id="notifications-heading">Your updates</h2>{notifications.length === 0 ? <p className="muted">No updates yet.</p> : <ul>{notifications.map((notification) => <li key={notification.id}><strong>{notification.kind === 'assessed' ? 'Private requirement check completed' : 'Employment information saved'}</strong><p>Revision {notification.revision}</p><time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time></li>)}</ul>}<p className="inbox-note">Confirmed saves and completed private checks appear here. Pending changes remain in your review list.</p></aside>
    </div>
    <AssessmentPanel request={request} revision={snapshot?.revision ?? null} onAssessed={refreshNotifications} />
  </Shell>;
}

function AnswerField({ label, value, onChange }: { label: string; value: Employment['paid']; onChange: (value: Employment['paid']) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value as Employment['paid'])}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option><option value="not_applicable">Not applicable</option></select></label>;
}

const root = document.getElementById('root');
if (!root) throw new Error('The application root is missing.');
createRoot(root).render(<StrictMode><Bootstrap /></StrictMode>);
