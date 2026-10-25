import { useId, useRef, useState } from 'react';
import type { Discovery } from '../shared/demo.js';
import { CrsBreakdown } from './CrsBreakdown.js';
import { findingHeading, findingReason } from './journey-presentation.js';
import { DiscoveryEvidence } from './DiscoveryEvidence.js';

export function ScoreImpact({ discovery, fictional }: { discovery: Discovery; fictional: boolean }) {
  const titleId = useId(), detailsId = useId();
  const breakdown = useRef<HTMLDetailsElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  if (discovery.crs?.status !== 'complete') return null;
  const unresolved = discovery.outstanding[0];
  const qualification = unresolved?.startsWith('The overall maximum under the announced allocation remains unresolved')
    ? 'Policy cap unresolved; this estimate is below the disputed limit.'
    : unresolved;
  function reviewBreakdown() {
    if (!breakdown.current) return;
    breakdown.current.open = true;
    breakdown.current.querySelector('summary')?.focus();
  }
  return <section className="score-impact" aria-labelledby={titleId}>
    <h3 id={titleId}>{findingHeading(discovery)}</h3>
    <CrsBreakdown result={discovery.crs} view="summary" fictional={fictional} emphasis qualificationNote={qualification} />
    <p className="score-impact-reason">{findingReason(discovery)}</p>
    <button type="button" ref={action} className="score-impact-action" aria-controls={detailsId} aria-expanded={expanded} onClick={reviewBreakdown}>Review score breakdown <span aria-hidden="true">↓</span></button>
    <CrsBreakdown result={discovery.crs} view="details" fictional={fictional} detailsId={detailsId} detailsRef={breakdown} onDetailsToggle={open => { setExpanded(open); if (!open) action.current?.focus(); }}><DiscoveryEvidence discovery={discovery} /></CrsBreakdown>
  </section>;
}
