import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { AppError } from './errors.js';
import type { SourceEvidence } from '../shared/demo.js';
export const guideUrls = {
  c20: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/temporary-residents/foreign-workers/exemption-codes/canadian-interests-reciprocal-employment-general-guidelines-r205-b-c20.html',
  c20_update: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/updates/2026-reciprocal-employment-c20.html',
  ee_changes: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html',
  ee_tiers: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/high-wage.html',
  crs_criteria:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html',
  crs_language:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html',
  crs_education:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/education-assessment.html',
} as const;
export const sourceHash = (text: string) => createHash('sha256').update(text).digest('hex');
export function mainText(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (!main) throw new AppError(503,'SOURCE_FORMAT_CHANGED','The official source format changed and needs review.');
  return main.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[^]*?-->/g,' ').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
}
const sourceSchema = z.strictObject({id:z.enum(['c20','c20_update','ee_changes','ee_tiers','crs_criteria','crs_language','crs_education']),title:z.string(),url:z.string(),text:z.string().min(100),bodySha256:z.string().regex(/^[a-f0-9]{64}$/),retrievedAt:z.iso.datetime(),reviewedAt:z.iso.datetime(),publishedAt:z.string().optional(),effectiveFrom:z.string().optional()});
export type ReviewedGuideSource = z.infer<typeof sourceSchema>;
export function validateGuideSources(input:unknown){
  const sources=z.array(sourceSchema).min(4).max(7).parse(input);
  if(new Set(sources.map(s=>s.id)).size!==sources.length||['c20','c20_update','ee_changes','ee_tiers'].some(id=>!sources.some(s=>s.id===id))||sources.some(s=>s.url!==guideUrls[s.id]||sourceHash(s.text)!==s.bodySha256))throw new AppError(503,'SOURCE_BUNDLE_INVALID','The reviewed source bundle is invalid.');
  return sources;
}
export class GuideSources {
  private sources: ReviewedGuideSource[];
  constructor(fileOrRecords: string|ReviewedGuideSource[], private transport: typeof fetch = fetch) {
    this.sources = validateGuideSources(typeof fileOrRecords==='string'?JSON.parse(readFileSync(fileOrRecords,'utf8')):fileOrRecords);
  }
  async retrieve(kind: 'c20'|'express_entry'|'express_entry_full'): Promise<{evidence:SourceEvidence[]; context:string}> {
    if(kind==='express_entry_full'&&['crs_criteria','crs_language','crs_education'].some(id=>!this.sources.some(s=>s.id===id)))throw new AppError(503,'CRS_SOURCES_REQUIRED','The complete CRS source bundle needs review before a total can be calculated.');
    const selected = this.sources.filter(s=>kind==='c20' ? s.id.startsWith('c20') : s.id.startsWith('ee_')||kind==='express_entry_full'&&s.id.startsWith('crs_'));
    const current = await Promise.all(selected.map(async source=>{
      let text: string;
      try {
        const response = await this.transport(source.url,{redirect:'error',signal:AbortSignal.timeout(12_000),headers:{Accept:'text/html'}});
        if (!response.ok || Number(response.headers.get('content-length')??0)>1_000_000) throw Error();
        const html=await response.text(); if(html.length>1_000_000)throw Error(); text=mainText(html);
      } catch { throw new AppError(503,'OFFICIAL_SOURCE_UNAVAILABLE','The official source could not be checked. No new discovery was generated.'); }
      if(sourceHash(text)!==source.bodySha256)throw new AppError(409,'OFFICIAL_SOURCE_CHANGED','An official source changed since review. This discovery is on hold until the change is reviewed.');
      const {text:_text,...evidence}=source;
      return {evidence:{...evidence,retrievedAt:new Date().toISOString()},text};
    }));
    return {evidence:current.map(s=>s.evidence),context:current.map(s=>`SOURCE: ${s.evidence.url}\n${s.text}`).join('\n\n')};
  }
}
