import { createHash } from 'node:crypto';
import { AgentMemory } from '@surrealdb/memory';
import { z } from 'zod';
import type { Binding } from './am.js';
import { AppError } from './errors.js';
import { type DemoReceipt } from '../shared/demo.js';
import { guideProfileSchema, type GuidePurpose } from '../shared/personal-guide.js';

const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const envelopeSchema=z.strictObject({schema:z.literal(1),ownerId:z.string(),purpose:z.enum(['maple-fictional-demo','maple-personal-assessment']),revision:z.number().int().positive(),operationId:z.uuid(),previousFactId:z.string().nullable(),confirmedAt:z.iso.datetime(),profile:guideProfileSchema}).refine(e => e.profile.fictional === (e.purpose === 'maple-fictional-demo'));
export type DemoEnvelope=z.infer<typeof envelopeSchema>;
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const demoDigest=(value:unknown):string=>hash(canonical(value));
export interface DemoMemory {
  read(owner:string,receipt:DemoReceipt):Promise<DemoEnvelope>;
  write(owner:string,envelope:DemoEnvelope):Promise<DemoReceipt>;
  reconcile(owner:string,envelope:DemoEnvelope):Promise<DemoReceipt|null>;
  explain(owner:string,requestId:string,message:string):Promise<{reply:string;sessionId:string;traceId:string;raw:unknown}>;
}
const unavailable=()=>new AppError(503,'DEMO_MEMORY_UNVERIFIED','Your reviewed information could not be verified in memory. Check its status before relying on it.');
/** Constructed only while the transport proves no facts POST was dispatched. */
export class GuideWriteNotStarted extends AppError {
  constructor(){super(503,'GUIDE_WRITE_NOT_STARTED','Your save was not sent. You can try confirming the same reviewed change again.');}
}

