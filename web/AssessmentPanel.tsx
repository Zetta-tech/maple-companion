import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssessmentView } from '../shared/assessment.js';
import type { PolicySummary } from '../shared/policy.js';
import { businessDate } from '../shared/business-date.js';
import { watchAssessmentRefresh } from './assessment-refresh.js';

type ApiRequest = <T>(path: string, body?: unknown) => Promise<T>;
const labels = { met: 'Met', not_met: 'Not met', needs_information: 'Needs information' };

export function AssessmentPanel({ request, revision, onAssessed }: { request: ApiRequest; revision: number | null; onAssessed: () => Promise<void> }) {
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
  }, [request]);
  useEffect(() => {
    void load();
    const stop = watchAssessmentRefresh(() => { void load(); }, window, document);
    return () => { stop(); generation.current++; };
  }, [load, revision]);
  async function run(policyId: string) {
    setBusy(true); setError('');
    try { await request<AssessmentView>('/api/assessments', { policyId }); await load(); await onAssessed(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'This check could not be completed.'); }
    finally { setBusy(false); }
  }
  return <section className="changes" aria-labelledby="assessment-heading">
    <p className="eyebrow">Private to you</p><h2 id="assessment-heading">Reviewed requirement checks</h2>
    <p className="muted">These checks cover only the listed requirements. They do not establish program eligibility, an FSW selection score or a CRS score.</p>
    {loading && <p role="status">Loading reviewed checks.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && policies.length === 0 && <p>No reviewed requirement checks are available yet.</p>}
    <ul className="change-list">{policies.map(policy => <li key={policy.digest}><div><strong>{policy.title}</strong><span className="status-label">{policy.program} · version {policy.version} · effective {policy.effectiveFrom}</span><a href={policy.sourceUrl} target="_blank" rel="noreferrer">Official source</a></div><button type="button" className="secondary" disabled={busy || revision === null} onClick={() => run(policy.id)}>Check my saved facts</button></li>)}</ul>
    {assessments.map(assessment => <article className="review" key={assessment.id}>
      <h3>{assessment.policy.title}</h3><p className="muted">Checked {assessment.assessmentDate} · saved revision {assessment.profileRevision} · policy version {assessment.policy.version}</p>
      <p><a href={assessment.policy.sourceUrl} target="_blank" rel="noreferrer">Official source</a> · effective {assessment.policy.effectiveFrom}</p>
      <AssessmentConclusion assessment={assessment} revision={revision} />
    </article>)}
  </section>;
}

export function AssessmentConclusion({ assessment, revision }: { assessment: AssessmentView; revision: number | null }) {
  // A delayed response or browser timer must not restore yesterday's judgment.
  const current = assessment.freshness === 'current' && revision === assessment.profileRevision
    && assessment.assessmentDate === businessDate(new Date());
  return current
    ? <ul>{assessment.results.map(result => <li key={result.criterionId}><strong>{labels[result.status]}</strong> - {result.title}</li>)}</ul>
    : <p className="notice">{assessment.freshness === 'unverified' || revision === null ? 'Saved facts could not be verified. These results are temporarily unavailable.' : 'Facts, policy or assessment date changed. Run a new check for current results.'}</p>;
}
