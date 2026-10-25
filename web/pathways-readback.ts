import type {JourneyEvent} from '../shared/demo.js';
import type {PolicySummary} from '../shared/policy.js';
import type {AssessmentView} from '../shared/assessment.js';
import {RequestError} from './request.js';
import {isJourneyStale} from './journey-presentation.js';

type Read = <T>(path:string)=>Promise<T>;
export type PathwaysReadback={fictional:boolean;events:JourneyEvent[];revision:number|null;guideError:string;needsReview:boolean;policies:PolicySummary[];assessments:AssessmentView[];checksError:string};
type Snapshot={revision:number;verified:boolean;profile:unknown;reviewRequired?:boolean;employmentRevision?:number};
type Journey={events:JourneyEvent[];revision?:number;reviewRequired?:boolean};
export async function loadPathways(request:Read,employmentRevision:number|null):Promise<PathwaysReadback> {
 async function guide() {
  let available=false;
  try{available=(await request<{available:boolean}>('/api/guide/status')).available;}catch(error){if(!(error instanceof RequestError&&error.code==='NOT_FOUND'))throw error;}
  const prefix=available?'/api/guide':'/api/demo';
  if(!available&&!(await request<{available:boolean}>('/api/demo/status')).available)throw Error('No Guide is available in this workspace yet.');
  const [snapshot,journey]=await Promise.all([request<Snapshot>(prefix+'/profile'),request<Journey>(prefix+'/journey')]);
  const needsReview=!snapshot.verified||!!snapshot.reviewRequired||!!journey.reviewRequired||!snapshot.profile||(available&&snapshot.employmentRevision!==employmentRevision)||(journey.revision!==undefined&&journey.revision!==snapshot.revision);
  return {fictional:!available,events:journey.events,revision:snapshot.verified&&!needsReview?snapshot.revision:null,needsReview};
 }
 const [saved,policies,assessments]=await Promise.allSettled([guide(),request<{policies:PolicySummary[]}>('/api/policies'),request<{assessments:AssessmentView[]}>('/api/assessments')]);
 return {...(saved.status==='fulfilled'?saved.value:{fictional:false,events:[],revision:null,needsReview:true}),guideError:saved.status==='rejected'?'Your saved options and policy updates could not be checked.':'',policies:policies.status==='fulfilled'?policies.value.policies:[],assessments:assessments.status==='fulfilled'?assessments.value.assessments:[],checksError:policies.status==='rejected'||assessments.status==='rejected'?'Reviewed requirement checks could not be loaded.':''};
}
export function latestPathwayEvent(events:JourneyEvent[],kind:JourneyEvent['kind']) { return events.find(event=>event.kind===kind); }
export function pathwayEventState(event:JourneyEvent,revision:number|null,date:string) {
 if(event.status==='processing')return 'checking';
 if(event.status==='uncertain')return 'uncertain';
 if(event.status==='not_sent')return 'failed';
 if(!event.discovery)return 'unavailable';
 if(isJourneyStale(event,revision,date))return 'stale';
 return 'current';
}
