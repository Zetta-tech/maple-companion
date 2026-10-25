import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {connectOperationalDatabase,loadDatabaseConfig} from '../server/operational-db.js';
import {SurrealDemoStore} from '../server/demo-store.js';
import {DemoJourney} from '../server/demo-journey.js';
import {demoDigest,type DemoEnvelope,type DemoMemory} from '../server/demo-memory.js';
import {demoSeed} from '../shared/demo.js';

it('uses real SurrealDB for exact demo approval, owner denial, restart history and deduplicated policy replay',async()=>{
  const db=await connectOperationalDatabase(loadDatabaseConfig('test'));const owner='user_demo'+randomUUID().replaceAll('-',''),other=owner+'other';
  let saved:DemoEnvelope|undefined,writes=0,guideCalls=0;
  // AM transport substitute is explicit: this test proves DB workflow, not native generation.
  const memory:DemoMemory={async reconcile(){return null;},async read(o,receipt){if(o!==owner||!saved||demoDigest(saved)!==receipt.digest)throw Error('missing');return saved;},async write(o,input){if(o!==owner)throw Error('foreign');writes++;saved=input;return {factId:'synthetic-fact',digest:demoDigest(input)};},async explain(){guideCalls++;return {reply:'Synthetic transport response, not a live finding',sessionId:'synthetic-session',traceId:'synthetic-trace',raw:{synthetic:true}};}};
  memory.reconcile=async(o,input)=>o===owner&&saved&&demoDigest(saved)===demoDigest(input)?{factId:'synthetic-fact',digest:demoDigest(saved)}:null;
  const sources={async retrieve(){return {evidence:[],context:'Synthetic transport source'};}};
  try{
    const store=new SurrealDemoStore(db);await store.ready();const service=new DemoJourney(store,memory,sources,()=>{},()=>new Date('2026-10-25T12:00:00Z'));
    const proposed=await service.propose(owner,{baseRevision:0,profile:demoSeed});expect(writes).toBe(0);
    await expect(service.confirm(other,proposed.id,{confirm:true})).rejects.toMatchObject({code:'DEMO_RECORD_NOT_FOUND'});
    const result=await service.confirm(owner,proposed.id,{confirm:true});expect(result.revision).toBe(1);expect(writes).toBe(1);
    await service.confirm(owner,proposed.id,{confirm:true});expect(writes).toBe(1);expect((await store.proposal(owner,proposed.id)).profile).toBeNull();
    const id=randomUUID();const finding=await service.discover(owner,{requestId:id,question:'What should my employer and I investigate?',fictional:true});
    expect(finding.discovery?.status).toBe('potential_pathway');expect(guideCalls).toBe(1);
    expect((await service.discover(owner,{requestId:id,question:'What should my employer and I investigate?',fictional:true})).id).toBe(finding.id);expect(guideCalls).toBe(1);
    const update=await service.replay(owner,{requestId:randomUUID(),fictional:true});expect(update.discovery?.score?.delta).toBe(40);
    expect((await service.replay(owner,{requestId:randomUUID(),fictional:true})).id).toBe(update.id);
    const reloaded=new DemoJourney(new SurrealDemoStore(db),memory,sources);expect((await reloaded.history(owner)).events).toHaveLength(2);expect((await reloaded.history(other)).events).toEqual([]);
    const attempts=await Promise.allSettled([store.propose(owner,1,{...demoSeed,name:'Synthetic One'}),store.propose(owner,1,{...demoSeed,name:'Synthetic Two'})]);expect(attempts.filter(a=>a.status==='fulfilled')).toHaveLength(1);
    console.info('Retained demo test records',JSON.stringify({owner,head:1,proposals:2,events:2,AM:'test transport only'}));
  }finally{await db.close();}
});
