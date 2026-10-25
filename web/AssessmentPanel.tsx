import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssessmentView } from '../shared/assessment.js';
import type { PolicySummary } from '../shared/policy.js';
import { businessDate } from '../shared/business-date.js';
import { watchAssessmentRefresh } from './assessment-refresh.js';
import { cecReasonMessages } from '../shared/cec-evidence.js';
import { ReviewEmploymentLink } from './ReviewEmploymentLink.js';

type ApiRequest = <T>(path: string, body?: unknown) => Promise<T>;
const labels = { met: 'Met', not_met: 'Not met', needs_information: 'Needs information' };

export function AssessmentNextStep({ hasInputs, hasPolicies }: { hasInputs: boolean; hasPolicies: boolean }) {
  return <div className="assessment-next-step"><h3>{hasInputs ? 'Review your work evidence' : 'Start with your employment'}</h3>
    <p>{hasInputs ? 'Check the work interval and its conditions, then save any changes before running a requirement check.' : 'Save your employment and review the work interval you want Maple to check. Unknown answers can stay unknown.'}</p>
    {!hasPolicies && <p className="hint">No reviewed requirement check is available yet. Saving your inputs does not activate a policy.</p>}
    <ReviewEmploymentLink evidence={hasInputs}>{hasInputs ? 'Review work evidence' : 'Add employment information'}</ReviewEmploymentLink>
  </div>;
}

export function AssessmentPanel({ request, revision, onAssessed, blocked = false }: { request: ApiRequest; revision: number | null; onAssessed: () => Promise<void>; blocked?: boolean }) {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [assessments, setAssessments] = useState<AssessmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const attempt = ++generation.current;
    // Clear judgments before the asynchronous check, including on resume and date rollover.
    setAssessments([]); setPolicies([]); setLoading(true); setError('');
    if (blocked) { setLoading(false); return; }
    try {
      const [available, records] = await Promise.all([
        request<{ policies: PolicySummary[] }>('/api/policies'),
        request<{ assessments: AssessmentView[] }>('/api/assessments'),
      ]);
      if (attempt !== generation.current) return;
      setPolicies(available.policies);
      setAssessments(records.assessments);
    } catch (reason) {
      if (attempt === generation.current) setError(reason instanceof Error ? reason.message : 'Checks could not be loaded.');
    } finally { if (attempt === generation.current) setLoading(false); }
  }, [request, blocked]);
  useEffect(() => {
    void load();
    const stop = watchAssessmentRefresh(() => { void load(); }, window, document);
    return () => { stop(); generation.current++; };
  }, [load, revision]);
  async function run(policyId: string) {
    if (blocked) return;
    setBusy(true); setError('');
    try { await request<AssessmentView>('/api/assessments', { policyId }); await load(); await onAssessed(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'This check could not be completed.'); }
    finally { setBusy(false); }
  }
  return <section className="changes" aria-labelledby="assessment-heading">
    <p className="eyebrow">Private to you</p><h2 id="assessment-heading">Reviewed requirement checks</h2>
    <p className="muted">These checks cover only the listed requirements. They do not establish program eligibility, an FSW selection score or a CRS score.</p>
    <p className="hint">Application basis: as if applying today, using the Toronto calendar date. A work-interval result covers only the recorded interval.</p>
    {blocked && <p className="notice" role="status">A conversation update is being checked. Review your assessment inputs after it finishes before relying on these results.</p>}
    {loading && <p role="status">Loading reviewed checks.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!blocked && !loading && !error && assessments.length === 0 && <AssessmentNextStep hasInputs={revision !== null && revision > 0} hasPolicies={policies.length > 0} />}
    <ul className="change-list">{policies.map(policy => <li key={policy.digest}><div><strong>{policy.title}</strong><span className="status-label">{policy.program} · version {policy.version} · effective {policy.effectiveFrom}</span><a href={policy.sourceUrl} target="_blank" rel="noreferrer">Official source</a></div><button type="button" className="secondary" disabled={blocked || busy || revision === null} onClick={() => run(policy.id)}>Check my saved facts</button></li>)}</ul>
    {assessments.map(assessment => <article className="review" key={assessment.id}>
      <h3>{assessment.policy.title}</h3><p className="muted">Checked {assessment.assessmentDate} · saved revision {assessment.profileRevision} · policy version {assessment.policy.version}</p>
      <p><a href={assessment.policy.sourceUrl} target="_blank" rel="noreferrer">Official source</a> · effective {assessment.policy.effectiveFrom}</p>
      <AssessmentConclusion assessment={assessment} revision={revision} blocked={blocked} />
    </article>)}
  </section>;
}

export function AssessmentConclusion({ assessment, revision, blocked = false }: { assessment: AssessmentView; revision: number | null; blocked?: boolean }) {
  if (blocked) return <p className="notice">Results are withheld while a conversation update is being checked.</p>;
  // A delayed response or browser timer must not restore yesterday's judgment.
  const current = assessment.freshness === 'current' && revision === assessment.profileRevision
    && assessment.assessmentDate === businessDate(new Date());
  return current
    ? <ul>{assessment.results.map(result => <li key={result.criterionId}><strong>{labels[result.status]}</strong> - {result.title}
      {result.scope === 'recorded_work_interval' && <span className="status-label">Recorded work interval only</span>}
      {result.reasonCodes?.map(reason => <p key={reason}>{cecReasonMessages[reason]}</p>)}
    </li>)}</ul>
    : <p className="notice">{assessment.freshness === 'unverified' || revision === null ? 'Saved facts could not be verified. These results are temporarily unavailable.' : 'Facts, policy or assessment date changed. Run a new check for current results.'}</p>;
}
