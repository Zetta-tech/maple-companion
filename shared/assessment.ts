import type { PolicyCriterionResult } from './policy.js';

/** Private derived output and provenance, never a copy of canonical personal facts. */
export type AssessmentRecord = {
  id: string;
  ownerId: string;
  profileRevision: number;
  evidence: { factId: string; digest: string } | null;
  assessmentDate: string;
  createdAt: string;
  policy: { id: string; version: string; program: string; title: string; digest: string;
    sourceUrl: string; sourceBodySha256: string; effectiveFrom: string; effectiveTo: string | null };
  results: PolicyCriterionResult[];
};
export type AssessmentView = Omit<AssessmentRecord, 'ownerId' | 'evidence'> & {
  freshness: 'current' | 'stale' | 'unverified';
};
