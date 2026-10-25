import {describe,it,expect} from 'vitest';
import {calculateCrs,agePoints,firstLanguagePoints,workDurationPoints} from '../server/crs.js';
import {demoSeed,type DemoProfile} from '../shared/demo.js';
import {fictionalCrsEvidence,noLanguage,noWork,educationLevels,type LanguageEvidence} from '../shared/crs.js';
import {demoDigest} from '../server/demo-memory.js';
const asOf='2026-10-25';
const lang=(level:number):LanguageEvidence=>({status:'tested',test:'CELPIP-General',date:'2026-01-15',reading:level,writing:level,listening:level,speaking:level,benchmarkConversionReviewed:'yes'});
function alex():DemoProfile {
  const e=fictionalCrsEvidence(asOf);e.completeEvidenceReviewed='yes';e.dateOfBirth='1997-01-01';
  e.education={level:'masters_professional',basis:'foreign_eca',ecaDate:'2025-01-15',qualificationReviewed:'yes'};e.english=lang(9);e.canadianEducation='none';e.canadianWorkEnd='2025-09-30';
  e.foreignWork={status:'recorded',start:'2020-10-01',end:'2023-09-30',weeklyHours:30,noc:'21221',eligibilityReviewed:'yes'};
  e.spouse.education={level:'bachelors',basis:'foreign_eca',ecaDate:'2025-01-15',qualificationReviewed:'yes'};e.spouse.language=lang(9);
  e.spouse.canadianWork={status:'recorded',start:'2024-10-01',end:'2025-09-30',weeklyHours:30,noc:'21221',eligibilityReviewed:'yes'};
  return {...demoSeed,name:'Alex fictional scoring fixture',arrivedInCanada:'2023-10-01',workStart:'2023-10-01',weeklyHours:30,crsEvidence:e};
}
function single(years=1):DemoProfile {
  const p=alex();p.spouseAccompanying='no';p.workStart=years===1?'2024-10-01':'2023-10-01';p.crsEvidence!.education.level='bachelors';return p;
}
function completed(p:DemoProfile){const r=calculateCrs(p,asOf);if(r.status!=='complete')throw Error(r.reasons.join('\n'));return r;}

