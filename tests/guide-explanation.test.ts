import {describe,it,expect} from 'vitest';
import {reviewGuideExplanation} from '../server/guide-explanation.js';
import {discoverC20} from '../server/discovery.js';
import {demoSeed} from '../shared/demo.js';
const url='https://www.canada.ca/official-fixture';
const discovery=discoverC20(demoSeed,'2026-10-25',1,[{id:'fixture',title:'Official fixture',url,bodySha256:'a'.repeat(64),retrievedAt:'2026-10-25T00:00:00Z',reviewedAt:'2026-10-25T00:00:00Z'}]);
const reply=(changes:Record<string,unknown>={})=>JSON.stringify({assessmentStatus:'potential_pathway',sourceUrls:[url],explanation:'Ask HR for reciprocal-employment evidence. A reported program is only a lead; the spouse requires a separate assessment.',...changes});
describe('native explanation contract, not semantic certification',()=>{
  it('accepts bounded sourced explanation while preserving its exact text',()=>expect(reviewGuideExplanation(reply(),discovery)).toEqual({status:'available',text:JSON.parse(reply()).explanation}));
  it.each([{}, {sourceUrls:[]}, {sourceUrls:['https://unreviewed.example/']}, {assessmentStatus:'not_supported'}])('withholds missing format, source or contradictory status %#',change=>{
    expect(reviewGuideExplanation(Object.keys(change).length?reply(change):'plain unsupported answer',discovery).status).toBe('withheld');
  });
  it.each(['You are eligible for C20.','Your spouse will get a permit.','Approval is guaranteed.','You can continue working.'])('holds detected consequential claim: %s',explanation=>expect(reviewGuideExplanation(reply({explanation}),discovery)).toMatchObject({status:'withheld',reason:'REPLY_AUTHORIZATION_CLAIM'}));
});
