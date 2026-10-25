import { useId } from 'react';
import type { Discovery } from '../shared/demo.js';
import { CrsBreakdown } from './CrsBreakdown.js';
import { findingHeading, findingReason } from './journey-presentation.js';
import { DiscoveryEvidence } from './DiscoveryEvidence.js';

export function ScoreImpact({ discovery, fictional }: { discovery: Discovery; fictional: boolean }) {
  const titleId = useId();
  if (discovery.crs?.status !== 'complete') return null;
  const unresolved = discovery.outstanding[0];
  const qualification = unresolved?.startsWith('The overall maximum under the announced allocation remains unresolved')
    ? 'Policy cap unresolved; this estimate is below the disputed limit.'
    : unresolved;
  return <section className="score-impact" aria-labelledby={titleId}>
    <h3 id={titleId}>{findingHeading(discovery)}</h3>
    <CrsBreakdown result={discovery.crs} view="summary" fictional={fictional} emphasis qualificationNote={qualification} />
    <p className="score-impact-reason">{findingReason(discovery)}</p>
    <CrsBreakdown result={discovery.crs} view="details" fictional={fictional}><DiscoveryEvidence discovery={discovery} /></CrsBreakdown>
  </section>;
}
