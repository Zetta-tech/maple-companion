import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {connectOperationalDatabase,loadDatabaseConfig} from '../server/operational-db.js';
import {SurrealDemoStore} from '../server/demo-store.js';
import {DemoJourney} from '../server/demo-journey.js';
import {GuideSources} from '../server/guide-sources.js';
import {demoSeed} from '../shared/demo.js';
import {fictionalCrsEvidence} from '../shared/crs.js';
import {DemoFixtureMemory} from '../tests/support/demo-fixture.js';

it('persists a source-checked complete fictional CRS projection in the real test database',async()=>{
  // Official retrieval and Surreal storage are real. AM is deliberately substituted;
  // this does not establish hosted AM persistence or generated C20 acceptance.
  const provider=new GuideSources('policy-sources/guide-2026-10-25.json');
  const currentSources=await provider.retrieve('express_entry_full');
  expect(currentSources.evidence).toHaveLength(5);
  const sources={async retrieve(){return currentSources;}};
  const db=await connectOperationalDatabase(loadDatabaseConfig('test'));
  const owner='user_demopolicy'+randomUUID().replaceAll('-',''),other=owner+'other';
  const memory=new DemoFixtureMemory();
  const now=()=>new Date('2026-10-25T12:00:00Z');
  try {
    const store=new SurrealDemoStore(db);await store.ready();
    const service=new DemoJourney(store,memory,sources,()=>{},now);
    const evidence=fictionalCrsEvidence('2026-10-25');evidence.completeEvidenceReviewed='yes';
    evidence.canadianEmployer='unknown';
    const incomplete={...demoSeed,crsEvidence:evidence};
    const firstProposal=await service.propose(owner,{baseRevision:0,profile:incomplete});
    await service.confirm(owner,firstProposal.id,{confirm:true});
    const hold=await service.replay(owner,{requestId:randomUUID(),fictional:true});
    expect(hold.discovery?.crs?.status).toBe('needs_information');
    const complete={...incomplete,crsEvidence:{...evidence,canadianEmployer:'yes' as const}};
    const secondProposal=await service.propose(owner,{baseRevision:1,profile:complete});
    await service.confirm(owner,secondProposal.id,{confirm:true});
    const result=await service.replay(owner,{requestId:randomUUID(),fictional:true});
    expect(result.discovery?.crs).toMatchObject({status:'complete',before:528,after:568,delta:40,asOf:'2026-10-25',projected:true});
    expect(result.discovery?.sources).toEqual(currentSources.evidence);
    expect((await service.replay(owner,{requestId:randomUUID(),fictional:true})).id).toBe(result.id);
    const rebuilt=new DemoJourney(new SurrealDemoStore(db),memory,sources,()=>{},now);
    expect((await rebuilt.history(owner)).events.map(e=>e.id).sort()).toEqual([hold.id,result.id].sort());
    expect((await rebuilt.history(other)).events).toEqual([]);
    expect(memory.writes).toBe(2);expect(memory.explanations).toBe(0);
    expect((await store.proposal(owner,secondProposal.id)).profile).toBeNull();
    console.info('Retained source-checked CRS test records',JSON.stringify({owner,head:1,proposals:2,events:2,AM:'test transport only'}));
  }finally{await db.close();}
},45_000);
