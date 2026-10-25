import {createHash,randomUUID} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {createDemoMemory,demoDigest,type DemoEnvelope} from '../server/demo-memory.js';
import {demoSeed} from '../shared/demo.js';
const owner='user_TestDemo';const entity='maple-demo-'+createHash('sha256').update(owner).digest('hex');
const binding={ownerId:owner,endpoint:'https://fictional.example.test',context:'test',nativePrincipalId:'principalTest',readKey:'fixture-read',writeKey:'fixture-write'};
describe('real SDK demo boundary with explicit test transport',()=>{
  it('writes only the confirmed dedicated entity and verifies receipt, without touching employment_record',async()=>{
    let row:Record<string,unknown>|null=null;const requests:{method:string;path:string;body:unknown}[]=[];
    const envelope:DemoEnvelope={schema:1,purpose:'maple-fictional-demo',ownerId:owner,revision:1,operationId:randomUUID(),previousFactId:null,confirmedAt:'2026-10-25T12:00:00Z',profile:demoSeed};
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
