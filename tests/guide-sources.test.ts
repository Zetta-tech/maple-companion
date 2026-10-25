import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe,it,expect} from 'vitest';
import {GuideSources,mainText,type ReviewedGuideSource} from '../server/guide-sources.js';
const file=new URL('../policy-sources/guide-2026-10-25.json',import.meta.url);
const sources=JSON.parse(readFileSync(file,'utf8')) as ReviewedGuideSource[];
const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
describe('reviewed guide source retrieval contract',()=>{
  it('retrieves actual selected source bodies through the transport and binds their reviewed hashes',async()=>{
    const requested:string[]=[];
    const transport:typeof fetch=async(input,init)=>{const url=String(input);requested.push(url);expect(init?.redirect).toBe('error');const source=sources.find(s=>s.url===url)!;return new Response('<main>'+escape(source.text)+'</main>');};
    const result=await new GuideSources(fileURLToPath(file),transport).retrieve('c20');
    expect(requested).toEqual(sources.filter(s=>s.id.startsWith('c20')).map(s=>s.url));expect(result.evidence).toHaveLength(2);expect(result.context).toContain(sources.find(s=>s.id==='c20')!.text);
  });
  it('holds a changed official body rather than silently applying it',async()=>{
    const transport:typeof fetch=async()=>new Response('<main>The official content changed and requires a new applicability review.</main>');
    await expect(new GuideSources(fileURLToPath(file),transport).retrieve('express_entry')).rejects.toMatchObject({code:'OFFICIAL_SOURCE_CHANGED'});
  });
  it('does not substitute stored text when live retrieval is unavailable',async()=>{
    await expect(new GuideSources(fileURLToPath(file),async()=>new Response('',{status:503})).retrieve('c20')).rejects.toMatchObject({code:'OFFICIAL_SOURCE_UNAVAILABLE'});
  });
  it('extracts the main source body and rejects an unsupported page format',()=>{
    expect(mainText('<header>Not a rule</header><main>Reviewed &amp; source<script>ignored()</script></main>')).toBe('Reviewed & source');
    expect(()=>mainText('<p>No main content</p>')).toThrow();
  });
});
