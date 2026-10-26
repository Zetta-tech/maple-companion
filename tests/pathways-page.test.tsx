import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PathwaysContent} from '../web/PathwaysPage.js';
import {loadPathways,latestPathwayEvent,pathwayEventState,type PathwaysReadback} from '../web/pathways-readback.js';
import {pathwaysRouteFromHash} from '../web/pathways-navigation.js';
import {RequestError} from '../web/request.js';
import {discoverC20,projectExpressEntry} from '../server/discovery.js';
import {demoSeed,type JourneyEvent} from '../shared/demo.js';
import {fictionalCrsEvidence} from '../shared/crs.js';
import {fixtureSources} from './support/demo-fixture.js';

const date='2026-10-25';
const blank:PathwaysReadback={fictional:false,events:[],revision:1,guideError:'',needsReview:false,policies:[],assessments:[],checksError:''};
const html=(readback:PathwaysReadback|null,selected='',blocked=false,loading=false)=>renderToStaticMarkup(<PathwaysContent readback={readback} loading={loading} blocked={blocked} employmentRevision={3} date={date} selected={selected} refresh={()=>{}}/>);
async function events(){
 const evidence=fictionalCrsEvidence(date);evidence.completeEvidenceReviewed='yes';evidence.dateOfBirth='1997-01-01';
 evidence.education={level:'masters_professional',basis:'foreign_eca',ecaDate:'2025-01-15',qualificationReviewed:'yes'};
 evidence.english={status:'tested',test:'CELPIP-General',date:'2026-01-15',reading:9,writing:9,listening:9,speaking:9,benchmarkConversionReviewed:'yes'};
 evidence.canadianEducation='none';evidence.canadianWorkEnd='2025-09-30';
 const profile={...demoSeed,workStart:'2023-10-01',arrivedInCanada:'2023-10-01',weeklyHours:30,crsEvidence:evidence};
 const discovery=discoverC20(profile,date,1,(await fixtureSources.retrieve('c20')).evidence);
 const impact=projectExpressEntry(profile,date,1,(await fixtureSources.retrieve('express_entry_full')).evidence);
 return [{id:'option',kind:'discovery',status:'completed',createdAt:date+'T12:00:00Z',profileRevision:1,discovery},{id:'impact',kind:'policy_update',status:'completed',createdAt:date+'T12:01:00Z',profileRevision:1,discovery:impact}] as JourneyEvent[];
}
function reader(overrides:Record<string,unknown>={}){
 const data:Record<string,unknown>={'/api/guide/status':{available:true},'/api/guide/profile':{revision:1,profile:{},verified:true,employmentRevision:3},'/api/guide/journey':{events:[],revision:1},'/api/policies':{policies:[]},'/api/assessments':{assessments:[]},...overrides};
 const calls:[string][]=[];
 const request=async<T,>(path:string):Promise<T>=>{calls.push([path]);const value=data[path];if(value instanceof Error)throw value;if(value===undefined)throw Error('Unexpected path '+path);return value as T;};
 return Object.assign(request,{mock:{calls}});
}
describe('Pathways saved evidence and navigation',()=>{
 it('reads saved records only, keeping personal and demo data separate',async()=>{
  const request=reader();expect(await loadPathways(request,3)).toMatchObject({fictional:false,revision:1,needsReview:false});
  expect(request.mock.calls.every(call=>call.length===1)).toBe(true);expect(request.mock.calls.some(([path])=>path.startsWith('/api/demo'))).toBe(false);
 });
 it('withholds current findings for changed or unverified employment and Guide revisions',async()=>{
  for(const overrides of [{'/api/guide/profile':{revision:1,profile:{},verified:true,employmentRevision:2}},{'/api/guide/journey':{events:[],revision:2}},{'/api/guide/profile':{revision:1,profile:{},verified:false,employmentRevision:3}},{'/api/guide/journey':{events:[],revision:1,reviewRequired:true}}])expect((await loadPathways(reader(overrides),3)).revision).toBeNull();
 });
 it('does not replace failed personal storage with fictional findings',async()=>{
  const request=reader({'/api/guide/status':new RequestError('Unavailable','READ_FAILED')});const result=await loadPathways(request,3);
  expect(result.guideError).not.toBe('');expect(result.fictional).toBe(false);expect(request.mock.calls.some(([path])=>path.startsWith('/api/demo'))).toBe(false);
 });
 it('labels the explicit demo fallback and retains independent registry errors',async()=>{
  const result=await loadPathways(reader({'/api/guide/status':{available:false},'/api/demo/status':{available:true},'/api/demo/profile':{revision:1,verified:true,profile:{}},'/api/demo/journey':{events:[]},'/api/policies':Error('Offline')}),3);
  expect(result).toMatchObject({fictional:true,revision:1,guideError:''});expect(result.checksError).not.toBe('');
 });
 it('keeps processing and uncertain requests ahead of older completed results',async()=>{
  const saved=(await events())[0]!;
  for(const status of ['processing','uncertain','not_sent'] as const){const newer={...saved,status};expect(latestPathwayEvent([newer,saved],'discovery')).toBe(newer);expect(pathwayEventState(newer,1,date)).not.toBe('current');expect(html({...blank,events:[newer]})).not.toContain('Potential option');}
 });
 it('shows calculated score impact separately from a potential work permit, retaining qualifiers and evidence links',async()=>{
  const saved=await events();const score=saved[1]!.discovery!.crs;if(score?.status!=='complete')throw Error('Expected reviewed fixture to calculate');
  const rendered=html({...blank,fictional:true,events:saved});expect(rendered).toContain('Demo scenario');expect(rendered).toContain('Work permits');expect(rendered).toContain('Policy impact');expect(rendered).toContain(`from ${score.before} to ${score.after}`);expect(rendered).toContain('2026-11-03');expect(rendered).toContain('eligibility is not established');expect(rendered).toContain('Review score breakdown');expect(rendered).toContain('No reviewed route check available yet');
 });
 it('does not expose current score claims while stale, blocked, loading or unavailable',async()=>{
  const saved=await events();const old={...saved[1]!,profileRevision:0};
  for(const rendered of [html({...blank,events:[old]}),html({...blank,events:saved},'',true),html({...blank,events:saved},'',false,true),html(null)])expect(rendered).not.toContain('class="pathways-score"');
  expect(html({...blank,events:[old]})).toContain('Needs review');expect(html(null)).toContain('Saved checks are unavailable');
 });
 it('opens exact saved detail with official sources and marks older evidence historical',async()=>{
  const saved=await events();const detail=html({...blank,events:saved},'option');expect(detail).toContain('Your saved update');expect(detail).toContain('Official');expect(detail).toContain('https://www.canada.ca/');expect(html({...blank,revision:null,events:saved},'option')).toContain('historical');
  expect(html({...blank,events:saved},'missing')).toContain('This saved update is unavailable');
 });
 it('does not classify an unknown registered program as a permanent-residence pathway',()=>{
  const rendered=html({...blank,policies:[{id:'test',version:'1',program:'Synthetic work check',title:'Synthetic recorded condition',effectiveFrom:date,effectiveTo:null,sourceUrl:'https://www.canada.ca/',digest:'a'.repeat(64)}]});
  expect(rendered).toContain('Program requirements');expect(rendered).toContain('Synthetic work check');expect(rendered).not.toContain('>Permanent residence</h2>');
 });
 it('recognizes only pathways routes and safely decodes saved event identifiers',()=>{
  expect(pathwaysRouteFromHash('#pathways')).toBe('');expect(pathwaysRouteFromHash('#pathways/update/a%2Fb')).toBe('a/b');expect(pathwaysRouteFromHash('#profile')).toBeNull();expect(pathwaysRouteFromHash('#pathways/update/%ZZ')).toBeNull();
 });
});
