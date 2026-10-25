import {randomUUID} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {DemoJourney} from '../server/demo-journey.js';
import {demoSeed} from '../shared/demo.js';
import {DemoFixtureMemory,DemoFixtureStore,fixtureSources} from './support/demo-fixture.js';
import {JourneyCard} from '../web/DemoJourneyPanel.js';
import {businessDate} from '../shared/business-date.js';
import {AppError} from '../server/errors.js';
import {guideQuestionSchema,guideRequestNotSent} from '../shared/guide-request.js';

function setup(){const store=new DemoFixtureStore(),memory=new DemoFixtureMemory();return {store,memory,service:new DemoJourney(store,memory,fixtureSources)};}
async function save(service:DemoJourney,profile=demoSeed,revision=0){const p=await service.propose('user_fixture',{baseRevision:revision,profile});return service.confirm('user_fixture',p.id,{confirm:true});}
const discover=(service:DemoJourney,id=randomUUID())=>service.discover('user_fixture',{requestId:id,question:'What should we investigate with HR?',fictional:true});

describe('offline demo workflow — explicit memory/store substitutes, not hosted validation',()=>{
  it('requires exact confirmation, then preserves profile and journey across service reconstruction',async()=>{
    const {store,memory,service}=setup();const proposal=await service.propose('user_fixture',{baseRevision:0,profile:demoSeed});
    expect(memory.writes).toBe(0);await expect(service.confirm('user_other',proposal.id,{confirm:true})).rejects.toMatchObject({code:'DEMO_RECORD_NOT_FOUND'});
    await service.confirm('user_fixture',proposal.id,{confirm:true});await service.confirm('user_fixture',proposal.id,{confirm:true});expect(memory.writes).toBe(1);
    const event=await discover(service);expect(event.discovery?.status).toBe('potential_pathway');
    const reload=new DemoJourney(store,memory,fixtureSources);expect((await reload.profile('user_fixture')).profile).toEqual(demoSeed);expect((await reload.history('user_fixture')).events).toEqual([event]);expect((await reload.history('user_other')).events).toEqual([]);
  });
  it('changes the finding when reciprocity is removed, independently of employer brand, and labels old results historical',async()=>{
    const {service}=setup();await save(service);const first=await discover(service);
    await save(service,{...demoSeed,employer:'Different fictional employer',reciprocalProgramReported:'no'},1);const second=await discover(service);
    expect(second.discovery?.status).toBe('not_supported');expect(second.discovery?.score).toBeUndefined();
    const html=renderToStaticMarkup(<JourneyCard event={first} revision={2}/>);expect(html).toContain('historical item is not a current assessment');expect(html).toContain('<summary>View the dated result</summary>');
    expect(html).toContain(first.reply);expect(html).toContain('Saved generated explanation');
    expect(renderToStaticMarkup(<JourneyCard event={second} revision={2}/>)).toContain('does not yet support');
  });
  it('holds missing evidence without inventing an eligibility answer',async()=>{
    const {service}=setup();await save(service,{...demoSeed,canadianOffer:'unknown',reciprocalProgramReported:'unknown'});const event=await discover(service);
    expect(event.discovery?.status).toBe('needs_information');expect(event.discovery?.outstanding.join(' ')).toContain('Canadian offer');
  });
  it('does not re-run a completed discovery or duplicate the same dated policy replay',async()=>{
    const {service,memory}=setup();await save(service);const id=randomUUID();expect((await discover(service,id)).id).toBe(id);expect((await discover(service,id)).id).toBe(id);expect(memory.explanations).toBe(1);
    const first=await service.replay('user_fixture',{requestId:randomUUID(),fictional:true});const second=await service.replay('user_fixture',{requestId:randomUUID(),fictional:true});expect(second.id).toBe(first.id);expect(first.discovery?.score?.totalCrs).toBeNull();expect(first.discovery?.assessmentDate).toBe(businessDate(new Date()));
  });
  it('retains an uncertain outcome on reload and blocks a second provider attempt',async()=>{
    const {store,memory,service}=setup();await save(service);memory.failExplanation=true;
    await expect(discover(service)).rejects.toMatchObject({code:'GUIDE_RESPONSE_UNCERTAIN'});expect((await service.history('user_fixture')).events[0]?.status).toBe('uncertain');
    await expect(discover(new DemoJourney(store,memory,fixtureSources))).rejects.toMatchObject({code:'DEMO_REVIEW_REQUIRED'});expect(memory.explanations).toBe(1);expect(memory.writes).toBe(1);
  });
  it('does not call the provider or create a journey record when source retrieval fails',async()=>{
    const {store,memory,service}=setup();await save(service);const offline=new DemoJourney(store,memory,{async retrieve(){throw Error('source unavailable');}});
    await expect(discover(offline)).rejects.toThrow('source unavailable');expect(memory.explanations).toBe(0);expect((await offline.history('user_fixture')).events).toEqual([]);
  });
  it('renders yesterday’s completed result as historical after the business date advances',async()=>{
    const {service}=setup();await save(service);const event=await discover(service);
    expect(renderToStaticMarkup(<JourneyCard event={event} revision={1} date="2099-01-01"/>)).toContain('historical item is not a current assessment');
  });
  it('rejects an oversized question before event claim or provider use, then accepts a corrected question',async()=>{
    const {service,memory}=setup();await save(service);
    expect(guideQuestionSchema.safeParse('x'.repeat(2001)).success).toBe(false);
    await expect(service.discover('user_fixture',{requestId:randomUUID(),question:'x'.repeat(2001),fictional:true})).rejects.toThrow();
    expect((await service.history('user_fixture')).events).toEqual([]);expect(memory.explanations).toBe(0);
    expect(guideRequestNotSent('VALIDATION_FAILED')).toBe(true);expect(guideRequestNotSent('GUIDE_RESPONSE_UNCERTAIN')).toBe(false);
    expect((await discover(service)).status).toBe('completed');
  });
  it('records definitely-not-sent connection failure and permits a new explicit request after reload',async()=>{
    const {store,memory,service}=setup();await save(service);
    const explain=memory.explain.bind(memory);memory.explain=async()=>{throw new AppError(503,'GUIDE_NOT_SENT','Read-only identity check failed');};
    await expect(discover(service)).rejects.toMatchObject({code:'GUIDE_NOT_SENT'});
    expect((await service.history('user_fixture')).events[0]?.status).toBe('not_sent');expect(memory.explanations).toBe(0);
    memory.explain=explain;expect((await discover(new DemoJourney(store,memory,fixtureSources))).status).toBe('completed');expect(memory.explanations).toBe(1);
  });
  it('withholds a contradictory explanation without replacing it with a canned reply or resending chat',async()=>{
    const {service,memory}=setup();await save(service);
    memory.explain=async()=>{memory.explanations++;return {reply:JSON.stringify({assessmentStatus:'potential_pathway',sourceUrls:['https://www.canada.ca/'],explanation:'You are eligible and your spouse will get a permit.'}),sessionId:'fixture',traceId:'fixture',raw:{fictional:true}};};
    const event=await discover(service);expect(event.status).toBe('completed');expect(event.discovery?.status).toBe('potential_pathway');expect(event.reply).toBeUndefined();expect(event.explanationStatus).toBe('withheld');expect(memory.explanations).toBe(1);
    const html=renderToStaticMarkup(<JourneyCard event={event} revision={1}/>);expect(html).toContain('not shown');expect(html).not.toContain('You are eligible');
  });
});
