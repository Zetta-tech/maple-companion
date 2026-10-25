import {describe,it,expect} from 'vitest';
import {demoSeed} from '../shared/demo.js';
import {fictionalCrsEvidence,noWork} from '../shared/crs.js';
import type {PersonalProfile} from '../shared/personal-guide.js';
import {projectExpressEntry} from '../server/discovery.js';
import {fixtureSources} from './support/demo-fixture.js';

function personal(start:string,end:string|null):PersonalProfile {
  return {...demoSeed,fictional:false,name:null,permitExpiry:null,inputPurpose:'reviewed-assessment-inputs',
    employmentBasis:{revision:1,receiptDigest:'a'.repeat(64)},intervalComplete:true,
    arrivedInCanada:'2010-01-01',spouseAccompanying:'no',workStart:start,workEnd:end,currentJob:end===null,weeklyHours:30};
}
async function bothPaths(start:string,end:string|null,asOf:string) {
  const profile=personal(start,end),crsEvidence=fictionalCrsEvidence(asOf);
  crsEvidence.completeEvidenceReviewed='yes';crsEvidence.canadianWorkEnd=end;
  crsEvidence.english.date=asOf;crsEvidence.foreignWork={...noWork};
  const sources=(await fixtureSources.retrieve('express_entry_full')).evidence;
  return {component:projectExpressEntry(profile,asOf,1,sources),full:projectExpressEntry({...profile,crsEvidence},asOf,1,sources)};
}

describe('Canadian work interval parity across component and complete CRS calculations',()=>{
  it.each([
    ['actual final day completes one year','2024-01-15','2025-01-14','2026-10-25',40],
    ['day before completed year','2024-01-15','2025-01-13','2026-10-25',0],
    ['actual final day completes two years','2024-01-15','2026-01-14','2026-10-25',53],
    ['assessment day is not counted','2024-01-15','2025-01-14','2025-01-14',0],
    ['assessment cap permits only the completed year','2024-01-15','2025-01-15','2025-01-15',40],
    ['current job before anniversary','2024-01-15',null,'2025-01-14',0],
    ['current job at anniversary','2024-01-15',null,'2025-01-15',40],
    ['leap-year final day counts','2023-03-01','2024-02-29','2024-03-01',40],
    ['leap-year final day is capped on assessment day','2023-03-01','2024-02-29','2024-02-29',0],
    ['ordinary anniversary across a leap year','2024-01-15','2025-01-14','2025-01-15',40],
    ['work-duration points retain five-year cap','2019-01-15','2026-10-24','2026-10-25',80],
  ] as const)('%s',async(_label,start,end,asOf,expectedPoints)=>{
    const {component,full}=await bothPaths(start,end,asOf);
    expect(full.crs?.status,JSON.stringify(full.outstanding)).toBe('complete');
    if(full.crs?.status!=='complete')throw new Error('Expected a complete offline CRS result');
    expect(full.crs.labourMarket.workDuration).toBe(expectedPoints);
    if(expectedPoints===0){
      // A valid total may have zero Canadian-work points; the component view
      // cannot claim a qualifying-work policy increase with less than one year.
      expect(component.status).toBe('needs_information');expect(component.score).toBeUndefined();
      expect(full.crs.labourMarket.highWageBonus).toBe(0);
    }else{
      expect(component.score?.before).toBe(expectedPoints);
      expect(component.score?.after).toBe(full.crs.labourMarket.workAlternative);
    }
  });
  it.each([
    ['future recorded last day','2024-01-15','2026-10-26','2026-10-25'],
    ['unreviewed leap-day starting boundary','2024-02-29','2025-02-28','2026-10-25'],
  ] as const)('withholds both paths for %s',async(_label,start,end,asOf)=>{
    const {component,full}=await bothPaths(start,end,asOf);
    expect(component.status).toBe('needs_information');expect(component.score).toBeUndefined();
    expect(full.status).toBe('needs_information');expect(full.crs?.status).not.toBe('complete');
  });
});
