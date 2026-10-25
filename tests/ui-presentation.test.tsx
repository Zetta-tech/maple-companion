import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoSeed, type JourneyEvent } from '../shared/demo.js';
import { fictionalCrsEvidence, CRS_POLICY_VERSION } from '../shared/crs.js';
import { discoverC20, projectExpressEntry } from '../server/discovery.js';
import { fixtureSources } from './support/demo-fixture.js';
import { JourneyCard } from '../web/DemoJourneyPanel.js';
import { splitJourney } from '../web/journey-presentation.js';
import { NotificationCenter } from '../web/NotificationCenter.js';

const date='2026-10-25';
const base:JourneyEvent={id:'current',kind:'discovery',status:'completed',createdAt:date+'T08:00:00Z',profileRevision:2};
describe('results-first presentation preserves the meaning of backend outcomes',()=>{
  it('shows C20 reason and next action before disclosure, retaining all conditions and sources',async()=>{
    const discovery=discoverC20(demoSeed,date,2,(await fixtureSources.retrieve()).evidence);
    const html=renderToStaticMarkup(<JourneyCard event={{...base,discovery}} revision={2} date={date}/>);
    const firstDisclosure=html.indexOf('<details>');
    expect(html.indexOf(discovery.reasons.at(-1)!)).toBeLessThan(firstDisclosure);
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
      const primary=html.slice(0,html.indexOf('<details>'));
      expect(primary).toContain(String(changed.crs.after));
      expect(primary).toContain(delta>0?'could add 40':delta<0?'could reduce your CRS by 15':'unchanged');
      expect(primary).toContain('Projected');
      expect(primary).toContain(changed.crs.effectiveFrom);
      expect(primary).toContain('overall policy cap remains unresolved');
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

