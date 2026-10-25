/** Public-source preparation only; no credentials, promotion or provider calls. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { guideUrls, mainText, sourceHash } from '../server/guide-sources.js';
const sources=[];
for(const [id,url] of Object.entries(guideUrls)) {
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15_000)});
  if(!response.ok)throw Error(`Official source ${id} unavailable: ${response.status}`);
  const text=mainText(await response.text());
  const titles:Record<string,string>={c20:'IRCC reciprocal employment guidance',c20_update:'IRCC C20 update, August 13, 2026',ee_changes:'IRCC Express Entry changes, November 3, 2026',ee_tiers:'IRCC high-wage occupation tiers',crs_criteria:'IRCC CRS criteria and points tables',crs_language:'IRCC language tests and validity',crs_education:'IRCC educational credential assessment'};
  sources.push({id,url,title:titles[id],text,bodySha256:sourceHash(text),retrievedAt:new Date().toISOString(),...(id==='c20_update'?{publishedAt:'2026-08-13'}:id.startsWith('ee_')?{publishedAt:'2026-10-16',effectiveFrom:'2026-11-03'}:{})});
}
// Retrieval is not review. An operator must review applicability and dates before
// adding reviewedAt and promoting a candidate to the configured source bundle.
mkdirSync('.local/source-candidates',{recursive:true});
writeFileSync(`.local/source-candidates/guide-${Date.now()}.json`,JSON.stringify(sources,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(sources.map(({id,url,bodySha256,retrievedAt})=>({id,url,bodySha256,retrievedAt}))));
