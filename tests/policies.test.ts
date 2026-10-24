import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PolicyRegistry, evaluatePolicy, policyDigest } from '../server/policies.js';
import type { Employment } from '../shared/employment.js';
import { policyVersionSchema, type PolicyVersion } from '../shared/policy.js';

const body = 'SYNTHETIC TEST POLICY. These test predicates are not immigration requirements.';
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const date = '2026-10-24';
const sample = (): PolicyVersion => ({
  id: 'test-only', version: 'v1', program: 'Synthetic test program', title: 'Synthetic test predicates',
  effectiveFrom: '2026-01-01', effectiveTo: null,
  source: { url: 'https://www.canada.ca/synthetic-test-policy', body, bodySha256: sha(body), retrievedAt: '2026-01-01T00:00:00Z' },
  review: { status: 'reviewed', reviewerId: 'test-reviewer', reviewedAt: '2026-01-02T00:00:00Z' },
  criteria: [
    { id: 'paid', title: 'Synthetic paid-answer predicate', kind: 'answer_equals', field: 'paid', expected: 'yes' },
    { id: 'authorized', title: 'Synthetic authorization-answer predicate', kind: 'answer_equals', field: 'authorizedToWork', expected: 'yes' },
    { id: 'hours', title: 'Synthetic numeric predicate', kind: 'number_gte', field: 'hoursPerWeek', minimum: 10 },
  ],
});
const employment: Employment = {
  employer: 'Synthetic employer', title: 'Synthetic job', duties: '', startDate: '2026-01-01',
  currentJob: true, endDate: null, hoursPerWeek: 10, countryCode: 'CA', paid: 'yes',
  authorizedToWork: 'no', nocCode: null, nocReviewed: false,
};
const registry = (records: PolicyVersion[]) => new PolicyRegistry(records, records.map(policyDigest));
const expectUnavailable = (action: () => unknown) => {
  expect(action).toThrowError(expect.objectContaining({ status: 503, code: 'POLICY_UNAVAILABLE' }));
};

describe('strict official-source policy contract', () => {
  it.each(['https://canada.ca/test', 'https://www.canada.ca/test', 'https://ontario.ca/test', 'https://www.ontario.ca/test'])('allows official HTTPS sources: %s', (url) => {
    const policy = sample(); policy.source.url = url;
    expect(policyVersionSchema.safeParse(policy).success).toBe(true);
  });

  it.each([
    'http://canada.ca/test', 'https://canada.ca.attacker.example/test', 'https://attacker.example/canada.ca/test',
    'https://canada.ca@attacker.example/test', 'https://attacker@canada.ca/test', 'https://name:password@ontario.ca/test',
    'https://canada.ca:8443/test', 'https://notcanada.ca/test', 'javascript:https://canada.ca',
    'https://canada.ca%2fattacker.example/test',
  ])('rejects spoofed or unsafe source URLs: %s', (url) => {
    const policy = sample(); policy.source.url = url;
    expectUnavailable(() => new PolicyRegistry([policy]));
  });

  it('verifies the exact UTF-8 source body hash', () => {
    const policy = sample(); policy.source.body += '\n';
    expectUnavailable(() => policyDigest(policy));
    expectUnavailable(() => new PolicyRegistry([policy]));
  });

  it('rejects unsupported fields and arbitrary executable predicates', () => {
    expectUnavailable(() => new PolicyRegistry([{ ...sample(), autoPromote: true }]));
    expectUnavailable(() => new PolicyRegistry([{ ...sample(), criteria: [{ id: 'x', title: 'x', kind: 'expression', expression: 'true' }] }]));
    expectUnavailable(() => new PolicyRegistry([{ ...sample(), criteria: [{ id: 'x', title: 'x', kind: 'number_gte', field: 'salary', minimum: 10 }] }]));
  });

  it('rejects invalid dates, duplicate criteria and missing review provenance', () => {
    expectUnavailable(() => new PolicyRegistry([{ ...sample(), effectiveFrom: '2026-02-30' }]));
    expectUnavailable(() => new PolicyRegistry([{ ...sample(), effectiveTo: '2026-01-01' }]));
    const duplicate = sample(); duplicate.criteria.push(duplicate.criteria[0]!);
    expectUnavailable(() => new PolicyRegistry([duplicate]));
    const unreviewed = sample(); unreviewed.review.reviewerId = null;
    expectUnavailable(() => new PolicyRegistry([unreviewed]));
    const earlyReview = sample(); earlyReview.review.reviewedAt = '2025-01-01T00:00:00Z';
    expectUnavailable(() => new PolicyRegistry([earlyReview]));
  });

  it('rejects duplicate version identities and malformed approval lists', () => {
    expectUnavailable(() => new PolicyRegistry([sample(), sample()]));
    expectUnavailable(() => new PolicyRegistry([], ['allow-all']));
    expectUnavailable(() => new PolicyRegistry({ policy: sample() }));
  });
});

