import {describe,it,expect} from 'vitest';
import {reviewGuideExplanation} from '../server/guide-explanation.js';
import {discoverC20} from '../server/discovery.js';
import {demoSeed} from '../shared/demo.js';
const url='https://www.canada.ca/official-fixture';
const discovery=discoverC20(demoSeed,'2026-10-25',1,[{id:'fixture',title:'Official fixture',url,bodySha256:'a'.repeat(64),retrievedAt:'2026-10-25T00:00:00Z',reviewedAt:'2026-10-25T00:00:00Z'}]);
const reply=(changes:Record<string,unknown>={})=>JSON.stringify({assessmentStatus:'potential_pathway',sourceUrls:[url],explanation:'Ask HR for reciprocal-employment evidence. A reported program is only a lead; the spouse requires a separate assessment.',...changes});
describe('native explanation contract, not semantic certification',()=>{
  it('accepts bounded sourced explanation while preserving its exact text',()=>expect(reviewGuideExplanation(reply(),discovery)).toEqual({status:'available',text:JSON.parse(reply()).explanation}));
  it.each(['json','JSON',''])('accepts one complete %s Markdown JSON wrapper',language=>expect(reviewGuideExplanation('```'+language+'\n'+reply()+'\n```',discovery)).toEqual({status:'available',text:JSON.parse(reply()).explanation}));
  it.each(['Before\n```json\n'+reply()+'\n```','```json\n'+reply()+'\n```\nAfter','```json\n'+reply()+'\n```\n```json\n{}\n```'])('withholds surrounding prose or multiple blocks',text=>expect(reviewGuideExplanation(text,discovery)).toMatchObject({status:'withheld',reason:'REPLY_FORMAT_UNVERIFIED'}));
  it('still validates claims inside a code fence',()=>expect(reviewGuideExplanation('```json\n'+reply({explanation:'Your spouse will get a permit.'})+'\n```',discovery)).toMatchObject({status:'withheld',reason:'REPLY_AUTHORIZATION_CLAIM'}));
  it.each(['Approval cannot be guaranteed.','A permit is not guaranteed.','Approval can\'t be guaranteed.'])('does not mistake a disclaimer for a guarantee: %s',explanation=>expect(reviewGuideExplanation(reply({explanation}),discovery)).toEqual({status:'available',text:explanation}));
  it('does not let a disclaimer mask a later guarantee',()=>expect(reviewGuideExplanation(reply({explanation:'A permit is not guaranteed, but approval is guaranteed.'}),discovery)).toMatchObject({status:'withheld',reason:'REPLY_AUTHORIZATION_CLAIM'}));
  it.each([{}, {sourceUrls:[]}, {sourceUrls:['https://unreviewed.example/']}, {assessmentStatus:'not_supported'}])('withholds missing format, source or contradictory status %#',change=>{
    expect(reviewGuideExplanation(Object.keys(change).length?reply(change):'plain unsupported answer',discovery).status).toBe('withheld');
  });
  it.each(['You are eligible for C20.','Your spouse will get a permit.','Approval is guaranteed.','You can continue working.'])('holds detected consequential claim: %s',explanation=>expect(reviewGuideExplanation(reply({explanation}),discovery)).toMatchObject({status:'withheld',reason:'REPLY_AUTHORIZATION_CLAIM'}));
});
