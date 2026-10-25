import { RecordId,type Surreal } from 'surrealdb';
import { z } from 'zod';
import { GuideSources,validateGuideSources } from './guide-sources.js';
import { PolicyRegistry,policyDigest } from './policies.js';
import { demoDigest } from './demo-memory.js';
import { AppError } from './errors.js';
import { CRS_POLICY_VERSION } from '../shared/crs.js';

const hash=z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema=z.strictObject({version:z.string().min(1).max(100),calculatorVersion:z.literal(CRS_POLICY_VERSION),
  sources:z.array(z.unknown()),policies:z.strictObject({versions:z.array(z.unknown()),approvedDigests:z.array(hash)})});
export function reviewedRelease(input:unknown){
  const data=manifestSchema.parse(input),sources=validateGuideSources(data.sources);
  const policies=new PolicyRegistry(data.policies.versions,data.policies.approvedDigests);
  // Every seeded rule must carry its exact review approval. No draft promotion.
  for(const rule of data.policies.versions){const digest=policyDigest(rule),review=(rule as {review?:{status?:string;reviewedAt?:unknown}}).review;
    if(!data.policies.approvedDigests.includes(digest)||review?.status!=='reviewed'||!z.iso.datetime().safeParse(review.reviewedAt).success)throw new AppError(503,'POLICY_RELEASE_INVALID','Unapproved policy versions cannot be published.');}
  const manifest={...data,sources};return {manifest,digest:demoDigest(manifest),policies};
}
const unavailable=()=>new AppError(503,'POLICY_REGISTRY_UNAVAILABLE','The approved information registry could not be verified.');

/** Shared official information only. Never stores user data or permits HTTP promotion. */
export class SurrealPolicyStore {
  constructor(private db:Surreal,private expectedDigest:string){hash.parse(expectedDigest);}
  async load(){
    const [markers,active]=await this.db.query<[{version:number}[],{digest:string}[]]>('SELECT version FROM maple_schema:policy_registry_v1; SELECT digest FROM maple_policy_active:phase_i;').retry(false);
    if(markers[0]?.version!==1||active.length!==1||active[0]?.digest!==this.expectedDigest)throw unavailable();
    const [releases,rows]=await this.db.query<[{manifest_json:string;approved_at:string}[],{source_json:string}[]]>('SELECT manifest_json,approved_at FROM maple_policy_versions WHERE digest=$digest; SELECT source_json FROM maple_policy_sources WHERE release_digest=$digest ORDER BY source_id;',{digest:this.expectedDigest}).retry(false);
    if(releases.length!==1||!z.iso.datetime().safeParse(releases[0]?.approved_at).success)throw unavailable();
    const release=reviewedRelease(JSON.parse(releases[0]!.manifest_json));
    if(release.digest!==this.expectedDigest||rows.length!==release.manifest.sources.length)throw unavailable();
    const actual=validateGuideSources(rows.map(row=>JSON.parse(row.source_json)));
    for(const source of release.manifest.sources)if(demoDigest(actual.find(s=>s.id===source.id))!==demoDigest(source))throw unavailable();
    // Detect activation changes during the read. A different release needs a new deployment pin.
    await this.assertActive();
    return release;
  }
  async assertActive(){const [rows]=await this.db.query<[{digest:string}[]]>('SELECT digest FROM maple_policy_active:phase_i;').retry(false);if(rows.length!==1||rows[0]?.digest!==this.expectedDigest)throw unavailable();}
  guideSources(transport:typeof fetch=fetch):Pick<GuideSources,'retrieve'>{return {retrieve:async kind=>{const release=await this.load();const result=await new GuideSources(release.manifest.sources,transport).retrieve(kind);await this.assertActive();return result;}};}
}

/** Explicit operator action only, after schema and this exact digest are approved.
 * Empty target or exact idempotent replay only; never overwrites an active release. */
export async function seedPolicyRelease(db:Surreal,input:unknown,approvedDigest:string,approvedAt:string){
  const release=reviewedRelease(input);hash.parse(approvedDigest);z.iso.datetime().parse(approvedAt);
  if(release.digest!==approvedDigest)throw new AppError(400,'POLICY_APPROVAL_MISMATCH','Approval does not match this exact information release.');
  const tx=await db.beginTransaction();
  try {
    const [markers,active]=await tx.query<[{version:number}[],{digest:string}[]]>('SELECT version FROM maple_schema:policy_registry_v1; SELECT digest FROM maple_policy_active:phase_i;').retry(false);
    if(markers[0]?.version!==1)throw unavailable();
    if(active.length){if(active.length!==1||active[0]?.digest!==release.digest)throw new AppError(409,'POLICY_REGISTRY_NOT_EMPTY','An active information release already exists. Nothing was overwritten.');await tx.cancel();await new SurrealPolicyStore(db,release.digest).load();return {digest:release.digest,alreadyPresent:true};}
    for(const source of release.manifest.sources)await tx.query('CREATE $record CONTENT $data;',{record:new RecordId('maple_policy_sources',demoDigest([release.digest,source.id])),data:{release_digest:release.digest,source_id:source.id,body_sha256:source.bodySha256,source_json:JSON.stringify(source)}}).retry(false);
    await tx.query('CREATE $record CONTENT $data; CREATE ONLY maple_policy_active:phase_i CONTENT $active;',{
      record:new RecordId('maple_policy_versions',release.digest),data:{digest:release.digest,version:release.manifest.version,manifest_json:JSON.stringify(release.manifest),approved_at:approvedAt},active:{digest:release.digest,version:release.manifest.version,activated_at:approvedAt}}).retry(false);
    await tx.commit();
  }catch(error){try{await tx.cancel();}catch{/* Outcome must be inspected before retry. */}throw error;}
  await new SurrealPolicyStore(db,release.digest).load();return {digest:release.digest,alreadyPresent:false};
}
