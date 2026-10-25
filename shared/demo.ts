import { z } from 'zod';
import { policyDateSchema } from './policy.js';

const answer = z.enum(['yes', 'no', 'unknown']);
export const demoProfileSchema = z.strictObject({
  fictional: z.literal(true), name: z.string().trim().min(1).max(80),
  arrivedInCanada: policyDateSchema, permitExpiry: policyDateSchema,
  spousePermitExpiry: policyDateSchema.nullable(), currentStatusValid: answer,
  employer: z.string().trim().min(1).max(160), jobTitle: z.string().trim().min(1).max(160),
  canadianOffer: answer, reciprocalProgramReported: answer,
  reciprocalEvidence: z.enum(['not_requested', 'promised', 'documents_available', 'unknown']),
  employerPortalOffer: answer, spouseAccompanying: answer,
  workStart: policyDateSchema, weeklyHours: z.number().positive().max(168),
  noc: z.string().regex(/^\d{5}$/), duties: z.string().trim().min(20).max(3000), nocReviewed: z.boolean(),
  physicallyCanada: answer, authorizedWork: answer, paidEmployee: answer,
  fullTimeStudy: answer, selfEmployed: answer,
  qualifyingExpressEntryOffer: z.enum(['none_reviewed', 'not_reviewed']),
});
export type DemoProfile = z.infer<typeof demoProfileSchema>;
export type DemoReceipt = { factId: string; digest: string };
export type DemoSnapshot = { revision: number; profile: DemoProfile | null; verified: boolean };
export type SourceEvidence = { id: string; title: string; url: string; bodySha256: string; retrievedAt: string; reviewedAt: string; publishedAt?: string; effectiveFrom?: string };
export type Discovery = {
  kind: 'c20' | 'express_entry'; title: string; status: 'potential_pathway' | 'needs_information' | 'not_supported' | 'projected_component';
  summary: string; reasons: string[]; outstanding: string[]; nextSteps: string[];
  sources: SourceEvidence[]; assessmentDate: string; profileRevision: number;
  score?: { scope: 'canadian_work_component'; before: number; after: number; delta: number; effectiveFrom: string; totalCrs: null; conditional: boolean };
};
export type JourneyEvent = { id: string; kind: 'discovery' | 'policy_update'; createdAt: string; status: 'completed' | 'processing' | 'uncertain' | 'not_sent'; profileRevision: number; discovery?: Discovery; reply?: string; explanationStatus?: 'available' | 'withheld'; explanationReason?: string; sessionId?: string; traceId?: string; replay?: boolean };

/** Deliberate, editable fictional seed; findings are calculated separately. */
export const demoSeed: DemoProfile = {
  fictional: true, name: 'Avery Demo', arrivedInCanada: '2021-09-01', permitExpiry: '2027-01-15', spousePermitExpiry: '2027-01-15', currentStatusValid: 'yes',
  employer: 'Northstar Systems Canada (fictional)', jobTitle: 'Business systems specialist',
  canadianOffer: 'yes', reciprocalProgramReported: 'yes', reciprocalEvidence: 'promised', employerPortalOffer: 'unknown', spouseAccompanying: 'yes',
  workStart: '2024-01-15', weeklyHours: 40, noc: '21221',
  duties: 'Analyze business requirements, document information-system processes, advise on solutions and coordinate acceptance testing. This is a fictional role; NOC duties are reviewed only for this demonstration.', nocReviewed: true,
  physicallyCanada: 'yes', authorizedWork: 'yes', paidEmployee: 'yes', fullTimeStudy: 'no', selfEmployed: 'no', qualifyingExpressEntryOffer: 'none_reviewed',
};
