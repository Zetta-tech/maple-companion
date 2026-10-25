import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Employment } from '../shared/employment.js';
import { personalIntakeSchema, type PersonalIntake, type PersonalGuideSnapshot, type PersonalProfile } from '../shared/personal-guide.js';
import type { JourneyEvent } from '../shared/demo.js';
import { businessDate } from '../shared/business-date.js';
import { guideQuestionSchema } from '../shared/guide-request.js';
import { DemoJourneyPanel, JourneyCard } from './DemoJourneyPanel.js';
import { CrsEvidenceEditor } from './CrsEvidenceEditor.js';
import { splitJourney } from './journey-presentation.js';
import { watchAssessmentRefresh } from './assessment-refresh.js';
import { guidePendingAfterFailure, RequestError } from './request.js';
import { useFlowNavigation } from './useFlowNavigation.js';

type Request = <T>(path: string, body?: unknown) => Promise<T>;
type Proposal = { id: string; status: string; profile: PersonalProfile | null; baseRevision: number };
type Props = { request: Request; employment: Employment | null; employmentRevision: number | null; blocked: boolean; refreshKey: number; onAvailabilityChange: (available: boolean) => void };

export function GuideWorkspace(props: Props) {
  const [mode, setMode] = useState<'loading' | 'personal' | 'demo' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void props.request<{ available: boolean }>('/api/guide/status').then(status => {
      if (active) setMode(status.available ? 'personal' : 'demo');
    }).catch(error => {
      if (active) setMode(error instanceof RequestError && error.code === 'NOT_FOUND' ? 'demo' : 'error');
    });
    return () => { active = false; };
  }, [props.request, attempt]);
  useEffect(() => { if (mode !== 'demo') props.onAvailabilityChange(true); }, [mode, props.onAvailabilityChange]);
  if (mode === 'demo') return <DemoJourneyPanel request={props.request} onAvailabilityChange={props.onAvailabilityChange} />;
  if (mode === 'loading') return <section id="journey" className="demo-journey"><p role="status">Checking your Guide…</p></section>;
  if (mode === 'error') return <section id="journey" className="demo-journey"><h2>Your Guide could not be checked</h2><p role="alert">Your saved discoveries are unavailable right now.</p><button className="secondary" onClick={() => setAttempt(value => value + 1)}>Check again</button></section>;
  return <PersonalGuidePanel {...props} />;
}

const labels: Record<string, string> = {
  name: 'Name', arrivedInCanada: 'Arrival in Canada', permitExpiry: 'Your permit expiry', spousePermitExpiry: 'Spouse permit expiry',
  currentStatusValid: 'Valid immigration status', canadianOffer: 'Canadian job offer', reciprocalProgramReported: 'Employer exchange program reported', reciprocalEvidence: 'Evidence for the exchange program', employerPortalOffer: 'Employer Portal offer submitted', spouseAccompanying: 'Accompanying spouse', qualifyingExpressEntryOffer: 'Express Entry offer review',
  employer: 'Employer', jobTitle: 'Job title', workStart: 'Work started', weeklyHours: 'Hours per week', noc: 'Reviewed NOC', duties: 'Work duties', nocReviewed: 'NOC reviewed', intervalComplete: 'Consistent qualifying interval confirmed', crsEvidence: 'Full CRS evidence',
  workEnd: 'Last day worked', currentJob: 'Current job', physicallyCanada: 'Work performed in Canada', authorizedWork: 'Work was authorized', paidEmployee: 'Paid employee', fullTimeStudy: 'Full-time study during this work', selfEmployed: 'Self-employed during this work',
};
function readable(key: string) { return labels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase()); }
function ReviewValues({ value }: { value: Record<string, unknown> }) {
  return <dl className="guide-review-values">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{readable(key)}</dt><dd>{item !== null && typeof item === 'object' ? <details><summary>Review {readable(key).toLowerCase()}</summary><ReviewValues value={item as Record<string, unknown>} /></details> : item === null || item === '' ? 'Unknown' : typeof item === 'boolean' ? item ? 'Yes' : 'No' : String(item).replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())}</dd></div>)}</dl>;
}
export function PersonalInputReview({ profile }: { profile: PersonalProfile }) {
  const { fictional: _fictional, inputPurpose: _purpose, employmentBasis, ...values } = profile;
  return <><p>Includes your confirmed employment at <strong>{profile.employer}</strong>. Changes are used only after you confirm.</p><ReviewValues value={values} /><details><summary>Saved employment reference</summary><p>Employment revision {employmentBasis.revision}</p><code>{employmentBasis.receiptDigest}</code></details></>;
}

