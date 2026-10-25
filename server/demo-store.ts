import { createHash,randomUUID } from 'node:crypto';
import { RecordId,type Surreal } from 'surrealdb';
import { AppError } from './errors.js';
import { type DemoReceipt,type JourneyEvent } from '../shared/demo.js';
import { guideProfileSchema,type GuideProfile,type GuidePurpose } from '../shared/personal-guide.js';
import { demoDigest } from './demo-memory.js';

export type DemoHead={revision:number;receipt:DemoReceipt|null};
export type DemoProposal={id:string;baseRevision:number;status:string;profile:GuideProfile|null;createdAt:string;confirmedAt:string|null;digest:string};
const key=(table:string,owner:string,id=owner)=>new RecordId(table,createHash('sha256').update(JSON.stringify([owner,id])).digest('hex'));
const missing=()=>new AppError(404,'DEMO_RECORD_NOT_FOUND','This record was not found.');
const conflict=()=>new AppError(409,'DEMO_REVIEW_REQUIRED','The information changed or has an unfinished request. Refresh and review its status before continuing.');
export interface DemoStore {
  head(owner:string):Promise<DemoHead>; proposals(owner:string):Promise<DemoProposal[]>; proposal(owner:string,id:string):Promise<DemoProposal>;
  propose(owner:string,revision:number,profile:GuideProfile):Promise<DemoProposal>; claim(owner:string,id:string):Promise<DemoProposal>;
  complete(owner:string,id:string,receipt:DemoReceipt):Promise<void>; uncertain(owner:string,id:string):Promise<void>;
  releaseNotStarted(owner:string,id:string):Promise<void>;
  reject(owner:string,id:string):Promise<void>;
  claimEvent(owner:string,id:string,digest:string,revision:number):Promise<JourneyEvent|null>; finishEvent(owner:string,event:JourneyEvent):Promise<void>;
  events(owner:string):Promise<JourneyEvent[]>;
}
export class SurrealDemoStore implements DemoStore {
  constructor(private db:Surreal,private purpose:GuidePurpose='maple-fictional-demo'){}
  private sql(text:string){return this.purpose==='maple-fictional-demo'?text:text.replaceAll('maple_demo_','maple_guide_').replaceAll('demo_journey_v1','personal_guide_v1');}
  private key(table:string,owner:string,id=owner){return key(this.sql(table),owner,id);}
  async ready(){const [r]=await this.db.query<[{version:number}[]]>(this.sql('SELECT version FROM maple_schema:demo_journey_v1;')).retry(false);if(r[0]?.version!==1)throw new AppError(503,'DEMO_SCHEMA_REQUIRED','The demonstration storage setup is not ready.');}
  async head(owner:string):Promise<DemoHead>{const [r]=await this.db.query<[{revision:number;receipt_json:string|null}[]]>(this.sql('SELECT revision,receipt_json FROM maple_demo_heads WHERE owner=$owner;'),{owner}).retry(false);return r[0]?{revision:r[0].revision,receipt:r[0].receipt_json?JSON.parse(r[0].receipt_json):null}:{revision:0,receipt:null};}
  private parse(row:Record<string,unknown>):DemoProposal{return {id:row.key as string,baseRevision:row.base_revision as number,status:row.status as string,profile:row.profile_json?guideProfileSchema.parse(JSON.parse(row.profile_json as string)):null,createdAt:row.created_at as string,confirmedAt:row.confirmed_at as string|null,digest:row.digest as string};}
  async proposals(owner:string){const [r]=await this.db.query<[Record<string,unknown>[]]>(this.sql("SELECT * FROM maple_demo_proposals WHERE owner=$owner AND status IN ['pending','applying','uncertain'] ORDER BY created_at DESC;"),{owner}).retry(false);return r.map(x=>this.parse(x));}
  async proposal(owner:string,id:string){const [r]=await this.db.query<[Record<string,unknown>[]]>(this.sql('SELECT * FROM maple_demo_proposals WHERE owner=$owner AND key=$id;'),{owner,id}).retry(false);if(!r[0])throw missing();return this.parse(r[0]);}
  private async atomic<T>(owner:string,run:(tx:Awaited<ReturnType<Surreal['beginTransaction']>>)=>Promise<T>):Promise<T>{
    const tx=await this.db.beginTransaction();try{
      await tx.query(this.sql('UPSERT $record SET owner=$owner,revision=revision??0,receipt_json=receipt_json??NULL,epoch=(epoch??0)+1;'),{record:this.key('maple_demo_heads',owner),owner}).retry(false);
      const result=await run(tx);await tx.commit();return result;
    }catch(error){try{await tx.cancel();}catch{/* uncertain outcome is not a rollback guarantee */}if(error instanceof AppError)throw error;throw new AppError(503,'DEMO_TRANSACTION_UNVERIFIED','The demo operation could not be verified. Refresh its status before trying again.');}
  }
  async propose(owner:string,revision:number,profile:GuideProfile){const id=randomUUID(),createdAt=new Date().toISOString();await this.atomic(owner,async tx=>{
    const [heads,active]=await tx.query<[{revision:number}[],unknown[]]>(this.sql("SELECT revision FROM maple_demo_heads WHERE owner=$owner; SELECT key FROM maple_demo_proposals WHERE owner=$owner AND status IN ['pending','applying','uncertain'];"),{owner}).retry(false);
    if(heads[0]?.revision!==revision||active.length)throw conflict();
    await tx.query(this.sql('CREATE $record CONTENT $data;'),{record:this.key('maple_demo_proposals',owner,id),data:{owner,key:id,status:'pending',base_revision:revision,profile_json:JSON.stringify(profile),digest:demoDigest(profile),created_at:createdAt,confirmed_at:null,receipt_json:null}}).retry(false);
  });return this.proposal(owner,id);}
  async claim(owner:string,id:string){await this.atomic(owner,async tx=>{
    const [rows,heads,active]=await tx.query<[Record<string,unknown>[],{revision:number}[],unknown[]]>(this.sql("SELECT * FROM maple_demo_proposals WHERE owner=$owner AND key=$id; SELECT revision FROM maple_demo_heads WHERE owner=$owner; SELECT key FROM maple_demo_proposals WHERE owner=$owner AND status IN ['applying','uncertain'];"),{owner,id}).retry(false);
    if(!rows[0])throw missing();const op=this.parse(rows[0]);if(op.status==='committed')return;
    if(op.status!=='pending'||op.baseRevision!==heads[0]?.revision||active.length||!op.profile||demoDigest(op.profile)!==op.digest)throw conflict();
    await tx.query(this.sql("UPDATE $record SET status='applying',confirmed_at=$now WHERE owner=$owner;"),{record:this.key('maple_demo_proposals',owner,id),owner,now:new Date().toISOString()}).retry(false);
  });return this.proposal(owner,id);}
  async complete(owner:string,id:string,receipt:DemoReceipt){await this.atomic(owner,async tx=>{
    const [rows,heads]=await tx.query<[Record<string,unknown>[],{revision:number}[]]>(this.sql('SELECT * FROM maple_demo_proposals WHERE owner=$owner AND key=$id; SELECT revision FROM maple_demo_heads WHERE owner=$owner;'),{owner,id}).retry(false);
    if(!rows[0])throw missing();const op=this.parse(rows[0]);if(op.status==='committed')return;
    if(!['applying','uncertain'].includes(op.status)||heads[0]?.revision!==op.baseRevision)throw conflict();
    await tx.query(this.sql("UPDATE $head SET revision=$revision,receipt_json=$receipt WHERE owner=$owner; UPDATE $proposal SET status='committed',receipt_json=$receipt,profile_json=NULL WHERE owner=$owner;"),{head:this.key('maple_demo_heads',owner),proposal:this.key('maple_demo_proposals',owner,id),owner,revision:op.baseRevision+1,receipt:JSON.stringify(receipt)}).retry(false);
  });}
  async uncertain(owner:string,id:string){await this.db.query(this.sql("UPDATE $record SET status='uncertain' WHERE owner=$owner AND status='applying';"),{record:this.key('maple_demo_proposals',owner,id),owner}).retry(false);}
  async releaseNotStarted(owner:string,id:string){await this.atomic(owner,async tx=>{
    const [r]=await tx.query<[unknown[]]>(this.sql("UPDATE $record SET status='pending',confirmed_at=NULL WHERE owner=$owner AND status='applying' RETURN AFTER;"),{record:this.key('maple_demo_proposals',owner,id),owner}).retry(false);
    if(!r.length)throw conflict();
  });}
  async reject(owner:string,id:string){await this.atomic(owner,async tx=>{const [r]=await tx.query<[{status:string}[]]>(this.sql('SELECT status FROM maple_demo_proposals WHERE owner=$owner AND key=$id;'),{owner,id}).retry(false);if(!r[0])throw missing();if(r[0].status!=='pending')throw conflict();await tx.query(this.sql("UPDATE $record SET status='rejected',profile_json=NULL WHERE owner=$owner;"),{record:this.key('maple_demo_proposals',owner,id),owner}).retry(false);});}
  async claimEvent(owner:string,id:string,digest:string,revision:number):Promise<JourneyEvent|null>{return this.atomic(owner,async tx=>{
    const [existing,heads,active]=await tx.query<[{digest:string;status:string;result_json:string|null}[],{revision:number}[],unknown[]]>(this.sql("SELECT digest,status,result_json FROM maple_demo_events WHERE owner=$owner AND key=$id; SELECT revision FROM maple_demo_heads WHERE owner=$owner; SELECT key FROM maple_demo_events WHERE owner=$owner AND status IN ['processing','uncertain'];"),{owner,id}).retry(false);
    if(existing[0]){if(existing[0].digest!==digest)throw conflict();if(existing[0].result_json)return JSON.parse(existing[0].result_json);throw conflict();}
    if(heads[0]?.revision!==revision||active.length)throw conflict();
    await tx.query(this.sql('CREATE $record CONTENT $data;'),{record:this.key('maple_demo_events',owner,id),data:{owner,key:id,digest,status:'processing',profile_revision:revision,created_at:new Date().toISOString(),result_json:null}}).retry(false);return null;
  });}
  async finishEvent(owner:string,event:JourneyEvent){const [r]=await this.db.query<[unknown[]]>(this.sql("UPDATE $record SET status=$status,result_json=$result WHERE owner=$owner AND status='processing' RETURN AFTER;"),{record:this.key('maple_demo_events',owner,event.id),owner,status:event.status,result:JSON.stringify(event)}).retry(false);if(!r.length)throw conflict();}
  async events(owner:string){const [rows]=await this.db.query<[{key:string;status:string;profile_revision:number;created_at:string;result_json:string|null}[]]>(this.sql('SELECT key,status,profile_revision,created_at,result_json FROM maple_demo_events WHERE owner=$owner ORDER BY created_at DESC;'),{owner}).retry(false);return rows.map(r=>r.result_json?JSON.parse(r.result_json) as JourneyEvent:{id:r.key,kind:'discovery' as const,status:r.status as JourneyEvent['status'],profileRevision:r.profile_revision,createdAt:r.created_at});}
}
