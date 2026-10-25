import { createHash } from 'node:crypto';
import { AgentMemory } from '@surrealdb/memory';
import { z } from 'zod';
import type { Binding } from './am.js';
import { AppError } from './errors.js';
import { demoProfileSchema, type DemoProfile, type DemoReceipt } from '../shared/demo.js';

const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const envelopeSchema=z.strictObject({schema:z.literal(1),ownerId:z.string(),purpose:z.literal('maple-fictional-demo'),revision:z.number().int().positive(),operationId:z.uuid(),previousFactId:z.string().nullable(),confirmedAt:z.iso.datetime(),profile:demoProfileSchema});
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
  explain(owner:string,requestId:string,message:string):Promise<{reply:string;sessionId:string;traceId:string;raw:unknown}>;
}
const unavailable=()=>new AppError(503,'DEMO_MEMORY_UNVERIFIED','The demonstration profile could not be verified in memory. No saved-success claim is being made.');

/** One separate fictional entity. Never reads/writes the employment_record entity. */
export function createDemoMemory(resolve:(owner:string)=>Binding,transport:typeof fetch=fetch):DemoMemory {
  function binding(owner:string) {
    const b=resolve(owner);
    if(b.ownerId!==owner || !b.nativePrincipalId || !/^user_[a-zA-Z0-9]+$/.test(owner))throw unavailable();
    return b;
  }
  const name=(owner:string)=>`maple-demo-${hash(owner)}`;
  function client(owner:string,write=false,operationId?:string) {
    const b=binding(owner); const prefix=`/api/v1/${b.context}/`;
    return new AgentMemory({endpoint:b.endpoint,context:b.context,apiKey:write?b.writeKey:b.readKey,maxRetries:0,timeoutMs:45_000,
      fetchImpl:async(input,init)=>{
        const url=new URL(input instanceof Request?input.url:String(input));const method=init?.method??'GET';
        const resource=url.pathname.slice(prefix.length);
        const allowed=method==='GET'&&['attributes','me'].includes(resource)||write&&method==='POST'&&['facts','chat'].includes(resource);
        if(url.origin!==b.endpoint||!url.pathname.startsWith(prefix)||!allowed)throw unavailable();
        const headers=new Headers(init?.headers);
        if(method==='POST') {if(!operationId)throw unavailable();headers.set('Idempotency-Key',`maple-demo-${hash(JSON.stringify([owner,b.context,resource,operationId]))}`);}
        return transport(input,{...init,headers,redirect:'error'});
      }});
  }
  async function rows(owner:string) {
    const result=await client(owner).facts.attributes({entity:`person/${name(owner)}`,key:'demo_profile',limit:100});
    if(result.page.hasMore||result.attributes.length>1)throw unavailable();
    return result.attributes;
  }
  async function read(owner:string,receipt:DemoReceipt) {
    const list=await rows(owner);const row=list[0];
    if(!row||row.id!==receipt.factId||row.entity!==`entity:person/${name(owner)}`||row.key!=='demo_profile'||row.memoryCategory!=='identity'||row.supersededBy||row.validUntil
      ||JSON.stringify(row.scope.map(s=>s.map(v=>v.replace(/\/$/,''))))!==JSON.stringify([['maple/approved']]))throw unavailable();
    let envelope:DemoEnvelope;
    try {envelope=envelopeSchema.parse(JSON.parse(row.value));}catch{throw unavailable();}
    if(envelope.ownerId!==owner||demoDigest(envelope)!==receipt.digest||(row.supersedes??null)!==envelope.previousFactId)throw unavailable();
    return envelope;
  }
  return {read,
    async write(owner,input) {
      const envelope=envelopeSchema.parse(input);if(envelope.ownerId!==owner)throw unavailable();
      const before=await rows(owner);
      if(envelope.previousFactId===null ? before.length!==0 : before.length!==1||before[0]?.id!==envelope.previousFactId)throw unavailable();
      if(before[0]) { let previous:DemoEnvelope;try{previous=envelopeSchema.parse(JSON.parse(before[0].value));}catch{throw unavailable();}
        if(previous.ownerId!==owner||previous.revision!==envelope.revision-1)throw unavailable(); }
      const value=JSON.stringify(envelope);
      try {
        const result=await client(owner,true,envelope.operationId).remember(undefined,{infer:'triples',scopes:[['maple/approved']],triples:[{
          entity:{type:'person',name:name(owner)},key:'demo_profile',value,memory_category:'identity',source_clause:`Explicitly confirmed fictional demo profile ${envelope.operationId}`,
        }]});
        const attr=result.extraction?.attributes[0];
        if(result.mode!=='triples'||result.preview||result.extraction?.attributes.length!==1||!attr||attr.value!==value||attr.key!=='demo_profile')throw unavailable();
        const receipt={factId:attr.id,digest:demoDigest(envelope)};await read(owner,receipt);return receipt;
      }catch{throw new AppError(503,'DEMO_WRITE_UNCERTAIN','This demo save may have reached memory but could not be verified. Do not submit it again.');}
    },
    async explain(owner,requestId,message) {
      let sdk:AgentMemory;
      try {
        const b=binding(owner);sdk=client(owner,true,requestId);
        const identity=await sdk.whoami();
        if(identity.principalId?.replace(/^principal:/,'')!==b.nativePrincipalId||identity.delegatedPrincipalId)throw unavailable();
      }catch { throw new AppError(503,'GUIDE_NOT_SENT','The guide could not verify its connection. No conversation request was sent. You may try again after checking the connection.'); }
      try {
        const result=await sdk.chat(message,{scopes:[['maple/conversation']],labels:['maple=fictional_demo','purpose=pathway_research'],suppressMarkers:true});
        if(!result.reply?.trim()||!result.sessionId||!result.traceId)throw unavailable();
        return {reply:result.reply,sessionId:result.sessionId,traceId:result.traceId,raw:result};
      }catch{throw new AppError(503,'GUIDE_RESPONSE_UNCERTAIN','The guide response could not be verified. Its request has been recorded; it will not be sent again automatically.');}
    }};
}