describe('manual approved digest and temporal selection', () => {
  it('starts empty and never supplies example policy data', () => {
    const policies = new PolicyRegistry();
    expect(policies.available(date)).toEqual([]);
    expectUnavailable(() => policies.active('test-only', date));
  });

  it('requires both reviewed status and an explicit approved content digest', () => {
    const policy = sample();
    expectUnavailable(() => new PolicyRegistry([policy]).active(policy.id, date));
    policy.review.status = 'draft';
    expectUnavailable(() => registry([policy]).active(policy.id, date));
    policy.review.status = 'reviewed';
    expect(registry([policy]).active(policy.id, date).digest).toBe(policyDigest(policy));
  });

  it('hashes all content except review metadata with stable object-key order', () => {
    const original = sample();
    const reordered = Object.fromEntries(Object.entries(original).reverse());
    expect(policyDigest(reordered)).toBe(policyDigest(original));
    const reviewerChanged = sample(); reviewerChanged.review.reviewerId = 'another-test-reviewer';
    expect(policyDigest(reviewerChanged)).toBe(policyDigest(original));
    const changed = sample(); changed.criteria[0]!.title = 'Changed synthetic title';
    expect(policyDigest(changed)).not.toBe(policyDigest(original));
    const changedSource = sample(); changedSource.source.retrievedAt = '2026-01-01T01:00:00Z';
    expect(policyDigest(changedSource)).not.toBe(policyDigest(original));
    const ordered = sample(); ordered.criteria.reverse();
    expect(policyDigest(ordered)).not.toBe(policyDigest(original));
  });

  it('does not reuse approval after a rule or effective date changes', () => {
    const policy = sample(); const approval = policyDigest(policy);
    policy.effectiveFrom = '2026-02-01';
    expectUnavailable(() => new PolicyRegistry([policy], [approval]).active(policy.id, date));
  });

  it('selects effective boundaries inclusively at start and exclusively at end', () => {
    const policy = sample(); policy.effectiveFrom = '2026-02-01'; policy.effectiveTo = '2026-03-01';
    const policies = registry([policy]);
    expectUnavailable(() => policies.active(policy.id, '2026-01-31'));
    expect(policies.active(policy.id, '2026-02-01').policy.version).toBe('v1');
    expect(policies.active(policy.id, '2026-02-28').policy.version).toBe('v1');
    expectUnavailable(() => policies.active(policy.id, '2026-03-01'));
    expectUnavailable(() => policies.active(policy.id, '2026-02-30'));
  });

  it('rejects future and superseded versions and reviews dated after the assessment', () => {
    const future = sample(); future.effectiveFrom = '2027-01-01';
    expectUnavailable(() => registry([future]).active(future.id, date));
    const superseded = sample(); superseded.review.status = 'superseded';
    expectUnavailable(() => registry([superseded]).active(superseded.id, date));
    const laterReview = sample(); laterReview.review.reviewedAt = '2026-10-25T00:00:00Z';
    expectUnavailable(() => registry([laterReview]).active(laterReview.id, date));
  });

  it('fails closed on overlapping reviewed versions, including an unlisted competing digest', () => {
    const first = sample(); const second = sample(); second.version = 'v2';
    const policies = new PolicyRegistry([first, second], [policyDigest(first)]);
    expectUnavailable(() => policies.active(first.id, date));
    expect(policies.available(date)).toEqual([]);
  });

  it('blocks held conflicts but allows nonoverlapping future held records', () => {
    const first = sample(); const held = sample(); held.version = 'v2'; held.review.status = 'held';
    expectUnavailable(() => registry([first, held]).active(first.id, date));
    held.effectiveFrom = '2027-01-01';
    expect(registry([first, held]).active(first.id, date).policy.version).toBe('v1');
  });

  it('permits sequential reviewed versions with nonoverlapping validity', () => {
    const first = sample(); first.effectiveTo = '2026-10-24';
    const second = sample(); second.version = 'v2'; second.effectiveFrom = '2026-10-24';
    expect(registry([first, second]).active(first.id, date).policy.version).toBe('v2');
  });

  it('detaches input records and approval arrays, and freezes returned nested data', () => {
    const policy = sample(); const approvals = [policyDigest(policy)]; const policies = new PolicyRegistry([policy], approvals);
    policy.criteria[0]!.title = 'Mutated outside registry'; approvals.length = 0;
    const selected = policies.active(policy.id, date);
    expect(selected.policy.criteria[0]!.title).toBe('Synthetic paid-answer predicate');
    expect(Object.isFrozen(selected)).toBe(true);
    expect(Object.isFrozen(selected.policy.criteria[0])).toBe(true);
    expect(() => { selected.policy.source.body = 'Mutated through selection'; }).toThrow();
    expect(policies.active(policy.id, date).digest).toBe(selected.digest);
  });

  it('returns public summaries without source body or reviewer identity', () => {
    const policy = sample();
    expect(registry([policy]).available(date)).toEqual([{
      id: policy.id, version: policy.version, program: policy.program, title: policy.title,
      effectiveFrom: policy.effectiveFrom, effectiveTo: null, sourceUrl: policy.source.url, digest: policyDigest(policy),
    }]);
  });
});

