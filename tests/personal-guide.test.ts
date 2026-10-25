import { randomUUID } from 'node:crypto';
import { afterEach,describe,it,expect } from 'vitest';
import request from 'supertest';
import { PersonalGuide } from '../server/personal-guide.js';
import { Journal } from '../server/journal.js';
import { Workflow } from '../server/workflow.js';
import { createApp } from '../server/app.js';
import { AppError } from '../server/errors.js';
import { TestMemory } from './support/test-memory.js';
import { DemoFixtureMemory,DemoFixtureStore,fixtureSources } from './support/demo-fixture.js';
import { emptyPersonalIntake } from '../shared/personal-guide.js';
import type { Employment } from '../shared/employment.js';
import type { Config } from '../server/config.js';
import {fictionalCrsEvidence} from '../shared/crs.js';
import {projectExpressEntry} from '../server/discovery.js';
import {GuideWriteNotStarted} from '../server/demo-memory.js';
const owner='user_Personal',origin='https://private.example.test';
const binding={ownerId:owner,endpoint:'https://memory.example.test',context:'private-test',readKey:'fixture-read',writeKey:'fixture-write'};
const employment:Employment={employer:'Offline employer',title:'Systems analyst',duties:'Analyze systems requirements and test software against documented needs.',startDate:'2024-01-15',endDate:null,currentJob:true,hoursPerWeek:38,countryCode:'CA',paid:'yes',authorizedToWork:'yes',nocCode:'21221',nocReviewed:true};
const journals:Journal[]=[];afterEach(()=>journals.splice(0).forEach(j=>j.close()));
function setup(){
  const journal=new Journal(':memory:');journals.push(journal);const ordinary=new TestMemory();
  const workflow=new Workflow(journal,ordinary,()=>binding,()=>new Date('2026-10-25T15:00:00Z'));
  const store=new DemoFixtureStore(),memory=new DemoFixtureMemory();let reviewed=true;
  const evidence:unknown[]=[];
  const make=()=>new PersonalGuide(store,memory,fixtureSources,workflow,async()=>reviewed,async(_id,data)=>{evidence.push(data);},()=>new Date('2026-10-25T15:00:00Z'));
  const guide=make();
  const config:Config={origin,amAccessMode:'single-owner-production',publishableKey:'pk_live_fixture',secretKey:'sk_live_fixture',bindings:new Map([[owner,binding]])};
  const app=createApp({config,workflow,personalGuide:guide,authentication:{middleware:(_req,_res,next)=>next(),owner:req=>req.get('X-Test-Owner')??null}});
  const http=(method:'get'|'post',path:string)=>request(app)[method](path).set('Origin',origin).set('X-Test-Owner',owner);
  async function saveEmployment(hours=38){const current=await workflow.read(owner);const p=await workflow.propose(owner,{baseRevision:current.revision,employment:{...employment,hoursPerWeek:hours}});await workflow.confirm(owner,p.id,{proposalRevision:1});}
  async function saveInputs(){const current=await guide.profile(owner);const p=await guide.propose(owner,{baseRevision:current.revision,employmentRevision:current.employmentRevision,intake:{...emptyPersonalIntake,canadianOffer:'yes',reciprocalProgramReported:'yes',reciprocalEvidence:'promised'}});return guide.confirm(owner,p.id,{confirm:true});}
  return {guide,make,workflow,store,memory,ordinary,evidence,http,saveEmployment,saveInputs,setReviewed:(value:boolean)=>{reviewed=value;}};
}
describe('personal Guide reuses research with receipt-bound inputs, not a second employment truth',()=>{
  it.each([['2024-07-15',undefined],['2025-07-15',35]] as const)('caps ended employment at %s after confirmation and reload',async(endDate,expected)=>{
    const t=setup();const e:Employment={...employment,currentJob:false,endDate,hoursPerWeek:40,cecWork:{startDate:employment.startDate,ongoing:false,endDate,hoursPerWeek:40,singleIntervalComplete:'yes',conditionsConsistent:'yes',physicallyInCanada:'yes',authorizedTemporaryResident:'yes',paid:'yes',relationship:'employee',physicianException:'no',fullTimeStudy:'no',workArrangement:'onsite',canadianEmployer:'yes',nocDutiesMatch:'yes',nocEssentialDutiesMatch:'yes'}};
    const ep=await t.workflow.propose(owner,{baseRevision:0,employment:e});await t.workflow.confirm(owner,ep.id,{proposalRevision:1});
    const intake={...emptyPersonalIntake,name:'Offline interval fixture',arrivedInCanada:'2021-09-01',permitExpiry:'2027-01-15',spouseAccompanying:'yes',qualifyingExpressEntryOffer:'none_reviewed'};
    const p=await t.guide.propose(owner,{baseRevision:0,employmentRevision:1,intake});await t.guide.confirm(owner,p.id,{confirm:true});
    const reloaded=await t.make().profile(owner);expect(reloaded.profile).toMatchObject({workEnd:endDate,currentJob:false,intervalComplete:true});
    const result=await t.make().replay(owner,{requestId:randomUUID(),fictional:false});expect(result.discovery?.score?.before).toBe(expected);
    const {workEnd:_end,currentJob:_current,...legacy}=reloaded.profile!;
    expect(projectExpressEntry(legacy,'2026-10-25',1,[]).status).toBe('needs_information');
    expect(projectExpressEntry({...reloaded.profile!,workEnd:null},'2026-10-25',1,[]).score).toBeUndefined();
    expect(projectExpressEntry({...reloaded.profile!,workEnd:'2010-01-01',workStart:'2008-01-01',arrivedInCanada:'2007-01-01'},'2026-10-25',1,[]).score).toBeUndefined();
  });
  it('releases only a proven not-started save, retaining the reviewed proposal for explicit retry',async()=>{
    const t=setup();await t.saveEmployment();const p=await t.guide.propose(owner,{baseRevision:0,employmentRevision:1,intake:emptyPersonalIntake});
    const write=t.memory.write.bind(t.memory);t.memory.write=async()=>{throw new GuideWriteNotStarted();};
    const failed=await t.http('post',`/api/guide/proposals/${p.id}/confirm`).send({confirm:true});expect(failed.body.error.code).toBe('GUIDE_WRITE_NOT_STARTED');
    expect(await t.store.proposal(owner,p.id)).toMatchObject({status:'pending',confirmedAt:null,digest:p.digest});expect(t.memory.writes).toBe(0);
    t.memory.write=write;expect((await t.make().confirm(owner,p.id,{confirm:true})).revision).toBe(1);expect(t.memory.writes).toBe(1);
  });
  it('reconciles exact successful writes after readback failure without replaying POST, including on reload',async()=>{
    const t=setup();await t.saveEmployment();const p=await t.guide.propose(owner,{baseRevision:0,employmentRevision:1,intake:emptyPersonalIntake});
    const write=t.memory.write.bind(t.memory);t.memory.write=async(o,e)=>{await write(o,e);throw new AppError(503,'DEMO_WRITE_UNCERTAIN','Readback failed');};
    await expect(t.guide.confirm(owner,p.id,{confirm:true})).rejects.toMatchObject({code:'DEMO_WRITE_UNCERTAIN'});expect((await t.store.proposal(owner,p.id)).status).toBe('uncertain');
    await expect(t.make().reconcile('user_Other',p.id,{})).rejects.toMatchObject({code:'DEMO_RECORD_NOT_FOUND'});
    const response=await t.http('post',`/api/guide/proposals/${p.id}/reconcile`).send({});expect(response.status).toBe(200);expect(response.body.revision).toBe(1);
    expect((await t.make().confirm(owner,p.id,{confirm:true})).revision).toBe(1);expect(t.memory.writes).toBe(1);
  });
  it('keeps an unknown write held when no exact evidence exists, even after repeated checks',async()=>{
    const t=setup();await t.saveEmployment();const p=await t.guide.propose(owner,{baseRevision:0,employmentRevision:1,intake:emptyPersonalIntake});let attempts=0;
    t.memory.write=async()=>{attempts++;throw new AppError(503,'DEMO_WRITE_UNCERTAIN','Response lost');};
    await expect(t.guide.confirm(owner,p.id,{confirm:true})).rejects.toBeDefined();
    await expect(t.make().confirm(owner,p.id,{confirm:true})).rejects.toMatchObject({code:'DEMO_WRITE_UNCERTAIN'});
    await expect(t.make().reconcile(owner,p.id,{})).rejects.toMatchObject({code:'DEMO_WRITE_UNCERTAIN'});
    expect(attempts).toBe(1);expect((await t.store.proposal(owner,p.id)).status).toBe('uncertain');
    await expect(t.store.reject(owner,p.id)).rejects.toBeDefined();
  });
  it('starts with unknowns, requires actual reviewed employment and rejects fictional/client-owned fields',async()=>{
    const t=setup();expect((await t.guide.profile(owner)).intake).toEqual(emptyPersonalIntake);
    expect((await t.http('get','/api/guide/status')).body).toMatchObject({available:true,fictionalOnly:false});
    await expect(t.saveInputs()).rejects.toBeDefined();
    await t.saveEmployment();
    for(const intake of [{...emptyPersonalIntake,fictional:true},{...emptyPersonalIntake,employer:'Injected employer'},{...emptyPersonalIntake,ownerId:'user_Other'}])expect((await t.http('post','/api/guide/proposals').send({baseRevision:0,employmentRevision:1,intake})).status).toBe(400);
    expect((await request(createApp({})).get('/api/guide/profile')).status).toBe(503);
    expect(t.memory.writes).toBe(0);
  });
  it('persists/reloads explicit personal purpose and keeps missing work evidence unknown',async()=>{
    const t=setup();await t.saveEmployment();const saved=await t.saveInputs();
    expect(saved.profile).toMatchObject({fictional:false,inputPurpose:'reviewed-assessment-inputs',employer:employment.employer,weeklyHours:38,physicallyCanada:'unknown',intervalComplete:false});
    expect(t.memory.envelopes.get(owner)?.purpose).toBe('maple-personal-assessment');
    expect((await t.make().profile(owner)).profile).toEqual(saved.profile);
    const update=await t.guide.replay(owner,{requestId:randomUUID(),fictional:false});
    expect(update.discovery?.status).toBe('needs_information');expect(update.discovery?.score).toBeUndefined();expect(update.discovery?.crs).toBeUndefined();
    expect(t.ordinary.writes).toHaveLength(1);expect(t.memory.writes).toBe(1);
  });
  it('runs source-backed C20 through the shared engine and reloads the stored result without resending',async()=>{
    const t=setup();await t.saveEmployment();await t.saveInputs();const requestId=randomUUID();
    const event=await t.guide.discover(owner,{requestId,fictional:false,question:'How could I continue working here?'});
    expect(event.discovery?.status).toBe('potential_pathway');expect(t.memory.explanations).toBe(1);
    expect(JSON.stringify(t.evidence)).toContain('REVIEWED PERSONAL ASSESSMENT INPUTS');expect(JSON.stringify(t.evidence)).not.toContain('REVIEWED FICTIONAL PROFILE');
    expect((await t.make().history(owner)).events[0]).toEqual(event);
    expect(await t.guide.discover(owner,{requestId,fictional:false,question:'How could I continue working here?'})).toEqual(event);expect(t.memory.explanations).toBe(1);
  });
  it('calculates a complete personal-purpose total only from explicitly reviewed synthetic test evidence',async()=>{
    const t=setup();const e:Employment={...employment,cecWork:{startDate:employment.startDate,ongoing:true,endDate:null,hoursPerWeek:38,singleIntervalComplete:'yes',conditionsConsistent:'yes',physicallyInCanada:'yes',authorizedTemporaryResident:'yes',paid:'yes',relationship:'employee',physicianException:'no',fullTimeStudy:'no',workArrangement:'onsite',canadianEmployer:'yes',nocDutiesMatch:'yes',nocEssentialDutiesMatch:'yes'}};
    const ep=await t.workflow.propose(owner,{baseRevision:0,employment:e});await t.workflow.confirm(owner,ep.id,{proposalRevision:1});
    const crsEvidence=fictionalCrsEvidence('2026-10-25');crsEvidence.completeEvidenceReviewed='yes';
    const intake={...emptyPersonalIntake,name:'Offline personal-purpose fixture',arrivedInCanada:'2021-09-01',permitExpiry:'2027-01-15',spouseAccompanying:'yes',qualifyingExpressEntryOffer:'none_reviewed',crsEvidence};
    const p=await t.guide.propose(owner,{baseRevision:0,employmentRevision:1,intake});await t.guide.confirm(owner,p.id,{confirm:true});
    const result=await t.guide.replay(owner,{requestId:randomUUID(),fictional:false});
    expect(result.discovery?.crs).toMatchObject({status:'complete',before:528,after:568,delta:40,projected:true});
    expect(result.discovery?.summary).not.toContain('fictional');expect(t.memory.explanations).toBe(0);
    expect((await t.make().history(owner)).events[0]?.discovery?.crs).toEqual(result.discovery?.crs);
    crsEvidence.canadianWorkEnd='2025-01-01';await expect(t.guide.propose(owner,{baseRevision:1,employmentRevision:1,intake})).rejects.toMatchObject({code:'GUIDE_EVIDENCE_CONFLICT'});
  });
  it('invalidates old intake on employment change and refuses stale confirmation before any AM write',async()=>{
    const t=setup();await t.saveEmployment();await t.saveInputs();
    const pending=await t.guide.propose(owner,{baseRevision:1,employmentRevision:1,intake:emptyPersonalIntake});
    await t.saveEmployment(39);expect((await t.guide.profile(owner)).reviewRequired).toBe(true);
    await expect(t.guide.confirm(owner,pending.id,{confirm:true})).rejects.toMatchObject({code:'GUIDE_INPUT_REVIEW_REQUIRED'});
    await expect(t.guide.discover(owner,{requestId:randomUUID(),fictional:false,question:'What changed?'})).rejects.toMatchObject({code:'GUIDE_INPUT_REVIEW_REQUIRED'});
    expect(t.memory.writes).toBe(1);expect(t.memory.explanations).toBe(0);
    await t.store.reject(owner,pending.id);await t.saveInputs();expect((await t.guide.profile(owner)).reviewRequired).toBe(false);
  });
  it('holds unresolved native processing and checks employment again after an awaited review callback',async()=>{
    const t=setup();await t.saveEmployment();await t.saveInputs();t.setReviewed(false);
    expect((await t.guide.history(owner)).reviewRequired).toBe(true);
    await expect(t.saveInputs()).rejects.toMatchObject({code:'GUIDE_INPUT_REVIEW_REQUIRED'});expect(t.memory.writes).toBe(1);
    const racing=new PersonalGuide(t.store,t.memory,fixtureSources,t.workflow,async()=>{await t.saveEmployment(40);return true;},()=>{});
    expect((await racing.profile(owner)).reviewRequired).toBe(true);
  });
  it('returns a definitive pre-dispatch receipt for validation/body/rate rejection, never for a claimed unknown send',async()=>{
    const t=setup();await t.saveEmployment();await t.saveInputs();
    const invalid=await t.http('post','/api/guide/discover').send({requestId:randomUUID(),fictional:false,question:'x'.repeat(2001)});
    expect(invalid.body.error).toMatchObject({code:'VALIDATION_FAILED',guideRequestState:'not_started'});
    const oversized=await t.http('post','/api/guide/discover').send({requestId:randomUUID(),fictional:false,question:'x'.repeat(40_000)});
    expect(oversized.body.error).toMatchObject({code:'BODY_TOO_LARGE',guideRequestState:'not_started'});
    t.memory.failExplanation=true;
    const uncertain=await t.http('post','/api/guide/discover').send({requestId:randomUUID(),fictional:false,question:'Can you investigate?'});
    expect(uncertain.body.error.code).toBe('GUIDE_RESPONSE_UNCERTAIN');expect(uncertain.body.error.guideRequestState).toBeUndefined();
    let limited;for(let i=0;i<61;i++)limited=await t.http('post','/api/guide/policy-replay').send({});
    expect(limited!.body.error).toMatchObject({code:'RATE_LIMITED',guideRequestState:'not_started'});expect(t.memory.explanations).toBe(1);
  });
});
