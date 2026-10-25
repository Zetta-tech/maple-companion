import { ReviewEmploymentLink } from './ReviewEmploymentLink.js';
import { openWorkspaceSection } from './DashboardOverview.js';

/** A usable next step in place of controls that need confirmed employment. */
export function GuideEmploymentSetup({ pending = false }: { pending?: boolean }) {
  return <div className="guide-prompt guide-employment-setup" id="guide-employment-setup">
    <h3>{pending ? 'Review your employment change' : 'Before your first question'}</h3>
    <p>{pending ? 'Your employment change is waiting for confirmation or a save-status check. Finish that step before using Maple Guide.' : 'Maple Guide uses your confirmed employment. Start with your employer, job title, start date and work country.'}</p>
    {pending ? <a className="guide-setup-action" href="#changes-heading" onClick={event => { event.preventDefault(); openWorkspaceSection('#changes-heading'); }}>Review employment change</a> : <ReviewEmploymentLink focusEmployer className="guide-setup-action">Add employment details</ReviewEmploymentLink>}
    {!pending && <p className="hint">You’ll review before saving. Then you can review your Guide details and ask a question.</p>}
  </div>;
}