describe('full fictional CRS calculation from independently reviewed official tables',()=>{
  it('matches the independent married Alex fixture, all subtotals and replacement arithmetic',()=>{
    const p=alex(),digest=demoDigest(p),r=completed(p);
    expect(r.totals).toEqual({core:388,spouse:33,transferability:100,additional:0});expect([r.before,r.after,r.delta]).toEqual([521,561,40]);
    expect(r.labourMarket).toMatchObject({workDuration:46,highWageBonus:40,workAlternative:86,offerAlternative:0,selected:86,selectedAlternative:'work'});
    expect(r.projected).toBe(true);expect(r.effectiveFrom).toBe('2026-11-03');expect(r.asOf).toBe(asOf);expect(demoDigest(p)).toBe(digest);
  });
  it.each([[1,482,522,88],[2,507,547,100]])('matches single applicant with %i Canadian years', (years,before,after,transfer)=>{
    const r=completed(single(years));expect([r.before,r.after,r.totals.transferability]).toEqual([before,after,transfer]);expect(r.totals.spouse).toBe(0);
  });
  it('offer wins without stacking, and transferability still uses actual work duration',()=>{
    const p=single();p.noc='13110';p.qualifyingExpressEntryOffer='reviewed_offer';p.crsEvidence!.offer={status:'qualifying',noc:'21221',novemberRulesReviewed:'yes',genuineOfferEvidenceReviewed:'yes'};
    const r=completed(p);expect([r.before,r.after,r.delta]).toEqual([482,512,30]);expect(r.totals.transferability).toBe(88);expect(r.labourMarket).toMatchObject({workDuration:40,highWageBonus:0,selected:70,selectedAlternative:'offer'});
  });
  it('does not hardcode +40 when a 100-point offer dominates the married work branch',()=>{
    const p=alex();p.qualifyingExpressEntryOffer='reviewed_offer';p.crsEvidence!.offer={status:'qualifying',noc:'20012',novemberRulesReviewed:'yes',genuineOfferEvidenceReviewed:'yes'};
    expect([completed(p).before,completed(p).after,completed(p).delta]).toEqual([521,575,54]);
  });
  it.each(['no','unknown'] as const)('holds a reviewed qualifying offer when the Canadian offer answer is %s',canadianOffer=>{
    const p=alex();p.canadianOffer=canadianOffer;p.qualifyingExpressEntryOffer='reviewed_offer';
    p.crsEvidence!.offer={status:'qualifying',noc:'20012',novemberRulesReviewed:'yes',genuineOfferEvidenceReviewed:'yes'};
    const r=calculateCrs(p,asOf);expect(r.status).toBe('needs_information');
    if(r.status==='needs_information')expect(r.reasons.join(' ')).toContain('Canadian employment offer');
  });
  it('holds the reported newborn DOB against prior work, test and ECA evidence',()=>{
    const p=alex();p.crsEvidence!.dateOfBirth='2026-10-24';const r=calculateCrs(p,asOf);
    expect(r.status).toBe('needs_information');
    if(r.status==='needs_information')for(const label of ['Canadian work start','Foreign work start','English test','Applicant ECA'])expect(r.reasons.join(' ')).toContain(label);
  });
  it.each(['arrival','canadian_start','canadian_end','foreign_start','foreign_end','english','french','eca'] as const)('holds an applicant %s date before birth',field=>{
    const p=alex(),e=p.crsEvidence!,beforeBirth='1996-12-31';
    if(field==='arrival')p.arrivedInCanada=beforeBirth;
    if(field==='canadian_start')p.workStart=beforeBirth;
    if(field==='canadian_end')e.canadianWorkEnd=beforeBirth;
    if(field==='foreign_start')e.foreignWork.start=beforeBirth;
    if(field==='foreign_end')e.foreignWork.end=beforeBirth;
    if(field==='english')e.english.date=beforeBirth;
    if(field==='french')e.french={...lang(9),test:'TEF-Canada',date:beforeBirth};
    if(field==='eca')e.education.ecaDate=beforeBirth;
    const r=calculateCrs(p,asOf);expect(r.status).toBe('needs_information');
    if(r.status==='needs_information')expect(r.reasons.join(' ')).toContain('before the applicant’s date of birth');
  });
  it('does not invent an adult-age prerequisite beyond the CRS age table',()=>{
    const p=alex();p.crsEvidence!.dateOfBirth='2009-01-01';
    const r=completed(p);expect(r.core.find(x=>x.id==='age')?.points).toBe(0);
  });
  it.each(['no','unknown',undefined] as const)('withholds a total when Canadian-employer evidence is %s',answer=>{
    const p=alex();if(answer===undefined)delete p.crsEvidence!.canadianEmployer;else p.crsEvidence!.canadianEmployer=answer;
    const r=calculateCrs(p,asOf);expect(r.status).toBe('needs_information');
    if(r.status==='needs_information')expect(r.reasons.join(' ')).toContain('Canadian employer throughout');
  });
  it('uses without-spouse tables and no spouse points for an accompanying citizen/PR spouse',()=>{
    const p=single();p.spouseAccompanying='yes';p.crsEvidence!.spouseCitizenOrPermanentResident='yes';p.crsEvidence!.spouse.education.level='unknown';
    expect(completed(p).before).toBe(482);expect(completed(p).totals.spouse).toBe(0);
  });
  it.each(educationLevels.map((level,index)=>({level,w:[0,28,84,91,112,119,126,140][index]!,s:[0,30,90,98,120,128,135,150][index]!,spouse:[0,2,6,7,8,9,10,10][index]!})))('uses the reviewed education row for $level',({level,w,s,spouse})=>{
    const p=alex();p.crsEvidence!.education.level=level;p.crsEvidence!.spouse.education.level=level;
    const married=completed(p);expect(married.core.find(x=>x.id==='education')?.points).toBe(w);expect(married.spouse.find(x=>x.id==='spouse_education')?.points).toBe(spouse);
    p.spouseAccompanying='no';expect(completed(p).core.find(x=>x.id==='education')?.points).toBe(s);
  });
  it.each([[4,0],[5,25],[6,25],[7,50]])('trade certificate uses minimum CLB %i and the published threshold', (minimum,points)=>{
    const p=alex();p.crsEvidence!.tradeCertificate='yes';p.crsEvidence!.english.reading=minimum;
    expect(completed(p).transferability.find(x=>x.id==='trade_transfer')?.points).toBe(points);
  });
  it.each([[17,0,0],[18,90,99],[19,95,105],[20,100,110],[29,100,110],[30,95,105],[31,90,99],[40,45,50],[41,35,39],[44,5,6],[45,0,0]])('age boundary %i uses published spouse/single points', (age,w,s)=>{expect(agePoints(age,true)).toBe(w);expect(agePoints(age,false)).toBe(s);});
  it.each([[3,0,0],[4,6,6],[5,6,6],[6,8,9],[7,16,17],[8,22,23],[9,29,31],[10,32,34],[12,32,34]])('first-language boundary CLB %i is per ability', (level,w,s)=>{expect(firstLanguagePoints(level,true)).toBe(w);expect(firstLanguagePoints(level,false)).toBe(s);});
  it.each([[0,0,0],[1,35,40],[2,46,53],[3,56,64],[4,63,72],[5,70,80],[6,70,80]])('work duration %i caps at five years', (n,w,s)=>{expect(workDurationPoints(n,true)).toBe(w);expect(workDurationPoints(n,false)).toBe(s);});
  it('uses minimum, not average, for transferability',()=>{
    const p=single();p.crsEvidence!.english.writing=6;const r=completed(p);
    expect(r.transferability.find(x=>x.id==='education_transfer')?.points).toBe(13);
    expect(r.transferability.find(x=>x.id==='foreign_transfer')?.points).toBe(25);
  });
  it('caps second language at 22 with spouse and 24 without; French mixed English4/5 still gets25',()=>{
    const p=alex();p.crsEvidence!.french={...lang(9),test:'TEF-Canada'};
    expect(completed(p).core.find(x=>x.id==='second_language')?.points).toBe(22);
    p.spouseAccompanying='no';expect(completed(p).core.find(x=>x.id==='second_language')?.points).toBe(24);
    p.crsEvidence!.english={...lang(5),reading:4};expect(completed(p).additional.find(x=>x.id==='french_bonus')?.points).toBe(25);
  });
  it('caps transferability at100 even with a certificate and additional points at600',()=>{
    const p=alex();p.crsEvidence!.tradeCertificate='yes';p.crsEvidence!.nomination='yes';p.crsEvidence!.eligibleSibling='yes';const r=completed(p);
    expect(r.transferability.reduce((n,v)=>n+v.points,0)).toBe(150);expect(r.totals.transferability).toBe(100);expect(r.totals.additional).toBe(600);
  });
  it('holds a projection whose value depends on the unresolved new overall-cap boundary',()=>{
    const p=single(2);p.noc='20012';p.crsEvidence!.education.level='doctoral';p.crsEvidence!.english=lang(12);p.crsEvidence!.french={...lang(12),test:'TEF-Canada'};p.crsEvidence!.nomination='yes';
    const r=calculateCrs(p,asOf);expect(r.status).toBe('needs_information');if(r.status==='needs_information')expect(r.reasons.join(' ')).toContain('overall');
  });
  it.each(['completeEvidenceReviewed','foreignWork','language','education','spouse','offer','dates','overlap','stale'] as const)('holds unknown, contradictory or stale %s evidence', field=>{
    const p=alex(),e=p.crsEvidence!;
    if(field==='completeEvidenceReviewed')e.completeEvidenceReviewed='unknown';
    if(field==='foreignWork')e.foreignWork.eligibilityReviewed='unknown';
    if(field==='language')e.english.reading=null;
    if(field==='education')e.education.level='unknown';
    if(field==='spouse')e.spouseCitizenOrPermanentResident='unknown';
    if(field==='offer')e.offer.status='unknown';
    if(field==='dates')p.arrivedInCanada='2026-10-01';
    if(field==='overlap')e.foreignWork.end='2024-01-01';
    if(field==='stale')e.reviewedForDate='2026-10-24';
    expect(calculateCrs(p,asOf).status).toBe('needs_information');
  });
  it.each([['english','2024-10-25'],['education','2021-10-25']] as const)('holds expired %s at the exact anniversary', (field,date)=>{
    const p=alex();if(field==='english')p.crsEvidence!.english.date=date;else p.crsEvidence!.education.ecaDate=date;
    expect(calculateCrs(p,asOf).status).toBe('needs_information');
  });
  it('holds future tests, unsupported language-test type, unknown optional factors and offer contradictions',()=>{
    for(const mutate of [(p:DemoProfile)=>{p.crsEvidence!.english.date='2027-01-01';},(p:DemoProfile)=>{p.crsEvidence!.english.test='TEF-Canada';},(p:DemoProfile)=>{p.crsEvidence!.nomination='unknown';},(p:DemoProfile)=>{p.qualifyingExpressEntryOffer='not_reviewed';}]){const p=alex();mutate(p);expect(calculateCrs(p,asOf).status).toBe('needs_information');}
  });
  it('does not convert missing optional evidence to zero or mutate legacy profiles',()=>{
    const digest=demoDigest(demoSeed);expect(calculateCrs(demoSeed,asOf).status).toBe('needs_information');expect(demoDigest(demoSeed)).toBe(digest);
  });
  it('does not accelerate an eleven-month interval using overtime and supports explicit no-work evidence',()=>{
    const p=single();p.workStart='2024-11-01';p.weeklyHours=100;p.crsEvidence!.foreignWork={...noWork};p.crsEvidence!.spouse.language={...noLanguage};const r=completed(p);
    expect(r.labourMarket.workDuration).toBe(0);expect(r.labourMarket.highWageBonus).toBe(0);
  });
  it('resolves policy timing without changing the facts used by either side',()=>{
    const p=alex();p.crsEvidence!.reviewedForDate='2026-11-03';const r=calculateCrs(p,'2026-11-03');expect(r.status).toBe('complete');if(r.status==='complete'){expect(r.projected).toBe(false);expect([r.before,r.after]).toEqual([521,561]);}
  });
});
