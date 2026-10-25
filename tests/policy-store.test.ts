import { readFileSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import type { Surreal } from 'surrealdb';
import { reviewedRelease,SurrealPolicyStore,seedPolicyRelease } from '../server/policy-store.js';
import { CRS_POLICY_VERSION } from '../shared/crs.js';
import { demoDigest } from '../server/demo-memory.js';
const sources=JSON.parse(readFileSync(new URL('../policy-sources/guide-2026-10-25.json',import.meta.url),'utf8'));
const manifest={version:'offline-source-registry-fixture',calculatorVersion:CRS_POLICY_VERSION,sources,policies:{versions:[],approvedDigests:[]}};
function fakeDb(options:{active?:string;corrupt?:boolean;switchActive?:boolean}={}){
  const release=reviewedRelease(manifest);let activeReads=0;
  return {query(query:string){let value:unknown;
    if(query.includes('maple_schema:'))value=[[{version:1}],[{digest:options.active??release.digest}]];
    else if(query.includes('maple_policy_versions'))value=[[{manifest_json:JSON.stringify(manifest),approved_at:'2026-10-25T12:00:00Z'}],sources.map((s:Record<string,unknown>,i:number)=>({source_json:JSON.stringify(options.corrupt&&i===0?{...s,text:'tampered official body'}:s)}))];
    else {activeReads++;value=[[{digest:options.switchActive?'b'.repeat(64):release.digest}]];}
    return {retry:async()=>value};
  }} as unknown as Surreal;
}
describe('shared reviewed information registry',()=>{
  it('binds every reviewed source and rule to an exact immutable release',()=>{
    const release=reviewedRelease(manifest);expect(release.digest).toBe(demoDigest(release.manifest));
    const changed=structuredClone(manifest);changed.sources[0].text+=' tampering';expect(()=>reviewedRelease(changed)).toThrow();
    const draft=JSON.parse(readFileSync(new URL('../policy-drafts/cec-work-experience.candidate.json',import.meta.url),'utf8'));
    expect(()=>reviewedRelease({...manifest,policies:{versions:[draft],approvedDigests:[]}})).toThrow();
  });
  it('reads only the deployment-pinned active release and rejects mismatched or changed records',async()=>{
    const digest=reviewedRelease(manifest).digest;
    expect((await new SurrealPolicyStore(fakeDb(),digest).load()).manifest.version).toBe(manifest.version);
    await expect(new SurrealPolicyStore(fakeDb({active:'b'.repeat(64)}),digest).load()).rejects.toMatchObject({code:'POLICY_REGISTRY_UNAVAILABLE'});
    await expect(new SurrealPolicyStore(fakeDb({corrupt:true}),digest).load()).rejects.toBeDefined();
    await expect(new SurrealPolicyStore(fakeDb({switchActive:true}),digest).load()).rejects.toMatchObject({code:'POLICY_REGISTRY_UNAVAILABLE'});
  });
  it('checks current official content and never falls back to cached bodies on a changed source',async()=>{
    const digest=reviewedRelease(manifest).digest;
    const provider=new SurrealPolicyStore(fakeDb(),digest).guideSources(async()=>new Response('<main>Changed official source</main>'));
    await expect(provider.retrieve('c20')).rejects.toMatchObject({code:'OFFICIAL_SOURCE_CHANGED'});
  });
  it('rejects an unapproved seed digest before starting any database transaction',async()=>{
    let began=false;const db={beginTransaction(){began=true;throw Error('must not begin');}} as unknown as Surreal;
    await expect(seedPolicyRelease(db,manifest,'b'.repeat(64),'2026-10-25T12:00:00Z')).rejects.toMatchObject({code:'POLICY_APPROVAL_MISMATCH'});expect(began).toBe(false);
  });
});
