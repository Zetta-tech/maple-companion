import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reviewedRelease,seedPolicyRelease } from '../server/policy-store.js';
import { connectOperationalDatabase,loadDatabaseConfig } from '../server/operational-db.js';

// Explicit operator command, never imported by the app or build. No schema or credentials are created.
const [environment,file,digest]=process.argv.slice(2);
if(!['test','production'].includes(environment??'')||!file||!digest||process.argv.length!==5)throw Error('Usage: seed-policy-release.ts <test|production> <approved-release.json> <approved-exact-digest>');
const release=reviewedRelease(JSON.parse(readFileSync(resolve(file),'utf8')));
if(release.digest!==digest)throw Error('POLICY_APPROVAL_MISMATCH');
const config=loadDatabaseConfig(environment as 'test'|'production');
const db=await connectOperationalDatabase(config);
try {const result=await seedPolicyRelease(db,release.manifest,digest,new Date().toISOString());console.log(JSON.stringify({database:config.database,...result}));}
catch {console.error('POLICY_SEED_NOT_VERIFIED_INSPECT_TARGET_BEFORE_RETRY');process.exitCode=1;}
finally {await db.close();}
