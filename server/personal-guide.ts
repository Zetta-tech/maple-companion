import { z } from 'zod';
import { emptyPersonalIntake,personalIntakeSchema,personalProfileSchema,type PersonalGuideSnapshot,type PersonalProfile,type GuideProfile } from '../shared/personal-guide.js';
import { DemoJourney } from './demo-journey.js';
import type { DemoStore } from './demo-store.js';
import type { DemoMemory } from './demo-memory.js';
import type { GuideSources } from './guide-sources.js';
import type { Workflow } from './workflow.js';
import { AppError } from './errors.js';

const reviewNeeded=()=>new AppError(409,'GUIDE_INPUT_REVIEW_REQUIRED','Review the current employment and assessment inputs before continuing.');
const answer=(value:unknown):'yes'|'no'|'unknown'=>value==='yes'||value==='no'?value:'unknown';

/** AM holds a receipt-bound assessment snapshot. Employment has only one editable source: Workflow. */
export class PersonalGuide {
  readonly engine:DemoJourney;
  readonly store:DemoStore;
  constructor(store:DemoStore,memory:DemoMemory,sources:Pick<GuideSources,'retrieve'>,
    private workflow:Workflow,private nativeReviewed:(owner:string)=>Promise<boolean>,
    evidence:(id:string,data:unknown,owner:string)=>void|Promise<void>,now=()=>new Date()) {
    this.store=store;
    this.engine=new DemoJourney(store,memory,sources,evidence,now,'maple-personal-assessment',(owner,profile)=>this.current(owner,profile));
  }
  private async current(owner:string,profile:GuideProfile):Promise<boolean>{
    if(profile.fictional||!(await this.nativeReviewed(owner)))return false;
    // Final consistent fence is after the awaited conversation-review check.
    const fence=await this.workflow.journal.assessmentFence(owner);
    return !fence.active&&fence.revision===profile.employmentBasis.revision&&fence.receipt?.digest===profile.employmentBasis.receiptDigest;
  }
  async profile(owner:string):Promise<PersonalGuideSnapshot>{
    const saved=await this.engine.profile(owner);
    if(saved.profile?.fictional)throw reviewNeeded();
    const head=await this.workflow.journal.assessmentFence(owner);
    const profile=saved.profile as PersonalProfile|null;
    // Read output is useful even when stale, but is never labelled current.
    const reviewRequired=!!saved.reviewRequired||head.active||!!profile&&(profile.employmentBasis.revision!==head.revision||profile.employmentBasis.receiptDigest!==head.receipt?.digest);
    return {revision:saved.revision,profile,verified:saved.verified,reviewRequired,
      intake:profile?personalIntakeSchema.parse(Object.fromEntries(Object.keys(personalIntakeSchema.shape).map(k=>[k,(profile as unknown as Record<string,unknown>)[k]]))):structuredClone(emptyPersonalIntake),employmentRevision:head.revision};
  }
  async propose(owner:string,body:unknown){
    const input=z.strictObject({baseRevision:z.number().int().nonnegative(),employmentRevision:z.number().int().positive(),intake:personalIntakeSchema}).parse(body);
    if(!(await this.nativeReviewed(owner)))throw reviewNeeded();
    const saved=await this.workflow.read(owner);const fence=await this.workflow.journal.assessmentFence(owner);
    if(!saved.employment||!fence.receipt||fence.active||saved.revision!==input.employmentRevision||fence.revision!==saved.revision)throw reviewNeeded();
    const e=saved.employment,c=e.cecWork;
    if(input.intake.crsEvidence&&input.intake.crsEvidence.canadianWorkEnd!==e.endDate)throw new AppError(400,'GUIDE_EVIDENCE_CONFLICT','The CRS work end date must match the confirmed employment interval.');
    if(c?.canadianEmployer==='no'&&input.intake.crsEvidence?.canadianEmployer==='yes')throw new AppError(400,'GUIDE_EVIDENCE_CONFLICT','The Canadian-employer answers conflict. Review the employment evidence.');
    const intervalComplete=!!c&&c.singleIntervalComplete==='yes'&&c.conditionsConsistent==='yes'
      &&c.canadianEmployer==='yes'&&c.nocDutiesMatch==='yes'&&c.nocEssentialDutiesMatch==='yes'
      &&!(e.paid==='no'&&c.paid==='yes')&&!(e.authorizedToWork==='no'&&c.authorizedTemporaryResident==='yes')
      &&(c.ongoing?e.currentJob&&c.hoursPerWeek===e.hoursPerWeek:!e.currentJob&&c.endDate===e.endDate)
      &&c.startDate===e.startDate;
    const profile=personalProfileSchema.parse({...input.intake,inputPurpose:'reviewed-assessment-inputs',
      employmentBasis:{revision:saved.revision,receiptDigest:fence.receipt.digest},
      employer:e.employer,jobTitle:e.title,workStart:e.startDate,weeklyHours:e.hoursPerWeek,noc:e.nocCode,duties:e.duties,nocReviewed:e.nocReviewed,
      physicallyCanada:answer(c?.physicallyInCanada),authorizedWork:answer(c?.authorizedTemporaryResident),
      paidEmployee:c?.paid==='yes'&&c.relationship==='employee'?'yes':c?.paid==='no'||c?.relationship==='self_employed'?'no':'unknown',
      fullTimeStudy:answer(c?.fullTimeStudy),selfEmployed:c?.relationship==='employee'?'no':c?.relationship==='self_employed'?'yes':'unknown',intervalComplete,
    });
    return this.engine.propose(owner,{baseRevision:input.baseRevision,profile});
  }
  confirm(owner:string,id:string,body:unknown){return this.engine.confirm(owner,id,body);}
  discover(owner:string,body:unknown,onDispatch=()=>{}){return this.engine.discover(owner,body,onDispatch);}
  replay(owner:string,body:unknown,onDispatch=()=>{}){return this.engine.replay(owner,body,onDispatch);}
  history(owner:string){return this.engine.history(owner);}
}