/** One separate fictional entity. Never reads/writes the employment_record entity. */
export function createDemoMemory(resolve:(owner:string)=>Binding,transport:typeof fetch=fetch,purpose:GuidePurpose='maple-fictional-demo'):DemoMemory {
  const fictional=purpose==='maple-fictional-demo';
  const attributeKey=fictional?'demo_profile':'assessment_inputs';
  function binding(owner:string) {
    const b=resolve(owner);
    if(b.ownerId!==owner || !b.nativePrincipalId || !/^user_[a-zA-Z0-9]+$/.test(owner))throw unavailable();
    return b;
  }
  const name=(owner:string)=>`${fictional?'maple-demo':'maple-assessment'}-${hash(owner)}`;
  function client(owner:string,write=false,operationId?:string,onPost=()=>{}) {
    const b=binding(owner); const prefix=`/api/v1/${b.context}/`;
    return new AgentMemory({endpoint:b.endpoint,context:b.context,apiKey:write?b.writeKey:b.readKey,maxRetries:0,timeoutMs:45_000,
      fetchImpl:async(input,init)=>{
        const url=new URL(input instanceof Request?input.url:String(input));const method=init?.method??'GET';
        const resource=url.pathname.slice(prefix.length);
        const allowed=method==='GET'&&['attributes','me'].includes(resource)||write&&method==='POST'&&['facts','chat'].includes(resource);
        if(url.origin!==b.endpoint||!url.pathname.startsWith(prefix)||!allowed)throw unavailable();
        const headers=new Headers(init?.headers);
        if(method==='POST') {if(!operationId)throw unavailable();headers.set('Idempotency-Key',`maple-guide-${hash(JSON.stringify([purpose,owner,b.context,resource,operationId]))}`);}
        if(method==='POST')onPost();
        return transport(input,{...init,headers,redirect:'error'});
      }});
  }
  async function rows(owner:string) {
    const result=await client(owner).facts.attributes({entity:`person/${name(owner)}`,key:attributeKey,limit:100});
    if(result.page.hasMore||result.attributes.length>1)throw unavailable();
    return result.attributes;
  }
  function verifyRow(owner:string,row:Awaited<ReturnType<typeof rows>>[number]|undefined,receipt:DemoReceipt) {
    if(!row||row.id!==receipt.factId||row.entity!==`entity:person/${name(owner)}`||row.key!==attributeKey||row.memoryCategory!=='identity'||row.supersededBy||row.validUntil
      ||JSON.stringify(row.scope.map(s=>s.map(v=>v.replace(/\/$/,''))))!==JSON.stringify([['maple/approved']]))throw unavailable();
    let envelope:DemoEnvelope;
    try {envelope=envelopeSchema.parse(JSON.parse(row.value));}catch{throw unavailable();}
    if(envelope.ownerId!==owner||envelope.purpose!==purpose||demoDigest(envelope)!==receipt.digest||(row.supersedes??null)!==envelope.previousFactId)throw unavailable();
    return envelope;
  }
  async function read(owner:string,receipt:DemoReceipt) {return verifyRow(owner,(await rows(owner))[0],receipt);}
  return {read,
    async reconcile(owner,input) {
      const envelope=envelopeSchema.parse(input);if(envelope.ownerId!==owner||envelope.purpose!==purpose)throw unavailable();
      const row=(await rows(owner))[0];if(!row)return null;
      // Absence or another current operation is not evidence that a POST never happened.
      let stored:DemoEnvelope;try{stored=envelopeSchema.parse(JSON.parse(row.value));}catch{throw unavailable();}
      if(stored.operationId!==envelope.operationId||demoDigest(stored)!==demoDigest(envelope))return null;
      const receipt={factId:row.id,digest:demoDigest(envelope)};verifyRow(owner,row,receipt);return receipt;
    },
    async write(owner,input) {
      let dispatched=false;
      try {
        const envelope=envelopeSchema.parse(input);if(envelope.ownerId!==owner||envelope.purpose!==purpose)throw unavailable();
        const before=await rows(owner);
        if(envelope.previousFactId===null ? before.length!==0 : before.length!==1||before[0]?.id!==envelope.previousFactId)throw unavailable();
        if(before[0]) { let previous:DemoEnvelope;try{previous=envelopeSchema.parse(JSON.parse(before[0].value));}catch{throw unavailable();}
          if(previous.ownerId!==owner||previous.purpose!==purpose||previous.revision!==envelope.revision-1)throw unavailable(); }
        const value=JSON.stringify(envelope);
        const result=await client(owner,true,envelope.operationId,()=>{dispatched=true;}).remember(undefined,{infer:'triples',scopes:[['maple/approved']],triples:[{
          entity:{type:'person',name:name(owner)},key:attributeKey,value,memory_category:'identity',source_clause:`Explicitly confirmed ${fictional?'fictional demo profile':'assessment inputs linked to the canonical employment receipt'} ${envelope.operationId}`,
        }]});
        const attr=result.extraction?.attributes[0];
        if(result.mode!=='triples'||result.preview||result.extraction?.attributes.length!==1||!attr||attr.value!==value||attr.key!==attributeKey)throw unavailable();
        const receipt={factId:attr.id,digest:demoDigest(envelope)};await read(owner,receipt);return receipt;
      }catch{if(!dispatched)throw new GuideWriteNotStarted();throw new AppError(503,'DEMO_WRITE_UNCERTAIN','This save may have reached memory but could not be verified. Check this operation’s status before continuing; it will not be sent again automatically.');}
    },
    async explain(owner,requestId,message) {
      let sdk:AgentMemory;
      try {
        const b=binding(owner);sdk=client(owner,true,requestId);
        const identity=await sdk.whoami();
        if(identity.principalId?.replace(/^principal:/,'')!==b.nativePrincipalId||identity.delegatedPrincipalId)throw unavailable();
      }catch { throw new AppError(503,'GUIDE_NOT_SENT','The guide could not verify its connection. No conversation request was sent. You may try again after checking the connection.'); }
      try {
        const result=await sdk.chat(message,{scopes:[['maple/conversation']],labels:[`maple=${fictional?'fictional_demo':'personal_guide'}`,'purpose=pathway_research'],suppressMarkers:true});
        if(!result.reply?.trim()||!result.sessionId||!result.traceId)throw unavailable();
        return {reply:result.reply,sessionId:result.sessionId,traceId:result.traceId,raw:result};
      }catch{throw new AppError(503,'GUIDE_RESPONSE_UNCERTAIN','The guide response could not be verified. Its request has been recorded; it will not be sent again automatically.');}
    }};
}
