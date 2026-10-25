import { z } from 'zod';
import { policyDateSchema } from './policy.js';
export const CRS_POLICY_VERSION='2026-11-03.fictional-reviewed-evidence.v2';

const answer = z.enum(['yes','no','unknown']);
export const educationLevels = ['less_secondary','secondary','one_year','two_year','bachelors','two_or_more','masters_professional','doctoral'] as const;
export const educationEvidenceSchema = z.strictObject({
  level:z.enum([...educationLevels,'unknown']), basis:z.enum(['canadian','foreign_eca','not_claimed','unknown']),
  ecaDate:policyDateSchema.nullable(), qualificationReviewed:answer,
});
export const languageEvidenceSchema = z.strictObject({
  status:z.enum(['tested','not_taken','unknown']),
  test:z.enum(['CELPIP-General','IELTS-General','PTE-Core','TEF-Canada','TCF-Canada']).nullable(),
  date:policyDateSchema.nullable(),
  reading:z.number().int().min(0).max(12).nullable(),writing:z.number().int().min(0).max(12).nullable(),
  listening:z.number().int().min(0).max(12).nullable(),speaking:z.number().int().min(0).max(12).nullable(),
  benchmarkConversionReviewed:answer,
});
export const workIntervalSchema=z.strictObject({status:z.enum(['recorded','none','unknown']),start:policyDateSchema.nullable(),end:policyDateSchema.nullable(),
  weeklyHours:z.number().positive().max(168).nullable(),noc:z.string().regex(/^\d{5}$/).nullable(),eligibilityReviewed:answer});
/** Dated, explicitly reviewed scoring evidence. Unknown is never assigned zero. */
export const crsEvidenceSchema = z.strictObject({
  version:z.literal(1),reviewedForDate:policyDateSchema,completeEvidenceReviewed:answer,specialCases:answer,dateOfBirth:policyDateSchema.nullable(),
  education:educationEvidenceSchema, firstLanguage:z.enum(['english','french','unknown']),
  english:languageEvidenceSchema,french:languageEvidenceSchema,
  canadianWorkEnd:policyDateSchema.nullable(),
  // Optional on read for old receipt compatibility; absence is unknown to scoring.
  canadianEmployer:answer.optional(),
  spouseCitizenOrPermanentResident:answer,
  spouse:z.strictObject({education:educationEvidenceSchema,language:languageEvidenceSchema,languageName:z.enum(['english','french','unknown']),
    canadianWork:workIntervalSchema}),
  foreignWork:workIntervalSchema,
  tradeCertificate:answer,tradeCertificateEligibilityReviewed:answer,
  canadianEducation:z.enum(['none','one_or_two_year','three_year_or_eligible_graduate','unknown']),canadianEducationEligibilityReviewed:answer,
  eligibleSibling:answer,siblingEligibilityReviewed:answer,
  nomination:answer,nominationEligibilityReviewed:answer,
  offer:z.strictObject({status:z.enum(['none','qualifying','unknown']),noc:z.string().regex(/^\d{5}$/).nullable(),
    novemberRulesReviewed:answer,genuineOfferEvidenceReviewed:answer}),
});
export type CrsEvidence=z.infer<typeof crsEvidenceSchema>;
export type EducationEvidence=z.infer<typeof educationEvidenceSchema>;
export type LanguageEvidence=z.infer<typeof languageEvidenceSchema>;
export type WorkInterval=z.infer<typeof workIntervalSchema>;
export type CrsLine={id:string;label:string;points:number};
export type CrsCalculation={status:'complete';asOf:string;policyVersion:string;effectiveFrom:string;projected:boolean;
  before:number;after:number;delta:number;core:CrsLine[];spouse:CrsLine[];transferability:CrsLine[];additional:CrsLine[];
  totals:{core:number;spouse:number;transferability:number;additional:number};
  labourMarket:{workDuration:number;highWageBonus:number;workAlternative:number;offerAlternative:number;selected:number;selectedAlternative:'work'|'offer'|'tie'};
  assumptions:string[];
}|{status:'needs_information';reasons:string[]};

export const noLanguage:LanguageEvidence={status:'not_taken',test:null,date:null,reading:null,writing:null,listening:null,speaking:null,benchmarkConversionReviewed:'no'};
export const noWork:WorkInterval={status:'none',start:null,end:null,weeklyHours:null,noc:null,eligibilityReviewed:'yes'};
const english=(level:number):LanguageEvidence=>({status:'tested',test:'CELPIP-General',date:'2026-07-01',reading:level,writing:level,listening:level,speaking:level,benchmarkConversionReviewed:'yes'});
/** Offered only by an explicit UI action, then reviewed in the exact profile proposal. */
export function fictionalCrsEvidence(asOf:string):CrsEvidence {
  return {version:1,reviewedForDate:asOf,completeEvidenceReviewed:'unknown',specialCases:'no',dateOfBirth:'1995-04-15',
    education:{level:'masters_professional',basis:'canadian',ecaDate:null,qualificationReviewed:'yes'},
    firstLanguage:'english',english:english(9),french:{...noLanguage},canadianWorkEnd:null,canadianEmployer:'yes',spouseCitizenOrPermanentResident:'no',
    spouse:{education:{level:'bachelors',basis:'foreign_eca',ecaDate:'2025-06-01',qualificationReviewed:'yes'},language:english(8),languageName:'english',canadianWork:{...noWork}},
    foreignWork:{status:'recorded',start:'2018-08-01',end:'2021-07-31',weeklyHours:30,noc:'21221',eligibilityReviewed:'yes'},tradeCertificate:'no',tradeCertificateEligibilityReviewed:'yes',
    canadianEducation:'three_year_or_eligible_graduate',canadianEducationEligibilityReviewed:'yes',eligibleSibling:'no',siblingEligibilityReviewed:'yes',
    nomination:'no',nominationEligibilityReviewed:'yes',offer:{status:'none',noc:null,novemberRulesReviewed:'yes',genuineOfferEvidenceReviewed:'no'}};
}
