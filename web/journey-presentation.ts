import type { Discovery, JourneyEvent } from '../shared/demo.js';
import { CRS_POLICY_VERSION } from '../shared/crs.js';

export function isJourneyStale(event: JourneyEvent, revision: number | null, date: string) {
  return Boolean(
    revision === null
    || (event.calculatorVersion && event.calculatorVersion !== CRS_POLICY_VERSION)
    || event.profileRevision !== revision
    || (event.discovery && event.discovery.assessmentDate !== date)
    || (event.discovery?.crs?.status === 'complete' && event.discovery.crs.policyVersion !== CRS_POLICY_VERSION),
  );
}

// The API returns newest first. Keep every unresolved request visible; older
// completed records remain inspectable in history, never silently discarded.
export function splitJourney(events: JourneyEvent[]) {
  const seen = new Set<JourneyEvent['kind']>();
  const current: JourneyEvent[] = [], history: JourneyEvent[] = [];
  for (const event of events) {
    if (!seen.has(event.kind) || event.status === 'processing' || event.status === 'uncertain') current.push(event);
    else history.push(event);
    seen.add(event.kind);
  }
  return { current, history };
}

export function findingHeading(discovery: Discovery) {
  const crs = discovery.crs;
  if (crs?.status === 'complete') {
    if (crs.delta > 0) return `A policy update ${crs.projected ? 'could add' : 'adds'} ${crs.delta} CRS points`;
    if (crs.delta < 0) return `A policy update ${crs.projected ? 'could reduce' : 'reduces'} your CRS by ${Math.abs(crs.delta)} points`;
    return 'This policy update leaves your CRS unchanged';
  }
  if (discovery.kind === 'c20' && discovery.status === 'potential_pathway') return 'C20: another work option to explore';
  return discovery.title;
}

export function findingLabel(discovery: Discovery) {
  if (discovery.status === 'needs_information') return 'More information needed';
  if (discovery.status === 'not_supported') return 'C20 is not supported by these facts';
  return discovery.kind === 'c20' ? 'A new possibility' : 'A change that matters';
}

export function findingReason(discovery: Discovery) {
  const crs = discovery.crs;
  if (crs?.status === 'complete') {
    const work = crs.labourMarket;
    if (work.offerAlternative > work.workAlternative) return `Your reviewed offer uses the ${work.offerAlternative}-point alternative, above the ${work.workAlternative} points from your work evidence.`;
    if (work.highWageBonus > 0) return `Your reviewed Canadian-work evidence includes a ${work.highWageBonus}-point high-wage increase under the announced rules.`;
    return `The policy comparison uses ${work.selected} points from your reviewed work evidence, replacing ${work.workDuration}.`;
  }
  return discovery.kind === 'c20' && discovery.status === 'potential_pathway' ? discovery.reasons.at(-1) ?? discovery.summary : discovery.summary;
}
