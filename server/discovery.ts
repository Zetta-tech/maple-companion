import type { DemoProfile, Discovery, SourceEvidence } from '../shared/demo.js';
import {calculateCrs} from './crs.js';
import {crsRuleSourceHashes} from './crs-sources.js';
const days = (from: string, to: string) => Math.floor((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000);

/** Reviewed conditions, not a language parser, brand lookup or eligibility decision. */
export function discoverC20(profile: DemoProfile, date: string, revision: number, sources: SourceEvidence[]): Discovery {
  const remaining = days(date, profile.permitExpiry);
  const reasons = [`Your recorded work permit expires on ${profile.permitExpiry} (${remaining >= 0 ? `${remaining} days remaining` : `${-remaining} days ago`}).`];
  if (profile.spousePermitExpiry) reasons.push(`Your spouse's recorded permit expires on ${profile.spousePermitExpiry}; their options require a separate assessment.`);
  const outstanding: string[] = [];
  if (profile.canadianOffer !== 'yes') outstanding.push('Confirm a genuine Canadian offer of employment; C20 cannot be established from expiry or employer name alone.');
  if (profile.reciprocalProgramReported !== 'yes') outstanding.push('Ask whether the employer creates or maintains reciprocal opportunities abroad for Canadian citizens or permanent residents.');
  else reasons.push(`You reported that ${profile.employer} operates an international reciprocal-employment program. This makes an employer-backed C20 inquiry relevant.`);
  if (profile.reciprocalEvidence !== 'documents_available') outstanding.push('Obtain the employer’s mobility policy, explanation and supporting exchange records. A reported program or promised letter is not verified reciprocity.');
  else outstanding.push('Have the reciprocal-employment documents assessed for genuine, reasonably comparable opportunities, including duration and job level.');
  if (profile.employerPortalOffer !== 'yes') outstanding.push('Confirm employer participation, the appropriate Employer Portal offer and normally the employer compliance fee before an application.');
  if (profile.currentStatusValid !== 'yes' || remaining < 0) outstanding.push('Confirm current immigration status and where an application may be made before relying on any continued work authorization.');
  outstanding.push('Verify occupation requirements, any licensing/medical requirements, admissibility and application location. Maple has not established eligibility.');
  if (profile.spousePermitExpiry) outstanding.push('Assess the spouse separately under the applicable family work-permit rules; a proposed offer does not guarantee an approved permit or its duration.');
  const potential = profile.canadianOffer === 'yes' && profile.reciprocalProgramReported === 'yes';
  const unsupported = profile.canadianOffer === 'no' || profile.reciprocalProgramReported === 'no';
  return { kind: 'c20', title: potential ? 'A reciprocal-employment route to investigate' : 'Employer evidence is needed before a C20 lead',
    status: potential ? 'potential_pathway' : unsupported ? 'not_supported' : 'needs_information',
    summary: potential ? 'C20 may be worth investigating with your employer. The link is the reported reciprocal program and Canadian offer—not the company name or permit expiry.' : 'The saved profile does not yet support surfacing C20 as a personalized possibility. Complete the employer and reciprocity checks first.',
    reasons, outstanding, nextSteps: ['Ask HR for an explanation of opportunities abroad for Canadians or permanent residents and the evidence supporting that program.', 'Verify the offer, duties, status and employer submission requirements with a qualified immigration professional before applying.', 'Review your spouse’s situation separately and plan around both expiry dates.'],
    sources, assessmentDate: date, profileRevision: revision };
}

/** Only the reviewed Canadian-work component; no invented full CRS baseline. */
export function projectExpressEntry(profile: DemoProfile, date: string, revision: number, sources: SourceEvidence[]): Discovery {
  const effectiveFrom = '2026-11-03';
  const base: Discovery = { kind:'express_entry',title:'An official Express Entry change may affect your work points',status:'needs_information',
    summary:'A total CRS score cannot be calculated from this demo profile.',reasons:[],outstanding:[],nextSteps:['Review all CRS inputs and any qualifying offer separately before relying on a total score.'],sources,assessmentDate:date,profileRevision:revision };
  if(profile.crsEvidence){
    if(!Object.entries(crsRuleSourceHashes).every(([id,hash])=>sources.some(s=>s.id===id&&s.bodySha256===hash)))return {...base,outstanding:['The full-score calculation needs the complete reviewed source set matching this calculator version.']};
    const crs=calculateCrs(profile,date);
    if(crs.status==='needs_information')return {...base,crs,outstanding:crs.reasons};
    return {...base,crs,status:'projected_total',title:crs.projected?'An announced-policy projection of your fictional CRS':'A same-profile CRS policy comparison',
      summary:`Using the identical reviewed fictional profile and ${date} assessment date, the total is ${crs.before} under the pre-November rules and ${crs.after} under the announced November 3 rules. This is not a certified future score or an eligibility decision.`,
      reasons:[...crs.assumptions,`Labour Market Integration selects ${crs.labourMarket.selected} points: the higher of work ${crs.labourMarket.workAlternative} and offer ${crs.labourMarket.offerAlternative}.`,`Transferability continues to use actual Canadian work duration, including when the offer alternative wins.`],
      outstanding:['The overall maximum under the announced allocation remains unresolved in available governing material. This projection stays below that disputed boundary; higher-score cases are withheld.','Retest against the governing rules and official calculator when the November policy is live.'],
      nextSteps:['Inspect each subtotal and the approved fictional evidence.','Update and confirm any missing or changed evidence before re-running; no real account or application is modified.']};
  }
  const knownConditions = profile.nocReviewed && ['21221','21223'].includes(profile.noc)
    && profile.physicallyCanada === 'yes' && profile.authorizedWork === 'yes' && profile.paidEmployee === 'yes'
    && profile.fullTimeStudy === 'no' && profile.selfEmployed === 'no' && profile.spouseAccompanying !== 'unknown';
  if (profile.workStart < profile.arrivedInCanada) return { ...base, outstanding:['The work interval begins before the recorded arrival in Canada. Clarify whether this arrival is a later re-entry and document any earlier Canadian stay, or correct the dates. This single-interval calculation cannot resolve that history; no score was calculated.'] };
  if (!knownConditions || profile.workStart > date) return { ...base, outstanding:['Qualifying occupation, duties, Canadian work conditions, spouse status or dates still need review. No score delta was inferred.'] };
  const elapsed = days(profile.workStart, date);
  const calendarYears = Number(date.slice(0,4)) - Number(profile.workStart.slice(0,4)) - (date.slice(5) < profile.workStart.slice(5) ? 1 : 0);
  const hours = Math.floor(elapsed / 7) * Math.min(30, profile.weeklyHours);
  // Narrow consistent single-interval calculation. No acceleration by overtime.
  const qualifyingYears = Math.min(5,calendarYears,Math.floor(hours / 1560));
  if (qualifyingYears < 1 || elapsed > 3653 || profile.workStart.slice(5) === '02-29') return { ...base,outstanding:['This consistent work interval does not establish a supported qualifying year within the ten-year CRS window. Complex or date-boundary history needs review.'] };
  const before = (profile.spouseAccompanying === 'yes' ? [0,35,46,56,63,70] : [0,40,53,64,72,80])[qualifyingYears]!;
  const bonus = 40; // Reviewed occupation-median tier for 21221/21223, not individual salary.
  const conditional = profile.qualifyingExpressEntryOffer !== 'none_reviewed';
  return { ...base, status:'projected_component',title:date < effectiveFrom ? 'A future change to your Canadian-work component' : 'A change to your Canadian-work component',
    summary:`Using the same ${date} profile, the Canadian-work component would move from ${before} to ${before + bonus}. This is not a total CRS calculation.`,
    reasons:[`Your explicitly reviewed fictional NOC ${profile.noc} is listed in the occupation-median 1.5× to below 2× tier.`, `${qualifyingYears} completed qualifying year(s) were established conservatively with a maximum 30 hours per week.`, `The announcement is dated October 16, 2026 and takes effect November 3, 2026${date < effectiveFrom ? '; it is not active on the assessment date' : ''}.`, 'Both calculations use the same profile and assessment date, so anniversaries do not create the policy difference.'],
    outstanding:[...(conditional ? ['A qualifying-offer alternative remains unreviewed. The new Labour Market Integration component takes the higher alternative, not their sum; the final difference may therefore differ.'] : ['The fictional profile explicitly records no qualifying Express Entry offer; a C20-related offer is not automatically such an offer.']), 'Age, languages, education, spouse factors, transferability and other additional points are not fully recorded. Previous and updated total CRS remain unknown.'],
    score:{scope:'canadian_work_component',before,after:before+bonus,delta:bonus,effectiveFrom,totalCrs:null,conditional} };
}