export function GuideSaveActions({ status, busy, blocked, confirm, reconcile, reject }: {
  status: string; busy: boolean; blocked: boolean; confirm: () => void; reconcile: () => void; reject: () => void;
}) {
  return <div className="actions">{status === 'pending' ? <><button disabled={busy || blocked} onClick={confirm}>Confirm and save Guide details</button><button className="secondary" disabled={busy} onClick={reject}>Discard Guide change</button></> : <><p className="hint">This save needs checking. It will not be sent again.</p><button className="secondary" disabled={busy} onClick={reconcile}>Check save status</button></>}</div>;
}

export function PersonalGuidePanel({ request, employment, employmentRevision, blocked, refreshKey }: Props) {
  const [snapshot, setSnapshot] = useState<PersonalGuideSnapshot | null>(null);
  const [draft, setDraft] = useState<PersonalIntake | null>(null);
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [historyNeedsReview, setHistoryNeedsReview] = useState(true);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [date, setDate] = useState(() => businessDate(new Date()));
  const generation = useRef(0);
  const beginNavigation = useFlowNavigation();
  const refresh = useCallback(async (resetDraft = false) => {
    const attempt = ++generation.current;
    setLoading(true); setSnapshot(null); setHistoryNeedsReview(true);
    try {
      const [profile, pending, journey] = await Promise.allSettled([
        request<PersonalGuideSnapshot>('/api/guide/profile'), request<{ proposals: Proposal[] }>('/api/guide/proposals'),
        request<{ events: JourneyEvent[]; revision: number; reviewRequired: boolean }>('/api/guide/journey'),
      ]);
      if (attempt !== generation.current) return;
      if (pending.status === 'fulfilled') setProposals(pending.value.proposals);
      if (journey.status === 'fulfilled') {
        setEvents(journey.value.events); setHistoryNeedsReview(journey.value.reviewRequired);
        setPendingRequest(current => current && journey.value.events.some(event => event.id === current && ['completed', 'not_sent'].includes(event.status)) ? null : current);
      }
      if (profile.status === 'rejected') throw profile.reason;
      if (pending.status === 'rejected') throw pending.reason;
      if (journey.status === 'rejected') throw journey.reason;
      setSnapshot(profile.value);
      setDraft(current => resetDraft || !current ? profile.value.intake : current);
    } finally { if (attempt === generation.current) setLoading(false); }
  }, [request]);
  useEffect(() => {
    setError(''); void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Your Guide could not be checked.'));
    return () => { generation.current++; };
  }, [refresh, employmentRevision, blocked, refreshKey]);
  useEffect(() => watchAssessmentRefresh(() => {
    setDate(businessDate(new Date())); void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Your Guide could not be checked.'));
  }, window, document), [refresh]);
  useEffect(() => {
    if (!employment) return;
    setDraft(current => current?.crsEvidence && current.crsEvidence.canadianWorkEnd !== employment.endDate ? {
      ...current, crsEvidence: { ...current.crsEvidence, canadianWorkEnd: employment.endDate, completeEvidenceReviewed: 'unknown' },
    } : current);
  }, [employment?.endDate]);
  async function act(run: () => Promise<void>, target: string) {
    const navigation = beginNavigation(); let destination = target;
    setBusy(true); setError(''); setNotice('');
    try { await run(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'This action could not be verified.'); destination = 'guide-error'; }
    finally { setBusy(false); navigation.complete(destination); }
  }
  const unresolved = proposals.filter(proposal => !['committed', 'rejected', 'stale'].includes(proposal.status));
  const operationPending = unresolved.length > 0 || !!pendingRequest || events.some(event => ['processing', 'uncertain'].includes(event.status));
  const canReview = !!employment && employmentRevision !== null && employmentRevision > 0 && !!snapshot && !loading && !busy && !blocked && !operationPending;
  const currentInputs = !!snapshot?.verified && !snapshot.reviewRequired && !historyNeedsReview && snapshot.employmentRevision === employmentRevision && !blocked && !loading;
  const canResearch = currentInputs && !!snapshot?.profile && !busy && !operationPending;
  async function propose(event: FormEvent) {
    event.preventDefault(); if (!canReview || !draft || !snapshot) return;
    await act(async () => {
      const parsed = personalIntakeSchema.safeParse(draft);
      if (!parsed.success) throw Error('Review the entered dates and details. Leave anything you do not know blank or unknown.');
      const proposal = await request<Proposal>('/api/guide/proposals', { baseRevision: snapshot.revision, employmentRevision, intake: parsed.data });
      setProposals([proposal]);
    }, 'guide-review-heading');
  }
  async function save(proposal: Proposal, action: 'confirm' | 'reconcile') {
    await act(async () => {
      if (action === 'confirm') setProposals(current => current.map(item => item.id === proposal.id ? { ...item, status: 'applying' } : item));
      try {
        const result = await request<{ verified: boolean; profile: PersonalProfile | null }>(`/api/guide/proposals/${proposal.id}/${action}`, action === 'confirm' ? { confirm: true } : {});
        if (!result.verified || !result.profile) throw Error('The save could not be verified. Check its status before continuing.');
        await refresh(true);
        setNotice(action === 'confirm' ? 'Your Guide details were saved.' : 'Your earlier save was verified. Nothing was sent again.');
      } catch (reason) {
        // Read status after failure. Only the backend can restore a proved-unsent
        // proposal to pending; a transport error never enables another save.
        try { await refresh(); } catch { /* Keep the local hold if readback also fails. */ }
        throw reason;
      }
    }, 'guide-feedback');
  }
  async function research(kind: 'discover' | 'policy-replay') {
    if (!canResearch) return;
    await act(async () => {
      if (kind === 'discover' && !guideQuestionSchema.safeParse(question).success) throw Error('Enter a question between 1 and 2,000 characters. Nothing was sent.');
      const id = crypto.randomUUID(); setPendingRequest(id);
      try {
        const event = await request<JourneyEvent>('/api/guide/' + kind, { requestId: id, fictional: false, ...(kind === 'discover' ? { question } : {}) });
        setEvents(current => [event, ...current.filter(item => item.id !== event.id)]);
        if (['completed', 'not_sent'].includes(event.status)) setPendingRequest(null);
      } catch (reason) { setPendingRequest(current => guidePendingAfterFailure(current, reason)); throw reason; }
    }, 'journey-title');
  }
  const { current, history } = splitJourney(events);
  const update = <K extends keyof PersonalIntake>(key: K, value: PersonalIntake[K]) => setDraft(current => current ? { ...current, [key]: value } : current);
  return <section className="demo-journey personal-guide" id="journey" aria-labelledby="journey-title">
    <div className="journey-intro"><div><h2 id="journey-title" tabIndex={-1}>What matters for you</h2><p className="journey-profile-label">{snapshot?.profile ? 'Based on your reviewed information' : 'Your work options, with the evidence behind them'}</p></div><button className="secondary" disabled={loading || busy} onClick={() => void act(() => refresh(), 'journey-title')}>Refresh</button></div>
    {error && <p className="notice error" role="alert" id="guide-error" tabIndex={-1}>{error}</p>}
    {notice && <p className="notice" role="status" id="guide-feedback" tabIndex={-1}>{notice}</p>}
    {blocked ? <p className="notice" role="status">Your information is being checked. Review it after the update finishes before relying on a discovery.</p> : snapshot?.reviewRequired || historyNeedsReview && !loading ? <p className="notice">Your information changed. Review your Guide details below for a current result.</p> : null}
    {pendingRequest && <p className="notice" role="status">{busy ? 'Checking official sources and your reviewed information…' : 'This request needs checking. Refresh its status before starting another; it has not been sent again.'}</p>}
    {unresolved.map((proposal, index) => <section className="review" key={proposal.id}><h3 id={index === 0 ? 'guide-review-heading' : undefined} tabIndex={-1}>{proposal.status === 'pending' ? 'Review the information Maple will use' : 'Check your earlier save'}</h3>{proposal.profile && <PersonalInputReview profile={proposal.profile} />}<GuideSaveActions status={proposal.status} busy={busy} blocked={blocked} confirm={() => void save(proposal, 'confirm')} reconcile={() => void save(proposal, 'reconcile')} reject={() => void act(async () => { await request('/api/guide/proposals/' + proposal.id + '/reject', {}); await refresh(); setNotice('The proposed change was discarded.'); }, 'guide-feedback')} /></section>)}
    {loading && <p role="status">Checking your saved discoveries…</p>}
    <div className="journey-results" aria-live="polite">{current.map(event => <JourneyCard key={event.id} event={event} revision={currentInputs ? snapshot!.revision : null} date={date} fictional={false} />)}</div>
    {!loading && !events.length && !error && <div className="journey-empty"><h3>Start with what you know.</h3><p>{employment ? 'Review the details below, then ask about your work options. Unknown answers stay unknown.' : 'Save your employment information first. Maple uses those confirmed details alongside the information you choose to add.'}</p>{!employment && <a href="#employment-heading">Review employment information</a>}</div>}
    {history.length > 0 && <details className="journey-history"><summary>Earlier discoveries ({history.length})</summary><div className="journey-results">{history.map(event => <JourneyCard key={event.id} event={event} revision={currentInputs ? snapshot!.revision : null} date={date} fictional={false} />)}</div></details>}
    <details className="journey-tools" open={!events.length}><summary>Ask Maple or update your Guide details</summary><div className="journey-tools-content">
      <div className="guide-prompt"><label htmlFor="personal-guide-question">What would you like to understand?</label><textarea id="personal-guide-question" value={question} maxLength={2000} disabled={!canResearch} placeholder="For example, what work options should I discuss with my employer?" onChange={event => setQuestion(event.target.value)} /><button disabled={!canResearch || !question.trim()} onClick={() => void research('discover')}>{busy ? 'Checking…' : 'Explore my work options'}</button><p className="hint">Currently checks reciprocal employment (C20). This is not a search of every immigration pathway.</p></div>
      {draft && <details className="demo-profile" open={!snapshot?.profile || snapshot.reviewRequired}><summary>Your Guide details</summary><p className="hint">Your employment comes from the record you already confirmed. Leave missing details blank or unknown.</p>{employment && <p><strong>{employment.title}</strong> · {employment.employer} · <a href="#employment-heading">Review employment</a></p>}<form onSubmit={propose}><fieldset disabled={!canReview}><legend className="visually-hidden">Guide details</legend><div className="field-grid"><label>Name (optional)<input value={draft.name ?? ''} maxLength={80} onChange={event => update('name', event.target.value || null)} /></label>{(['arrivedInCanada', 'permitExpiry', 'spousePermitExpiry'] as const).map(field => <label key={field}>{readable(field)} (if known)<input type="date" value={draft[field] ?? ''} onChange={event => update(field, event.target.value || null)} /></label>)}</div>
        <div className="field-grid">{(['currentStatusValid', 'canadianOffer', 'reciprocalProgramReported', 'employerPortalOffer', 'spouseAccompanying'] as const).map(field => <label key={field}>{readable(field)}<select value={draft[field]} onChange={event => update(field, event.target.value as 'yes' | 'no' | 'unknown')}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label>)}</div>
        <label>Evidence for the employer exchange program<select value={draft.reciprocalEvidence} onChange={event => update('reciprocalEvidence', event.target.value as PersonalIntake['reciprocalEvidence'])}><option value="unknown">Unknown</option><option value="not_requested">Not requested</option><option value="promised">Supporting documents promised</option><option value="documents_available">Documents available for review</option></select></label>
        <label>Qualifying Express Entry offer review<select value={draft.qualifyingExpressEntryOffer} onChange={event => update('qualifyingExpressEntryOffer', event.target.value as PersonalIntake['qualifyingExpressEntryOffer'])}><option value="not_reviewed">Not reviewed</option><option value="none_reviewed">Reviewed: no qualifying offer</option><option value="reviewed_offer">Qualifying offer reviewed in CRS evidence</option></select></label>
        <CrsEvidenceEditor value={draft.crsEvidence} asOf={date} spouseAccompanying={draft.spouseAccompanying} fictional={false} employmentEndDate={employment?.endDate ?? null} onChange={value => setDraft(current => { if (!current) return current; const next = { ...current }; if (value) next.crsEvidence = value; else delete next.crsEvidence; return next; })} />
        <button type="submit">Review Guide details</button><p className="hint">You will see the exact information before confirming.</p></fieldset></form></details>}
    </div></details>
    <details className="demo-replay"><summary>Check the announced Express Entry change</summary><p>Compare the reviewed announcement with the same saved information. This is a manual policy check, not an automatic alert. Its effective date is shown with the result.</p><button className="secondary" disabled={!canResearch} onClick={() => void research('policy-replay')}>Check the policy change</button></details>
  </section>;
}
