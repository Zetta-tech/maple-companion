import { createHash } from 'node:crypto';
import { PolicyRegistry, policyDigest } from '../../server/policies.js';
import type { PolicyVersion } from '../../shared/policy.js';

/** Synthetic test policy, not real immigration guidance. Never loaded by runtime. */
export function makeTestPolicy(overrides: Partial<PolicyVersion> = {}): PolicyVersion {
  const body = 'Synthetic test policy, not real immigration guidance. For automated tests only: paid work is yes and weekly hours are at least 23.5. The threshold is arbitrary.';
  return {
    id: 'synthetic-test-policy', version: 'test-v1', program: 'Synthetic test program',
    title: 'Synthetic test policy, not real immigration guidance',
    effectiveFrom: '2026-01-01', effectiveTo: null,
    source: {
      url: 'https://www.canada.ca/synthetic-test-fixture-not-real-guidance', body,
      bodySha256: createHash('sha256').update(body, 'utf8').digest('hex'),
      retrievedAt: '2026-09-01T12:00:00.000Z',
    },
    review: { status: 'reviewed', reviewerId: 'automated-test-reviewer', reviewedAt: '2026-09-02T12:00:00.000Z' },
    criteria: [
      { id: 'test-paid', title: 'Synthetic paid-work criterion', kind: 'answer_equals', field: 'paid', expected: 'yes' },
      { id: 'test-hours', title: 'Synthetic arbitrary-hours criterion', kind: 'number_gte', field: 'hoursPerWeek', minimum: 23.5 },
    ],
    ...overrides,
  };
}

/** Approval is explicit even for test fixtures; reviewed metadata alone is insufficient. */
export function registryFor(...policies: PolicyVersion[]): PolicyRegistry {
  return new PolicyRegistry(policies, policies.map(policyDigest));
}

export const syntheticPolicy = makeTestPolicy;
