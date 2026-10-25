import type { Employment } from '../shared/employment.js';
import './DashboardOverview.css';

export type GuideOverviewState = 'checking' | 'review' | 'saved' | 'empty' | 'unavailable' | 'pending';
type Props = { employment: Employment | null; available: boolean; loading: boolean; held: boolean; pending: number; discoveries: boolean; guideState: GuideOverviewState };

export function openWorkspaceSection(href: string) {
  const target = document.getElementById(href.slice(1));
  if (!target) return;
  let parent: HTMLElement | null = target;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
  window.location.hash = href;
  requestAnimationFrame(() => {
    const heading = target.matches('h1,h2,h3,textarea') ? target : target.querySelector<HTMLElement>('h1,h2,h3') ?? target;
    if (!heading.matches('textarea,input,select,button,a')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
}

export function DashboardOverview({ employment, available, loading, held, pending, discoveries, guideState }: Props) {
  const next = loading
    ? { label: 'Checking your workspace', title: 'Loading your saved information', body: 'Your latest saved details and change statuses will appear here.', href: '#profile-workspace', action: 'View your information' }
    : pending > 0
      ? { label: 'Needs your attention', title: 'Finish reviewing your change', body: 'A proposed update is waiting for confirmation or a save-status check. Resolve it before making another change.', href: '#changes-heading', action: 'Review the change' }
      : !available
        ? { label: 'Connection needs checking', title: 'Reconnect to your saved information', body: 'Maple cannot verify your employment record right now. Check its status before editing or relying on a result.', href: '#employment-heading', action: 'Check saved information' }
        : !employment
          ? { label: 'Start here', title: 'Tell Maple about your work', body: 'Start with your employer, job title, start date and work country. Review before saving; other details can stay unknown.', href: '#employment-employer', action: 'Add employment details' }
          : held
            ? { label: 'Update in progress', title: 'Your information is being checked', body: 'Review the update status before using a discovery or running a requirement check.', href: '#native-memory-heading', action: 'View update status' }
            : !discoveries
              ? { label: 'Your next step', title: 'Review your work evidence', body: 'Keep your employment details current, then open the available requirement checks.', href: '#assessment-heading', action: 'Review requirement checks' }
            : guideState === 'pending'
              ? { label: 'Outcome needs checking', title: 'Check your earlier request', body: 'A Guide request or save is still unresolved. Check its recorded status before sending another request.', href: '#journey', action: 'View request status' }
              : guideState === 'review'
                ? { label: 'Review needed', title: 'Bring your Guide up to date', body: 'Your Guide details or saved results need review. Check the highlighted information before relying on a discovery.', href: '#journey', action: 'Review your Guide' }
                : guideState === 'unavailable'
                  ? { label: 'Guide needs checking', title: 'Your discoveries could not be verified', body: 'Open your Guide to check the connection or source status. Earlier findings are not a verified current result.', href: '#journey', action: 'Check your Guide' }
                  : guideState === 'checking'
                    ? { label: 'Checking your Guide', title: 'Loading your latest discovery status', body: 'Your employment is available. Maple is checking the saved Guide before showing a next step.', href: '#journey', action: 'View your Guide' }
                    : { label: 'Your next step', title: guideState === 'empty' ? 'Start with a question' : 'Your discoveries are ready to review', body: guideState === 'empty' ? 'Ask about a work option you want to understand. Maple shows the evidence, unknowns and next steps with each result.' : 'Read the outcome of each saved check, what still needs evidence, and the next action to consider.', href: discoveries ? '#journey' : '#assessment-heading', action: discoveries ? 'Open your discoveries' : 'Review requirement checks' };

  const askIsPrimary = discoveries && guideState === 'empty' && available && !!employment && !loading && !held && pending === 0;
  const primaryAction = askIsPrimary ? 'Ask Maple Guide' : guideState === 'saved' && next.href === '#journey' ? 'Review discoveries' : next.action;
  function ask() {
    if (!['saved', 'empty'].includes(guideState)) { openWorkspaceSection('#journey'); return; }
    const question = document.getElementById('personal-guide-question') ?? document.getElementById('guide-question');
    openWorkspaceSection(question ? '#' + question.id : '#journey');
  }
  return <section id="overview" className="dashboard-overview" aria-labelledby="overview-title">
    <div className="dashboard-welcome">
      <div className="dashboard-welcome-copy"><p className="dashboard-kicker">Your Maple workspace</p><h1 id="overview-title" tabIndex={-1}>What would you like<br className="dashboard-heading-break" /> to understand?</h1><p>Explore your work options, keep your information current, and see what to prepare next.</p>
        <div className="dashboard-welcome-actions"><a className="dashboard-primary-action" href={askIsPrimary ? '#journey' : next.href} onClick={event => { event.preventDefault(); askIsPrimary ? ask() : openWorkspaceSection(next.href); }}>{primaryAction}<span aria-hidden="true">→</span></a>{!askIsPrimary && discoveries ? <button className="dashboard-secondary-action" type="button" onClick={ask}>Ask Maple Guide <span aria-hidden="true">↗</span></button> : <a href="#profile-workspace" onClick={event => { event.preventDefault(); openWorkspaceSection('#profile-workspace'); }}>Review my information <span aria-hidden="true">→</span></a>}</div>
      </div>
      <div className="dashboard-companion" aria-label="Placeholder for the Maple companion character"><span className="dashboard-companion-mark" aria-hidden="true">m<span>.</span></span><span>Your companion</span><small>Character placeholder</small></div>
    </div>
    <div className="dashboard-overview-grid">
      <section className="dashboard-next" aria-labelledby="dashboard-next-title"><p className="dashboard-kicker">{next.label}</p><h2 id="dashboard-next-title">{next.title}</h2><p>{next.body}</p></section>
      <section className="dashboard-snapshot" aria-labelledby="dashboard-snapshot-title"><div className="dashboard-card-heading"><h2 id="dashboard-snapshot-title">Your working picture</h2><span className="dashboard-status">{loading ? 'Checking' : !available ? 'Unavailable' : employment ? 'Saved' : 'Not added'}</span></div>
        {employment && available ? <><p className="dashboard-job">{employment.title || 'Job title not recorded'}</p><p>{employment.employer || 'Employer not recorded'}</p><dl><div><dt>Work schedule</dt><dd>{employment.hoursPerWeek === null ? 'Unknown' : `${employment.hoursPerWeek} hours / week`}</dd></div><div><dt>Employment</dt><dd>{employment.currentJob ? 'Current role' : employment.endDate ? `Ended ${employment.endDate}` : 'End date unknown'}</dd></div></dl></> : <p>{loading ? 'Loading your employment summary.' : available ? 'Add your employment details to build a useful starting point.' : 'A current summary is unavailable until your saved record can be checked.'}</p>}
        <a href="#employment-heading" onClick={event => { event.preventDefault(); openWorkspaceSection('#employment-heading'); }}>Review employment <span aria-hidden="true">↗</span></a>
      </section>
    </div>
  </section>;
}
