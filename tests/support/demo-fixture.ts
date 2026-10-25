import { randomUUID } from 'node:crypto';
import type { DemoStore, DemoHead, DemoProposal } from '../../server/demo-store.js';
import { demoDigest, type DemoEnvelope, type DemoMemory } from '../../server/demo-memory.js';
import { AppError } from '../../server/errors.js';
import type { DemoProfile, DemoReceipt, JourneyEvent } from '../../shared/demo.js';

/** Offline test adapter only. No SDK, credentials, network or database connection. */
export class DemoFixtureStore implements DemoStore {
  heads = new Map<string, DemoHead>();
  operations = new Map<string, DemoProposal>();
  recorded = new Map<string, {digest:string; event:JourneyEvent}>();
  private key(owner:string,id:string) { return JSON.stringify([owner,id]); }
  private conflict() { return new AppError(409,'DEMO_REVIEW_REQUIRED','Refresh and review the unfinished fixture request.'); }
  async head(owner:string) { return structuredClone(this.heads.get(owner) ?? {revision:0,receipt:null}); }
  async proposals(owner:string) { return [...this.operations].filter(([k,p])=>JSON.parse(k)[0]===owner&&['pending','applying','uncertain'].includes(p.status)).map(([,p])=>structuredClone(p)); }
  async proposal(owner:string,id:string) { const p=this.operations.get(this.key(owner,id));if(!p)throw new AppError(404,'DEMO_RECORD_NOT_FOUND','Not found');return structuredClone(p); }
  async propose(owner:string,revision:number,profile:DemoProfile) {
    if((this.heads.get(owner)?.revision??0)!==revision||[...this.operations].some(([k,p])=>JSON.parse(k)[0]===owner&&['pending','applying','uncertain'].includes(p.status)))throw this.conflict();
    const p:DemoProposal={id:randomUUID(),baseRevision:revision,status:'pending',profile:structuredClone(profile),createdAt:new Date().toISOString(),confirmedAt:null,digest:demoDigest(profile)};
    this.operations.set(this.key(owner,p.id),p);return structuredClone(p);
  }
  async claim(owner:string,id:string) { const p=await this.proposal(owner,id);if(p.status==='committed')return p;if(p.status!=='pending'||p.baseRevision!==(await this.head(owner)).revision||!p.profile||demoDigest(p.profile)!==p.digest)throw this.conflict();p.status='applying';p.confirmedAt=new Date().toISOString();this.operations.set(this.key(owner,id),p);return structuredClone(p); }
  async complete(owner:string,id:string,receipt:DemoReceipt) {const p=await this.proposal(owner,id);if(!['applying','uncertain'].includes(p.status))throw this.conflict();this.heads.set(owner,{revision:p.baseRevision+1,receipt});p.status='committed';p.profile=null;this.operations.set(this.key(owner,id),p);}
  async uncertain(owner:string,id:string) {const p=await this.proposal(owner,id);if(p.status==='applying'){p.status='uncertain';this.operations.set(this.key(owner,id),p);}}
  async reject(owner:string,id:string) {const p=await this.proposal(owner,id);if(p.status!=='pending')throw this.conflict();p.status='rejected';p.profile=null;this.operations.set(this.key(owner,id),p);}
  async claimEvent(owner:string,id:string,digest:string,revision:number) {
    const k=this.key(owner,id),existing=this.recorded.get(k);if(existing){if(existing.digest!==digest||existing.event.status==='processing')throw this.conflict();return structuredClone(existing.event);}
    if((await this.head(owner)).revision!==revision||(await this.events(owner)).some(e=>['processing','uncertain'].includes(e.status)))throw this.conflict();
    this.recorded.set(k,{digest,event:{id,kind:'discovery',createdAt:new Date().toISOString(),status:'processing',profileRevision:revision}});return null;
  }
  async finishEvent(owner:string,event:JourneyEvent) {const current=this.recorded.get(this.key(owner,event.id));if(!current||current.event.status!=='processing')throw this.conflict();current.event=structuredClone(event);}
  async events(owner:string) {return [...this.recorded].filter(([k])=>JSON.parse(k)[0]===owner).map(([,r])=>structuredClone(r.event)).reverse();}
}
export class DemoFixtureMemory implements DemoMemory {
  envelopes=new Map<string,DemoEnvelope>(); writes=0; explanations=0; failExplanation=false;
  async read(owner:string,receipt:DemoReceipt) {const e=this.envelopes.get(owner);if(!e||demoDigest(e)!==receipt.digest)throw new AppError(503,'DEMO_MEMORY_UNVERIFIED','Fixture readback mismatch');return structuredClone(e);}
  async write(owner:string,envelope:DemoEnvelope) {if(envelope.ownerId!==owner)throw Error('fixture owner mismatch');this.writes++;this.envelopes.set(owner,structuredClone(envelope));return {factId:'offline-fixture-'+envelope.operationId,digest:demoDigest(envelope)};}
  async explain(_owner:string,_requestId:string,message:string):ReturnType<DemoMemory['explain']> {this.explanations++;if(this.failExplanation)throw new AppError(503,'GUIDE_RESPONSE_UNCERTAIN','Offline fixture simulates an unverified response.');const status=JSON.parse(message.split('CONDITION CHECKS (not an eligibility decision):\n')[1]!.split('\n\nOFFICIAL SOURCE MATERIAL:')[0]!).status;return {reply:JSON.stringify({assessmentStatus:status,sourceUrls:['https://www.canada.ca/'],explanation:'OFFLINE UI FIXTURE: this text verifies presentation only. It is not an AM-generated finding.'}),sessionId:'offline-fixture',traceId:'offline-fixture',raw:{offlineFixture:true}};}
}
export const fixtureSources={async retrieve(){return {evidence:[{id:'offline',title:'Offline source fixture — not live retrieval',url:'https://www.canada.ca/',bodySha256:'a'.repeat(64),retrievedAt:new Date().toISOString(),reviewedAt:new Date().toISOString()}],context:'OFFLINE TEST DATA: no official source fetch occurs.'};}};
