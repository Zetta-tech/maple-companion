import {createHash,randomUUID} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {createDemoMemory,demoDigest,type DemoEnvelope} from '../server/demo-memory.js';
import {demoSeed} from '../shared/demo.js';
import {fictionalCrsEvidence} from '../shared/crs.js';
import {emptyPersonalIntake,personalProfileSchema} from '../shared/personal-guide.js';
const owner='user_TestDemo';const entity='maple-demo-'+createHash('sha256').update(owner).digest('hex');
const binding={ownerId:owner,endpoint:'https://fictional.example.test',context:'test',nativePrincipalId:'principalTest',readKey:'fixture-read',writeKey:'fixture-write'};
describe('real SDK demo boundary with explicit test transport',()=>{
  it('marks a failed pre-read as not started and makes no provider POST',async()=>{
    const methods:string[]=[];const memory=createDemoMemory(()=>binding,async(_input,init)=>{methods.push(init?.method??'GET');throw Error('GET failed');});
    const envelope:DemoEnvelope={schema:1,purpose:'maple-fictional-demo',ownerId:owner,revision:1,operationId:randomUUID(),previousFactId:null,confirmedAt:'2026-10-25T12:00:00Z',profile:demoSeed};
    await expect(memory.write(owner,envelope)).rejects.toMatchObject({code:'GUIDE_WRITE_NOT_STARTED'});expect(methods).toEqual(['GET']);
  });
  it.each(['write response','readback'] as const)('finds the exact operation after a lost %s using GET only, never retries the write',async failure=>{
    const envelope:DemoEnvelope={schema:1,purpose:'maple-fictional-demo',ownerId:owner,revision:1,operationId:randomUUID(),previousFactId:null,confirmedAt:'2026-10-25T12:00:00Z',profile:demoSeed};
    let row:Record<string,unknown>|null=null,posts=0,failRead=true;
    const memory=createDemoMemory(()=>binding,async(input,init)=>{
      if(String(input).includes('/attributes')){
        if(row&&failure==='readback'&&failRead){failRead=false;throw Error('GET interrupted');}
        return Response.json({attributes:row?[row]:[],page:{hasMore:false,nextCursor:null}});
      }
      posts++;const body=JSON.parse(String(init?.body));row={id:'exact-fact',entity:'entity:person/'+entity,key:'demo_profile',value:body.triples[0].value,memoryCategory:'identity',scope:[['maple/approved/']],supersedes:null};
      if(failure==='write response')throw Error('POST response interrupted');
      return Response.json({mode:'triples',preview:false,extraction:{attributes:[row]}});
    });
    await expect(memory.write(owner,envelope)).rejects.toMatchObject({code:'DEMO_WRITE_UNCERTAIN'});
    expect(await memory.reconcile(owner,envelope)).toEqual({factId:'exact-fact',digest:demoDigest(envelope)});
    expect(await memory.reconcile(owner,{...envelope,operationId:randomUUID()})).toBeNull();
    expect(await memory.reconcile(owner,{...envelope,profile:{...demoSeed,weeklyHours:29}})).toBeNull();
    row!.scope=[['different/scope']];await expect(memory.reconcile(owner,envelope)).rejects.toMatchObject({code:'DEMO_MEMORY_UNVERIFIED'});
    expect(posts).toBe(1);
  });
  it('separates personal assessment attributes and purposes from demo and canonical employment',async()=>{
    const profile=personalProfileSchema.parse({...demoSeed,...emptyPersonalIntake,inputPurpose:'reviewed-assessment-inputs',employmentBasis:{revision:1,receiptDigest:'a'.repeat(64)},intervalComplete:false});
    const envelope:DemoEnvelope={schema:1,purpose:'maple-personal-assessment',ownerId:owner,revision:1,operationId:randomUUID(),previousFactId:null,confirmedAt:'2026-10-25T12:00:00Z',profile};
    let row:Record<string,unknown>|null=null,posts=0;
    const personalEntity='maple-assessment-'+createHash('sha256').update(owner).digest('hex');
    const memory=createDemoMemory(()=>binding,async(input,init)=>{
      const url=new URL(String(input));
      if(url.pathname.endsWith('/attributes')){expect(url.searchParams.get('key')).toBe('assessment_inputs');return Response.json({attributes:row?[row]:[],page:{hasMore:false,nextCursor:null}});}
      posts++;const body=JSON.parse(String(init?.body));expect(body.infer).toBe('triples');expect(body.triples[0].key).toBe('assessment_inputs');expect(body.triples[0].entity.name).toBe(personalEntity);
      row={id:'personal-fixture',entity:'entity:person/'+personalEntity,key:'assessment_inputs',value:body.triples[0].value,memoryCategory:'identity',scope:[['maple/approved/']],supersedes:null};
      return Response.json({mode:'triples',preview:false,extraction:{attributes:[row],uncertainties:[],instructions:[],relations:[],actions:[]}});
    },'maple-personal-assessment');
    await expect(memory.write(owner,{...envelope,purpose:'maple-fictional-demo'})).rejects.toBeDefined();expect(posts).toBe(0);
    expect(await memory.read(owner,await memory.write(owner,envelope))).toEqual(envelope);expect(posts).toBe(1);
  });
  it.each(['legacy','complete CRS'] as const)('writes the confirmed %s profile and verifies the SDK receipt without touching employment_record',async variant=>{
    let row:Record<string,unknown>|null=null;const requests:{method:string;path:string;body:unknown}[]=[];
    const crsEvidence=fictionalCrsEvidence('2026-10-25');crsEvidence.completeEvidenceReviewed='yes';
    const envelope:DemoEnvelope={schema:1,purpose:'maple-fictional-demo',ownerId:owner,revision:1,operationId:randomUUID(),previousFactId:null,confirmedAt:'2026-10-25T12:00:00Z',profile:variant==='legacy'?demoSeed:{...demoSeed,crsEvidence}};
    const transport:typeof fetch=async(input,init)=>{
      const url=new URL(String(input));const body=init?.body?JSON.parse(String(init.body)):null;requests.push({method:init?.method??'GET',path:url.pathname,body});
      if(url.pathname.endsWith('/attributes'))return Response.json({attributes:row?[row]:[],page:{hasMore:false,nextCursor:null}});
      expect(url.pathname).toBe('/api/v1/test/facts');expect(body.infer).toBe('triples');expect(body.triples[0].entity).toEqual({type:'person',name:entity});
      row={id:'fixture-fact',entity:'entity:person/'+entity,key:'demo_profile',value:body.triples[0].value,memoryCategory:'identity',scope:[['maple/approved/']],supersedes:null};
      return Response.json({mode:'triples',preview:false,sessionId:'fixture-session',extraction:{attributes:[row],uncertainties:[],instructions:[],relations:[],actions:[]}});
    };
    const memory=createDemoMemory(o=>{expect(o).toBe(owner);return binding;},transport);
    const receipt=await memory.write(owner,envelope);expect(receipt.digest).toBe(demoDigest(envelope));expect(await memory.read(owner,receipt)).toEqual(envelope);
    expect(JSON.stringify(requests)).not.toContain('employment_record');expect(requests.filter(r=>r.method==='POST')).toHaveLength(1);
    await expect(memory.read(owner,{...receipt,digest:'wrong'})).rejects.toMatchObject({code:'DEMO_MEMORY_UNVERIFIED'});
  });
  it('does not transmit with a mismatched bound owner',async()=>{
    const memory=createDemoMemory(()=>binding,async()=>{throw Error('Must not transmit');});
    await expect(memory.read('user_Other',{factId:'x',digest:'x'})).rejects.toMatchObject({code:'DEMO_MEMORY_UNVERIFIED'});
  });
  it('requires verified principal before native hosted chat and preserves the message',async()=>{
    const seen:string[]=[];const memory=createDemoMemory(()=>binding,async(input,init)=>{
      const url=new URL(String(input));seen.push(url.pathname);
      if(url.pathname.endsWith('/me'))return Response.json({principalId:'principalTest'});
      const body=JSON.parse(String(init?.body));expect(body.message).toBe('Unchanged synthetic question');expect(body.scopes).toEqual([['maple/conversation']]);
      return Response.json({reply:'Synthetic answer',sessionId:'session',traceId:'trace',memoryUpdates:{}});
    });
    expect((await memory.explain(owner,randomUUID(),'Unchanged synthetic question')).reply).toBe('Synthetic answer');expect(seen).toEqual(['/api/v1/test/me','/api/v1/test/chat']);
  });
  it('distinguishes read-only identity failure from a chat POST with unknown outcome',async()=>{
    const methods:string[]=[];const memory=createDemoMemory(()=>binding,async(_input,init)=>{methods.push(init?.method??'GET');throw Error('fixture network failure');});
    await expect(memory.explain(owner,randomUUID(),'fictional question')).rejects.toMatchObject({code:'GUIDE_NOT_SENT'});expect(methods).toEqual(['GET']);
    const afterPost=createDemoMemory(()=>binding,async(input)=>{if(String(input).endsWith('/me'))return Response.json({principalId:'principalTest'});throw Error('POST response lost');});
    await expect(afterPost.explain(owner,randomUUID(),'fictional question')).rejects.toMatchObject({code:'GUIDE_RESPONSE_UNCERTAIN'});
  });
});
