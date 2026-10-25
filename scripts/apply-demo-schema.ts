import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {connectOperationalDatabase,loadDatabaseConfig} from '../server/operational-db.js';
const environment=process.argv[2];if(environment!=='test'&&environment!=='development')throw Error('Explicit test/development target required');
const config=loadDatabaseConfig(environment);
if(config.namespace!=='maple'||config.endpoint!=='wss://maple-companion-06gn0qtrb1pg30seac28l0hfag.aws-use1.surreal.cloud/rpc')throw Error('Wrong database target');
const db=await connectOperationalDatabase(config);const names=['maple_demo_heads','maple_demo_proposals','maple_demo_events'];
try{
  const [info]=await db.query<[{tables:Record<string,string>}]>('INFO FOR DB;').retry(false);
  const [marker]=await db.query<[{version:number}[]]>('SELECT version FROM maple_schema:demo_journey_v1;').retry(false);
  if(marker.length){if(marker[0]?.version!==1||!names.every(n=>n in info.tables))throw Error('Existing schema mismatch; inspect before any mutation');console.log(JSON.stringify({environment,alreadyPresent:true,tables:names}));}
  else{
    if(names.some(n=>n in info.tables))throw Error('Partial schema exists; inspect uncertain outcome before retry');
    await db.query(readFileSync(new URL('../database/demo-journey-v1.surql',import.meta.url),'utf8')).retry(false);
    const [after]=await db.query<[{tables:Record<string,string>}]>('INFO FOR DB;').retry(false);
    const [check]=await db.query<[{version:number}[]]>('SELECT version FROM maple_schema:demo_journey_v1;').retry(false);
    if(check[0]?.version!==1||!names.every(n=>n in after.tables)||Object.keys(info.tables).some(n=>!(n in after.tables)))throw Error('Schema verification failed');
    const report={at:new Date().toISOString(),environment,addedTables:names,existingTablesPreserved:true,markerVersion:1,deletions:0,accessChanges:0};
    mkdirSync('.local',{recursive:true});writeFileSync(`.local/demo-schema-${environment}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }
}finally{await db.close();}
