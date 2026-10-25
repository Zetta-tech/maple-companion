import {randomUUID} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {demoProfileSchema,demoSeed} from '../shared/demo.js';
import {fictionalCrsEvidence} from '../shared/crs.js';
import {demoDigest} from '../server/demo-memory.js';
import {DemoJourney} from '../server/demo-journey.js';
import {DemoFixtureStore,DemoFixtureMemory,fixtureSources} from './support/demo-fixture.js';
import {projectExpressEntry} from '../server/discovery.js';
import {CrsEvidenceEditor} from '../web/CrsEvidenceEditor.js';
import {JourneyCard} from '../web/DemoJourneyPanel.js';
const asOf='2026-10-25';
describe('complete fictional score through existing approved-profile and private journey flow',()=>{
  it('does not add defaults to old profiles or alter their receipt digest',()=>{
    const raw=JSON.stringify(demoSeed),digest=demoDigest(demoSeed),parsed=demoProfileSchema.parse(JSON.parse(raw));
    expect(parsed.crsEvidence).toBeUndefined();expect(JSON.stringify(parsed)).toBe(raw);expect(demoDigest(parsed)).toBe(digest);
    expect(renderToStaticMarkup(<CrsEvidenceEditor value={undefined} onChange={()=>{}} asOf={asOf} spouseAccompanying="yes"/>)).toContain('Add fictional CRS details for review');
  });
  it('requires review and exact confirmation before full scoring, persists the actual breakdown, and deduplicates replay',async()=>{
    const store=new DemoFixtureStore(),memory=new DemoFixtureMemory(),service=new DemoJourney(store,memory,fixtureSources,()=>{},()=>new Date('2026-10-25T12:00:00Z'));
    const evidence=fictionalCrsEvidence(asOf),profile={...demoSeed,crsEvidence:evidence};
    const unreviewed=projectExpressEntry(profile,asOf,1,(await fixtureSources.retrieve('express_entry_full')).evidence);expect(unreviewed.crs?.status).toBe('needs_information');
    evidence.completeEvidenceReviewed='yes';const proposal=await service.propose('user_fixture',{baseRevision:0,profile});expect(memory.writes).toBe(0);
    await expect(service.confirm('user_other',proposal.id,{confirm:true})).rejects.toMatchObject({code:'DEMO_RECORD_NOT_FOUND'});
    await service.confirm('user_fixture',proposal.id,{confirm:true});expect(memory.writes).toBe(1);
    const first=await service.replay('user_fixture',{requestId:randomUUID(),fictional:true});
    expect(first.discovery?.crs).toMatchObject({status:'complete',before:528,after:568,delta:40,asOf});expect(memory.explanations).toBe(0);
    const reloaded=new DemoJourney(store,memory,fixtureSources,()=>{},()=>new Date('2026-10-25T12:00:00Z'));
    expect((await reloaded.history('user_fixture')).events[0]?.discovery?.crs).toEqual(first.discovery?.crs);expect((await reloaded.history('user_other')).events).toEqual([]);
    expect((await reloaded.replay('user_fixture',{requestId:randomUUID(),fictional:true})).id).toBe(first.id);
    const html=renderToStaticMarkup(<JourneyCard event={first} revision={1} date={asOf}/>);expect(html).toContain('Fictional total CRS comparison');expect(html).toContain('528');expect(html).toContain('568');expect(html).toContain('not counted twice');
    expect(renderToStaticMarkup(<JourneyCard event={first} revision={2} date={asOf}/>)).toContain('historical item');
    if(first.discovery?.crs?.status==='complete')first.discovery.crs.policyVersion='superseded-fixture-version';
    expect(renderToStaticMarkup(<JourneyCard event={first} revision={1} date={asOf}/>)).toContain('historical item');
  });
  it('holds a full result if source versions are missing or do not match the reviewed calculator',async()=>{
    const e=fictionalCrsEvidence(asOf);e.completeEvidenceReviewed='yes';const profile={...demoSeed,crsEvidence:e};
    expect(projectExpressEntry(profile,asOf,1,[]).status).toBe('needs_information');
    const sources=(await fixtureSources.retrieve('express_entry_full')).evidence.map(s=>({...s,bodySha256:'b'.repeat(64)}));
    expect(projectExpressEntry(profile,asOf,1,sources).crs).toBeUndefined();
  });
});
