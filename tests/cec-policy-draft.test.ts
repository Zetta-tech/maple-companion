import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PolicyRegistry, policyDigest } from '../server/policies.js';
import { policyVersionSchema } from '../shared/policy.js';

describe('official-source CEC candidate remains an inactive review artifact', () => {
  const candidate = JSON.parse(readFileSync(new URL('../policy-drafts/cec-work-experience.candidate.json', import.meta.url), 'utf8'));
  const review = JSON.parse(readFileSync(new URL('../policy-drafts/cec-source-review.json', import.meta.url), 'utf8'));
  it('validates the exact source hash and exposes the same reviewable content digest', () => {
    expect(policyVersionSchema.parse(candidate).review).toEqual({ status: 'draft', reviewerId: null, reviewedAt: null });
    expect(policyDigest(candidate)).toBe(review.contentDigest);
    expect(candidate.effectiveFrom).toBe('2022-11-16');
    expect(review.dateBasis.evidence).toContain('section 10');
  });
  it('cannot run from a draft even if someone supplies its digest alone', () => {
    expect(new PolicyRegistry([candidate], [policyDigest(candidate)]).available('2026-10-25')).toEqual([]);
    expect(new PolicyRegistry().available('2026-10-25')).toEqual([]);
    expect(review.activated).toBe(false);
    expect(review.operatorApprovalRecorded).toBe(false);
  });
});
