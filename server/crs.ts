import {CRS_POLICY_VERSION,crsEvidenceSchema,educationLevels,type CrsCalculation,type CrsLine,type EducationEvidence,type LanguageEvidence,type WorkInterval} from '../shared/crs.js';
import type {DemoProfile} from '../shared/demo.js';
import {occupationTier} from './crs-occupation-tiers.js';

export const crsPolicyVersion=CRS_POLICY_VERSION;
const abilities=['reading','writing','listening','speaking'] as const;
const sum=(rows:CrsLine[])=>rows.reduce((n,row)=>n+row.points,0);
const line=(id:string,label:string,points:number):CrsLine=>({id,label,points});
const years=(from:string,to:string)=>Number(to.slice(0,4))-Number(from.slice(0,4))-(to.slice(5)<from.slice(5)?1:0);
const days=(from:string,to:string)=>(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86_400_000;
const nextDay=(date:string)=>new Date(Date.parse(date+'T00:00:00Z')+86_400_000).toISOString().slice(0,10);
function intervalYears(w:WorkInterval,label:string,asOf:string,issues:string[],cap:number):number {
  if(w.status==='unknown'||w.eligibilityReviewed!=='yes'){issues.push(`${label}: review eligibility and whether any qualifying interval exists.`);return 0;}
  if(w.status==='none'){
    if(w.start!==null||w.end!==null||w.noc!==null||w.weeklyHours!==null)issues.push(`${label}: no work is claimed but interval details are present.`);
    return 0;
  }
  if(!w.start||!w.noc||!w.weeklyHours||!/[0-3]/.test(w.noc[1]!)){issues.push(`${label}: provide one reviewed skilled NOC, start date and weekly hours.`);return 0;}
  const windowStart=String(Number(asOf.slice(0,4))-10)+asOf.slice(4);
  if(w.start>asOf||w.end&&w.end>asOf||w.end&&w.end<w.start||w.start.slice(5)==='02-29'||w.start<windowStart){issues.push(`${label}: review dates within the ten-year window; complex or boundary history is not supported.`);return 0;}
  const through=w.end?nextDay(w.end):asOf;
  return Math.max(0,Math.min(cap,years(w.start,through),Math.floor(Math.floor(days(w.start,through)/7)*Math.min(30,w.weeklyHours)/1560)));
}

export function agePoints(age:number,withSpouse:boolean):number {
  if(age<18||age>=45)return 0;
  if(age<=19)return (withSpouse?[90,95]:[99,105])[age-18]!;
  if(age<=29)return withSpouse?100:110;
  return (withSpouse?[95,90,85,80,75,70,65,60,55,50,45,35,25,15,5]:[105,99,94,88,83,77,72,66,61,55,50,39,28,17,6])[age-30]!;
}
export function firstLanguagePoints(level:number,withSpouse:boolean):number {
  if(level<4)return 0;if(level<=5)return 6;
  return (withSpouse?[8,16,22,29,32]:[9,17,23,31,34])[Math.min(level,10)-6]!;
}
export const secondLanguagePoints=(level:number)=>level<5?0:level<7?1:level<9?3:6;
export const spouseLanguagePoints=(level:number)=>level<5?0:level<7?1:level<9?3:5;
export const workDurationPoints=(completedYears:number,withSpouse:boolean)=>(withSpouse?[0,35,46,56,63,70]:[0,40,53,64,72,80])[Math.min(completedYears,5)]!;

function education(e:EducationEvidence,label:string,asOf:string,issues:string[]):number {
  if(e.level==='unknown'||e.basis==='unknown'||e.qualificationReviewed!=='yes'){issues.push(`${label}: review the completed credential and qualifying equivalency/category.`);return 0;}
  if(e.basis==='not_claimed'&&e.level!=='less_secondary')issues.push(`${label}: a credential is recorded but its qualification is not claimed; resolve the conflict.`);
  if(e.basis==='foreign_eca'&&(!e.ecaDate||e.ecaDate>asOf||years(e.ecaDate,asOf)>=5))issues.push(`${label}: a qualifying immigration ECA must be dated in the past and less than five years old.`);
  if(e.basis!=='foreign_eca'&&e.ecaDate!==null)issues.push(`${label}: remove the conflicting ECA date or select foreign education.`);
  return educationLevels.indexOf(e.level);
}
function language(e:LanguageEvidence,name:'english'|'french',label:string,asOf:string,issues:string[]):number[] {
  if(e.status==='unknown'){issues.push(`${label}: language evidence is unknown.`);return [0,0,0,0];}
  if(e.status==='not_taken'){
    if(e.test!==null||e.date!==null||abilities.some(a=>e[a]!==null))issues.push(`${label}: no test is claimed but test details are still present.`);
    return [0,0,0,0];
  }
  const allowed=name==='english'?['CELPIP-General','IELTS-General','PTE-Core']:['TEF-Canada','TCF-Canada'];
  if(!e.test||!allowed.includes(e.test))issues.push(`${label}: select an accepted test for this language.`);
  if(!e.date||e.date>asOf||years(e.date,asOf)>=2)issues.push(`${label}: test results must be less than two years old on the assessment date.`);
  if(e.benchmarkConversionReviewed!=='yes'||abilities.some(a=>e[a]===null))issues.push(`${label}: review all four CLB/NCLC conversions from the accepted test.`);
  return abilities.map(a=>e[a]??0);
}

export function calculateCrs(profile:DemoProfile,asOf:string):CrsCalculation {
  const parsed=crsEvidenceSchema.safeParse(profile.crsEvidence);
  if(!parsed.success)return {status:'needs_information',reasons:['Complete the optional CRS evidence section before requesting a total score.']};
  const e=parsed.data,issues:string[]=[];
  if(e.completeEvidenceReviewed!=='yes'||e.reviewedForDate!==asOf)issues.push('Review every scoring factor for this exact assessment date. The stored evidence is not a current complete review.');
  if(e.specialCases!=='no')issues.push('Special exceptions, complex work histories or unusual credential/test cases need separate source review before a total can be calculated.');
  if(!e.dateOfBirth||e.dateOfBirth>asOf)issues.push('Provide a valid date of birth before the assessment date.');
  if(e.dateOfBirth){
    // These dates describe the applicant. Spouse evidence belongs to a different
    // person and must not be compared with the applicant's birth date.
    const applicantDates:ReadonlyArray<readonly [string,string|null]>=[
      ['Arrival in Canada',profile.arrivedInCanada],['Canadian work start',profile.workStart],['Canadian work end',e.canadianWorkEnd],
      ['Foreign work start',e.foreignWork.start],['Foreign work end',e.foreignWork.end],
      ['English test',e.english.date],['French test',e.french.date],['Applicant ECA',e.education.ecaDate],
    ];
    for(const [label,date] of applicantDates)if(date&&date<e.dateOfBirth)issues.push(`${label} is before the applicant’s date of birth. Reconcile these dates before calculating a total.`);
  }
  if(profile.spouseAccompanying==='unknown')issues.push('Confirm whether a spouse accompanies the applicant.');
  if(profile.spouseAccompanying==='yes'&&e.spouseCitizenOrPermanentResident==='unknown')issues.push('Confirm whether the accompanying spouse is a Canadian citizen or permanent resident.');
  const withSpouse=profile.spouseAccompanying==='yes'&&e.spouseCitizenOrPermanentResident==='no';
  const educationRank=education(e.education,'Applicant education',asOf,issues);
  const english=language(e.english,'english','English',asOf,issues),french=language(e.french,'french','French',asOf,issues);
  if(e.firstLanguage==='unknown'||(e.firstLanguage==='english'?e.english:e.french).status!=='tested')issues.push('Select a tested first official language.');
  const first=e.firstLanguage==='french'?french:english,second=e.firstLanguage==='french'?english:french;
  let workYears=0;
  if(!profile.nocReviewed||!/[0-3]/.test(profile.noc[1]!))issues.push('Review a valid skilled NOC and matching duties before counting Canadian work.');
  if(profile.physicallyCanada!=='yes'||profile.authorizedWork!=='yes'||profile.paidEmployee!=='yes'||profile.fullTimeStudy!=='no'||profile.selfEmployed!=='no')issues.push('Review the qualifying Canadian work conditions; unknown or excluded periods cannot be counted.');
  if(e.canadianEmployer!=='yes')issues.push('Confirm the recorded Canadian work was for a Canadian employer throughout. Physical presence in Canada alone is not sufficient.');
  if(profile.workStart>asOf||profile.workStart<profile.arrivedInCanada||days(profile.workStart,asOf)>3653||profile.workStart.slice(5)==='02-29')issues.push('Review the Canadian work dates and any earlier stays. Only one consistent interval within ten years is supported.');
  else workYears=intervalYears({status:'recorded',start:profile.workStart,end:e.canadianWorkEnd,weeklyHours:profile.weeklyHours,noc:profile.noc,eligibilityReviewed:'yes'},'Applicant Canadian work',asOf,issues,5);
  const foreignYears=intervalYears(e.foreignWork,'Foreign work',asOf,issues,3);
  if(e.foreignWork.status==='recorded'&&e.foreignWork.start&&e.foreignWork.start<=(e.canadianWorkEnd??asOf)&&(e.foreignWork.end??asOf)>=profile.workStart)issues.push('Foreign and Canadian work intervals overlap. Review physical location and qualifying time instead of double counting.');
  for(const [value,review,label] of [[e.tradeCertificate,e.tradeCertificateEligibilityReviewed,'trade certificate'],[e.eligibleSibling,e.siblingEligibilityReviewed,'eligible sibling'],[e.nomination,e.nominationEligibilityReviewed,'provincial nomination']] as const){
    if(value==='unknown'||review!=='yes')issues.push(`Review the ${label} answer and applicable qualifications, including an explicit no when absent.`);
  }
  if(e.canadianEducation==='unknown'||e.canadianEducationEligibilityReviewed!=='yes')issues.push('Review Canadian-study bonus eligibility separately from the education credential.');
  if(e.canadianEducation!=='none'&&e.canadianEducation!=='unknown'&&educationRank<2)issues.push('Canadian post-secondary study conflicts with the recorded highest education level.');
  if(e.canadianEducation==='three_year_or_eligible_graduate'&&educationRank<4)issues.push('The 30-point Canadian-study category conflicts with the recorded credential level.');
  if(e.offer.status==='unknown'||e.offer.novemberRulesReviewed!=='yes')issues.push('Review the qualifying-offer alternative under the November 3 rules.');
  if(e.offer.status==='none'&&(e.offer.noc!==null||profile.qualifyingExpressEntryOffer!=='none_reviewed'))issues.push('The CRS no-offer answer conflicts with the demo offer assessment.');
  if(e.offer.status==='qualifying'&&(!e.offer.noc||e.offer.genuineOfferEvidenceReviewed!=='yes'||profile.qualifyingExpressEntryOffer!=='reviewed_offer'))issues.push('Confirm the genuine qualifying offer, its reviewed NOC and matching offer assessment.');
  if(e.offer.status==='qualifying'&&profile.canadianOffer!=='yes')issues.push('The qualifying-offer claim conflicts with an absent or unconfirmed Canadian employment offer. Reconcile the offer answers before calculating a total.');

  const core=[line('age','Age',agePoints(e.dateOfBirth?years(e.dateOfBirth,asOf):0,withSpouse)),
    line('education','Education',(withSpouse?[0,28,84,91,112,119,126,140]:[0,30,90,98,120,128,135,150])[educationRank]!),
    line('first_language','First official language',first.reduce((n,v)=>n+firstLanguagePoints(v,withSpouse),0)),
    line('second_language','Second official language',Math.min(withSpouse?22:24,second.reduce((n,v)=>n+secondLanguagePoints(v),0))),
    line('canadian_work','Canadian work duration',workDurationPoints(workYears,withSpouse))];
  const spouse:CrsLine[]=[];
  if(withSpouse){
    const rank=education(e.spouse.education,'Spouse education',asOf,issues);
    if(e.spouse.languageName==='unknown')issues.push('Review the spouse language selection.');
    const levels=language(e.spouse.language,e.spouse.languageName==='french'?'french':'english','Spouse language',asOf,issues);
    const spouseYears=intervalYears(e.spouse.canadianWork,'Spouse Canadian work',asOf,issues,5);
    spouse.push(line('spouse_education','Spouse education',[0,2,6,7,8,9,10,10][rank]!),line('spouse_language','Spouse language',levels.reduce((n,v)=>n+spouseLanguagePoints(v),0)),line('spouse_work','Spouse Canadian work',[0,5,7,8,9,10][spouseYears]!));
  }
  const minFirst=Math.min(...first),strong=minFirst>=9,good=minFirst>=7;
  const advanced=educationRank>=5,postSecondary=educationRank>=2;
  const educationLanguage=!postSecondary||!good?0:advanced?(strong?50:25):(strong?25:13);
  const educationWork=!postSecondary||workYears<1?0:advanced?(workYears>=2?50:25):(workYears>=2?25:13);
  const foreign=foreignYears;
  const foreignLanguage=!foreign||!good?0:foreign>=3?(strong?50:25):(strong?25:13);
  const foreignCanada=!foreign||!workYears?0:foreign>=3?(workYears>=2?50:25):(workYears>=2?25:13);
  const transferability=[line('education_transfer','Education combinations (capped at 50)',Math.min(50,educationLanguage+educationWork)),
    line('foreign_transfer','Foreign-work combinations (capped at 50)',Math.min(50,foreignLanguage+foreignCanada)),
    line('trade_transfer','Trade certificate and language',e.tradeCertificate==='yes'?(minFirst>=7?50:minFirst>=5?25:0):0)];
  let frenchBonus=0;
  if(Math.min(...french)>=7){
    frenchBonus=Math.min(...english)>=5?50:25;
  }
  const additional=[line('sibling','Eligible sibling',e.eligibleSibling==='yes'?15:0),line('french_bonus','Additional French-language points',frenchBonus),
    line('canadian_study','Eligible Canadian education',e.canadianEducation==='one_or_two_year'?15:e.canadianEducation==='three_year_or_eligible_graduate'?30:0),line('nomination','Provincial nomination',e.nomination==='yes'?600:0)];
  const totals={core:sum(core),spouse:sum(spouse),transferability:Math.min(100,sum(transferability)),additional:Math.min(600,sum(additional))};
  const workDuration=workDurationPoints(workYears,withSpouse),highWageBonus=workYears>=1?occupationTier(profile.noc):0;
  const offerTier=e.offer.status==='qualifying'&&e.offer.noc?occupationTier(e.offer.noc):0;
  const offerAlternative=offerTier===70?100:offerTier===40?70:offerTier===20?50:0;
  const workAlternative=workDuration+highWageBonus,selected=Math.max(workAlternative,offerAlternative);
  const before=totals.core+totals.spouse+totals.transferability+totals.additional,after=before-workDuration+selected;
  // Public future guidance does not reconcile a new overall maximum. Do not guess at the high-score boundary.
  if(after>1200)issues.push('The projected score crosses the current overall CRS maximum; the November overall-cap rule needs authoritative review. No projected total is asserted.');
  if(issues.length)return {status:'needs_information',reasons:[...new Set(issues)]};
  return {status:'complete',asOf,policyVersion:crsPolicyVersion,effectiveFrom:'2026-11-03',projected:asOf<'2026-11-03',before,after,delta:after-before,core,spouse,transferability,additional,totals,
    labourMarket:{workDuration,highWageBonus,workAlternative,offerAlternative,selected,selectedAlternative:workAlternative===offerAlternative?'tie':workAlternative>offerAlternative?'work':'offer'},
    assumptions:['Fictional, manually reviewed scoring evidence for this date; documents were not independently authenticated.','One consistent interval per work category, one foreign NOC, no overlapping foreign/Canadian work; eligibility was explicitly reviewed.','Both policy versions use identical facts and date; no future birthdays, work anniversaries or new facts are assumed.','The calculation is not an Express Entry eligibility decision, invitation forecast or officer-approved score.']};
}