describe('supported deterministic predicate evaluation', () => {
  const selection = () => registry([sample()]).active('test-only', date);

  it('evaluates known values with inclusive numerical comparison', () => {
    expect(evaluatePolicy(selection(), employment).map((result) => result.status)).toEqual(['met', 'not_met', 'met']);
    expect(evaluatePolicy(selection(), { ...employment, hoursPerWeek: 9.99 })[2]!.status).toBe('not_met');
  });

  it.each(['unknown', 'not_applicable'] as const)('keeps %s distinct from a negative answer', (answer) => {
    expect(evaluatePolicy(selection(), { ...employment, paid: answer, authorizedToWork: answer, hoursPerWeek: null })
      .map((result) => result.status)).toEqual(['needs_information', 'needs_information', 'needs_information']);
  });

  it('returns needs information for every criterion when no approved facts exist', () => {
    expect(evaluatePolicy(selection(), null).every((result) => result.status === 'needs_information')).toBe(true);
  });

  it('supports explicit expected no without converting missing information to no', () => {
    const policy = sample(); const criterion = policy.criteria[0]!;
    if (criterion.kind === 'answer_equals') criterion.expected = 'no';
    const selected = registry([policy]).active(policy.id, date);
    expect(evaluatePolicy(selected, { ...employment, paid: 'no' })[0]!.status).toBe('met');
    expect(evaluatePolicy(selected, { ...employment, paid: 'unknown' })[0]!.status).toBe('needs_information');
  });

  it('rejects tampered selection content and draft selections', () => {
    const selected = selection(); const altered = structuredClone(selected);
    altered.policy.criteria[0]!.title = 'Unapproved edit';
    expectUnavailable(() => evaluatePolicy(altered, employment));
    const draft = sample(); draft.review.status = 'draft';
    expectUnavailable(() => evaluatePolicy({ policy: draft, digest: policyDigest(draft) }, employment));
  });
});
