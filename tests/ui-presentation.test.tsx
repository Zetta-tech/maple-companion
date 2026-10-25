import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoSeed, type JourneyEvent } from '../shared/demo.js';
import { fictionalCrsEvidence, CRS_POLICY_VERSION } from '../shared/crs.js';
import { discoverC20, projectExpressEntry } from '../server/discovery.js';
import { fixtureSources } from './support/demo-fixture.js';
import { JourneyCard } from '../web/DemoJourneyPanel.js';
import { findingReason, splitJourney } from '../web/journey-presentation.js';
import { NotificationCenter } from '../web/NotificationCenter.js';
import { AssessmentNextStep } from '../web/AssessmentPanel.js';
import { DiscoveryEvidence } from '../web/DiscoveryEvidence.js';
import { CrsBreakdown } from '../web/CrsBreakdown.js';

const date='2026-10-25';
const base:JourneyEvent={id:'current',kind:'discovery',status:'completed',createdAt:date+'T08:00:00Z',profileRevision:2};
describe('results-first presentation preserves the meaning of backend outcomes',()=>{
  it('offers a usable next step before any assessment without implying a policy was activated', () => {
    const empty = renderToStaticMarkup(<AssessmentNextStep hasInputs={false} hasPolicies={false} />);
    expect(empty).toContain('href="#employment-heading"');
    expect(empty).toContain('Add employment information');
    expect(empty).toContain('does not activate a policy');
    const reviewed = renderToStaticMarkup(<AssessmentNextStep hasInputs hasPolicies />);
    expect(reviewed).toContain('href="#cec-work-evidence-heading"');
    expect(reviewed).toContain('Review work evidence');
    expect(reviewed).not.toContain('does not activate a policy');
  });
  it('puts the changing work term before unchanged factors and keeps the offer-max branch honest', async () => {
    const evidence = fictionalCrsEvidence(date); evidence.completeEvidenceReviewed = 'yes';
    const discovery = projectExpressEntry({ ...demoSeed, crsEvidence: evidence }, date, 2, (await fixtureSources.retrieve('express_entry_full')).evidence);
    const result = discovery.crs;
    if (result?.status !== 'complete') throw Error('Fixture is incomplete');
    const html = renderToStaticMarkup(<JourneyCard event={{ ...base, kind: 'policy_update', discovery }} revision={2} date={date} />);
    expect(html.match(/>Review score breakdown</g)).toHaveLength(1);
    expect(html.indexOf('What changes: work points')).toBeLessThan(html.indexOf('Other core factors'));
    expect(html).toContain(`${result.before} − ${result.labourMarket.workDuration} + ${result.labourMarket.selected} =`);
    expect(html).not.toContain('<dt>Canadian work duration</dt>');
    const offer = renderToStaticMarkup(<CrsBreakdown result={{ ...result, labourMarket: { ...result.labourMarket, selectedAlternative: 'offer' } }} />);
    expect(offer).toContain('The qualifying offer alternative is higher');
    expect(offer).not.toContain('Work-duration points plus the eligible high-wage bonus are higher');
  });
  it('keeps exact source provenance inspectable in one closed disclosure, after the readable source list', async () => {
    const discovery = discoverC20(demoSeed, date, 2, (await fixtureSources.retrieve()).evidence);
    const html = renderToStaticMarkup(<DiscoveryEvidence discovery={discovery} />);
    const at = html.indexOf('<details class="source-provenance">');
    expect(at).toBeGreaterThan(0);
    expect(html.match(/<details/g)).toHaveLength(1);
    for (const source of discovery.sources) {
      expect(html.slice(0, at)).toContain(source.url);
      expect(html.slice(0, at)).not.toContain(source.bodySha256);
      expect(html.slice(at)).toContain(source.bodySha256);
      expect(html.slice(at)).toContain(source.retrievedAt);
      expect(html.slice(at)).toContain(source.reviewedAt);
    }
  });
  it('shows C20 reason and next action before disclosure, retaining all conditions and sources',async()=>{
    const discovery=discoverC20(demoSeed,date,2,(await fixtureSources.retrieve()).evidence);
    const html=renderToStaticMarkup(<JourneyCard event={{...base,discovery}} revision={2} date={date}/>);
    const firstDisclosure=html.indexOf('<details>');
    expect(html.indexOf(findingReason(discovery))).toBeLessThan(firstDisclosure);
    expect(html.indexOf(discovery.nextSteps[0]!)).toBeLessThan(firstDisclosure);
    expect(html.slice(0,firstDisclosure)).toContain('Eligibility not established');
    for(const item of discovery.outstanding) expect(html).toContain(item.replaceAll("'",'&#x27;'));
    for(const source of discovery.sources) expect(html).toContain(source.url);
  });
  it('uses the calculated totals and delta, including negative or zero outcomes',async()=>{
    const evidence=fictionalCrsEvidence(date);evidence.completeEvidenceReviewed='yes';
    const discovery=projectExpressEntry({...demoSeed,crsEvidence:evidence},date,2,(await fixtureSources.retrieve('express_entry_full')).evidence);
    expect(discovery.crs?.status).toBe('complete');
    if(discovery.crs?.status!=='complete')throw Error('Fixture is incomplete');
    for(const delta of [40,0,-15]){
      const changed={...discovery,crs:{...discovery.crs,delta,after:discovery.crs.before+delta}};
      const html=renderToStaticMarkup(<JourneyCard event={{...base,kind:'policy_update',discovery:changed}} revision={2} date={date}/>);
      const primary=html.slice(0,html.search(/<details(?:\s|>)/));
      expect(primary).toContain(String(changed.crs.after));
      expect(primary).toContain(delta>0?'could add 40':delta<0?'could reduce your CRS by 15':'unchanged');
      expect(primary).toContain('Projected');
      expect(primary).toContain(changed.crs.effectiveFrom);
      expect(primary).toContain('Eligibility not established');
      expect(primary).toContain('Policy cap unresolved; this estimate is below the disputed limit');
      expect(html).toContain(discovery.outstanding[0]!);
    }
  });
  it('does not label missing information or unsupported C20 as a discovered possibility',()=>{
    for(const value of ['unknown','no'] as const){
      const discovery=discoverC20({...demoSeed,canadianOffer:value,reciprocalProgramReported:'unknown'},date,2,[]);
      const html=renderToStaticMarkup(<JourneyCard event={{...base,discovery}} revision={2} date={date}/>);
      expect(html).not.toContain('A new possibility');
      expect(html).toContain(value==='unknown'?'More information needed':'C20 is not supported by these facts');
    }
  });
  it('withholds current conclusions when profile, date, or calculator cannot be trusted',()=>{
    const discovery=discoverC20(demoSeed,date,2,[]);
    for(const [revision,asOf,version] of [[null,date,CRS_POLICY_VERSION],[3,date,CRS_POLICY_VERSION],[2,'2026-10-26',CRS_POLICY_VERSION],[2,date,'superseded']] as const){
      const html=renderToStaticMarkup(<JourneyCard event={{...base,discovery,calculatorVersion:version}} revision={revision} date={asOf}/>);
      expect(html.slice(0,html.indexOf('<details>'))).not.toContain('A new possibility');
      expect(html).toContain('not a current assessment');
      expect(html).toContain('View the dated result');
    }
  });
  it('keeps unresolved older requests visible and retains every saved history item',()=>{
    const events:JourneyEvent[]=[base,{...base,id:'ee',kind:'policy_update'},{...base,id:'older'},{...base,id:'processing',status:'processing'},{...base,id:'uncertain',status:'uncertain'}];
    const split=splitJourney(events);
    expect(split.current.map(e=>e.id)).toEqual(['current','ee','processing','uncertain']);
    expect(split.history.map(e=>e.id)).toEqual(['older']);
    expect([...split.current,...split.history].map(e=>e.id).sort()).toEqual(events.map(e=>e.id).sort());
  });
  it('distinguishes processing, no-send and uncertain outcomes without announcing a discovery',()=>{
    for(const [status,label] of [['processing','Still checking'],['not_sent','Request not sent'],['uncertain','Outcome needs checking']] as const){
      const html=renderToStaticMarkup(<JourneyCard event={{...base,status}} revision={2} date={date}/>);
      expect(html).toContain(label);expect(html).not.toContain('A new possibility');
    }
  });
  it('does not show an empty notification inbox when its read failed',()=>{
    expect(renderToStaticMarkup(<NotificationCenter notifications={[]} status="error"/>)).toContain('Updates could not be loaded');
    expect(renderToStaticMarkup(<NotificationCenter notifications={[]} status="error"/>)).not.toContain('No saved updates yet');
    expect(renderToStaticMarkup(<NotificationCenter notifications={[]} status="ready"/>)).toContain('No saved updates yet');
  });
});
