import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reviewedRelease } from '../server/policy-store.js';
import { CRS_POLICY_VERSION } from '../shared/crs.js';

const [policyFile,outputFile]=process.argv.slice(2);
if(!policyFile||!outputFile||process.argv.length!==4)throw Error('Usage: prepare-policy-release.ts <already-reviewed-policy-bundle.json> <new-output.json>');
const release=reviewedRelease({version:'2026-10-25.phase-i.v1',calculatorVersion:CRS_POLICY_VERSION,
  sources:JSON.parse(readFileSync(resolve('policy-sources/guide-2026-10-25.json'),'utf8')),
  policies:JSON.parse(readFileSync(resolve(policyFile),'utf8'))});
writeFileSync(resolve(outputFile),JSON.stringify(release.manifest,null,2),{flag:'wx'});
console.log(JSON.stringify({prepared:true,version:release.manifest.version,digest:release.digest,sourceCount:release.manifest.sources.length,policyCount:release.manifest.policies.versions.length,seeded:false}));
