import { describe,it,expect } from 'vitest';
import { demoSeed } from '../shared/demo.js';
import { discoverC20,projectExpressEntry } from '../server/discovery.js';
import {completeGuideProfileSchema,type PersonalProfile} from '../shared/personal-guide.js';
import {fictionalCrsEvidence} from '../shared/crs.js';
import {fixtureSources} from './support/demo-fixture.js';
const date='2026-10-25';
describe('source-reviewed personalized discovery',()=>{
  const personal:PersonalProfile={...demoSeed,fictional:false,name:null,permitExpiry:null,inputPurpose:'reviewed-assessment-inputs',employmentBasis:{revision:1,receiptDigest:'a'.repeat(64)},workEnd:null,currentJob:true,intervalComplete:true};
  it.each([['arrivedInCanada','arrival in Canada'],['weeklyHours','weekly hours'],['noc','NOC code']] as const)('identifies missing %s without requiring optional personal details', (field,label)=>{
    const result=projectExpressEntry({...personal,[field]:null},date,1,[]);
    expect(result.status).toBe('needs_information');expect(result.outstanding.join(' ')).toContain(label);
    expect(result.score).toBeUndefined();expect(result.crs).toBeUndefined();
  });
  it('retains demo-only required fields while allowing nullable personal non-scoring fields',()=>{
    expect(completeGuideProfileSchema.safeParse(personal).success).toBe(true);
    expect(projectExpressEntry(personal,date,1,[]).score?.before).toBe(46);
    for(const field of ['name','permitExpiry'])expect(completeGuideProfileSchema.safeParse({...demoSeed,[field]:null}).success).toBe(false);
  });
  it('still withholds personal totals for unreviewed work or CRS evidence',async()=>{
    const sources=(await fixtureSources.retrieve('express_entry_full')).evidence;
    const profile={...personal,crsEvidence:fictionalCrsEvidence(date)};
    expect(projectExpressEntry(profile,date,1,sources).crs?.status).toBe('needs_information');
    profile.crsEvidence.completeEvidenceReviewed='yes';
    const result=projectExpressEntry({...profile,intervalComplete:false},date,1,sources);
    expect(result.status).toBe('needs_information');expect(result.crs).toBeUndefined();
    expect(result.outstanding.join(' ')).toContain('qualifying work interval');
  });
  it('surfaces C20 from the offer and reported reciprocal program, not employer branding',()=>{
    for(const employer of ['Northstar Fictional','Other Fictional Employer'])expect(discoverC20({...demoSeed,employer},date,1,[]).status).toBe('potential_pathway');
    const noProgram=discoverC20({...demoSeed,reciprocalProgramReported:'unknown'},date,1,[]);
    expect(noProgram.status).toBe('needs_information');expect(noProgram.outstanding.join(' ')).toContain('reciprocal opportunities');
    expect(discoverC20({...demoSeed,canadianOffer:'no'},date,1,[]).status).toBe('not_supported');
  });
  it('does not turn expiry, a promised letter or a spouse into eligibility',()=>{
    const result=discoverC20({...demoSeed,permitExpiry:'2026-01-01'},date,1,[]);
    expect(result.status).toBe('potential_pathway');expect(result.outstanding.join(' ')).toContain('current immigration status');
    expect(result.outstanding.join(' ')).toContain('not verified reciprocity');expect(result.outstanding.join(' ')).toContain('spouse separately');
  });
  it('keeps future policy timing and component scope explicit, with same-date comparison',()=>{
    const result=projectExpressEntry(demoSeed,date,1,[]);
    expect(result.score).toEqual({scope:'canadian_work_component',before:46,after:86,delta:40,effectiveFrom:'2026-11-03',totalCrs:null,conditional:false});
    expect(result.reasons.join(' ')).toContain('not active');expect(result.title).toContain('future');
  });
  it.each(['nocReviewed','physicallyCanada','authorizedWork','paidEmployee','fullTimeStudy','selfEmployed'] as const)('holds missing or excluded %s evidence',field=>{
    const value=field==='nocReviewed'?false:['fullTimeStudy','selfEmployed'].includes(field)?'yes':'unknown';
    expect(projectExpressEntry({...demoSeed,[field]:value},date,1,[]).score).toBeUndefined();
  });
  it('does not invent a 40-point result for another NOC, incomplete duration or unresolved offer comparison',()=>{
    expect(projectExpressEntry({...demoSeed,noc:'00011'},date,1,[]).score).toBeUndefined();
    expect(projectExpressEntry({...demoSeed,workStart:'2025-11-25',weeklyHours:70},date,1,[]).score).toBeUndefined();
    expect(projectExpressEntry({...demoSeed,qualifyingExpressEntryOffer:'not_reviewed'},date,1,[]).score?.conditional).toBe(true);
  });
  it('distinguishes spouse points and equivalent part-time duration without overtime acceleration',()=>{
    expect(projectExpressEntry({...demoSeed,spouseAccompanying:'no'},date,1,[]).score?.before).toBe(53);
    expect(projectExpressEntry({...demoSeed,weeklyHours:15},date,1,[]).score?.before).toBe(35);
    expect(projectExpressEntry({...demoSeed,weeklyHours:100},date,1,[]).score?.before).toBe(46);
  });
  it('holds work preceding the recorded arrival without assuming a later re-entry disproves earlier stays',()=>{
    const result=projectExpressEntry({...demoSeed,arrivedInCanada:'2026-10-01',workStart:'2024-01-15'},date,1,[]);
    expect(result.status).toBe('needs_information');expect(result.score).toBeUndefined();expect(result.outstanding.join(' ')).toContain('later re-entry');expect(result.outstanding.join(' ')).toContain('earlier Canadian stay');
  });
});
