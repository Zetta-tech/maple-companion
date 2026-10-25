import { z } from 'zod';
import { demoProfileSchema, type DemoProfile, type DemoReceipt } from './demo.js';
import { policyDateSchema } from './policy.js';

const answer = z.enum(['yes', 'no', 'unknown']);
/** Supplemental assessment evidence only. Employment is read from its existing receipt. */
export const personalIntakeSchema = demoProfileSchema.pick({
  canadianOffer:true, reciprocalProgramReported:true, reciprocalEvidence:true,
  employerPortalOffer:true, spouseAccompanying:true, currentStatusValid:true,
  qualifyingExpressEntryOffer:true, crsEvidence:true,
}).extend({
  fictional:z.literal(false), name:z.string().trim().min(1).max(80).nullable(),
  arrivedInCanada:policyDateSchema.nullable(), permitExpiry:policyDateSchema.nullable(),
  spousePermitExpiry:policyDateSchema.nullable(),
});
export type PersonalIntake = z.infer<typeof personalIntakeSchema>;
export const emptyPersonalIntake:PersonalIntake = {
  fictional:false,name:null,arrivedInCanada:null,permitExpiry:null,spousePermitExpiry:null,
  currentStatusValid:'unknown',canadianOffer:'unknown',reciprocalProgramReported:'unknown',
  reciprocalEvidence:'unknown',employerPortalOffer:'unknown',spouseAccompanying:'unknown',
  qualifyingExpressEntryOffer:'not_reviewed',
};
export const personalProfileSchema = personalIntakeSchema.extend({
  inputPurpose:z.literal('reviewed-assessment-inputs'),
  employmentBasis:z.strictObject({revision:z.number().int().positive(),receiptDigest:z.string().regex(/^[a-f0-9]{64}$/)}),
  employer:z.string().min(1).max(200),jobTitle:z.string().min(1).max(200),
  workStart:policyDateSchema,weeklyHours:z.number().positive().max(168).nullable(),
  noc:z.string().regex(/^\d{5}$/).nullable(),duties:z.string().max(10_000),nocReviewed:z.boolean(),
  physicallyCanada:answer,authorizedWork:answer,paidEmployee:answer,fullTimeStudy:answer,selfEmployed:answer,
  // This is an explicit qualifying interval, not today's hours applied to the past.
  intervalComplete:z.boolean(),
});
export type PersonalProfile = z.infer<typeof personalProfileSchema>;
export type GuideProfile = DemoProfile | PersonalProfile;
export type CompleteGuideProfile = Omit<DemoProfile,'fictional'> & {fictional:boolean};
export const completeGuideProfileSchema = demoProfileSchema.extend({fictional:z.boolean()}).strip();
export type GuidePurpose = 'maple-fictional-demo' | 'maple-personal-assessment';
export const guideProfileSchema = z.union([demoProfileSchema,personalProfileSchema]);
export type GuideSnapshot = {revision:number;profile:GuideProfile|null;verified:boolean;reviewRequired?:boolean};
export type PersonalGuideSnapshot = {
  revision:number;profile:PersonalProfile|null;verified:boolean;reviewRequired:boolean;
  intake:PersonalIntake;employmentRevision:number;
};
export type GuideReceipt = DemoReceipt;
