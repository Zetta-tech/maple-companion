import { createHash } from 'node:crypto';
import { z } from 'zod';
import { employmentSchema, type Employment } from '../shared/employment.js';
import {
  policyDateSchema, policyVersionSchema,
  type PolicyVersion, type PolicySelection, type PolicySummary, type PolicyCriterionResult,
} from '../shared/policy.js';
import { AppError } from './errors.js';
import { evaluateCecWork } from './cec-work.js';

const unavailable = () => new AppError(503, 'POLICY_UNAVAILABLE', 'A single reviewed policy version could not be verified for this date.');
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

function verifiedRecord(input: unknown): PolicyVersion {
  const parsed = policyVersionSchema.safeParse(input);
  if (!parsed.success || sha256(parsed.data.source.body) !== parsed.data.source.bodySha256) throw unavailable();
  return parsed.data;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

/**
 * Manual approval binds this exact digest. It hashes every validated field EXCEPT
 * the entire review object: identifiers, titles/program, effective dates, exact
 * source URL/body/body hash/retrieval time and ordered criteria. Object keys are
 * sorted recursively; array order and UTF-8 string content are preserved. A status
 * edit alone is never approval, and changing any rule or source needs a new digest.
 */
export function policyDigest(input: unknown): string {
  const { review: _review, ...content } = verifiedRecord(input);
  return sha256(canonicalJson(content));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function within(record: PolicyVersion, date: string): boolean {
  return record.effectiveFrom <= date && (record.effectiveTo === null || date < record.effectiveTo);
}

/** Read-only registry. No network calls, automatic ingestion or promotion paths. */
export class PolicyRegistry {
  private readonly records: readonly PolicyVersion[];
  private readonly approvedDigests: ReadonlySet<string>;

  constructor(records: unknown = [], approvedDigests: string[] = []) {
    if (!Array.isArray(records)) throw unavailable();
    const approvals = z.array(z.string().regex(/^[a-f0-9]{64}$/)).safeParse(approvedDigests);
    if (!approvals.success) throw unavailable();
    const parsed = records.map(verifiedRecord);
    const versions = new Set(parsed.map((record) => JSON.stringify([record.id, record.version])));
    if (versions.size !== parsed.length) throw unavailable();
    // Parsing clones every nested field. Freezing prevents caller mutation of any
    // subsequently returned selection; the original input and allowlist are detached.
    this.records = deepFreeze(parsed);
    this.approvedDigests = new Set(approvals.data);
  }

  active(policyId: string, asOfDate: string): PolicySelection {
    const date = policyDateSchema.safeParse(asOfDate);
    if (!date.success) throw unavailable();
    const atDate = this.records.filter((record) => record.id === policyId && within(record, date.data));
    // A held version signals an unresolved conflict, even if its digest has not
    // been approved. A competing reviewed version is also a conflict, not a vote.
    if (atDate.some((record) => record.review.status === 'held')) throw unavailable();
    const reviewed = atDate.filter((record) => record.review.status === 'reviewed');
    if (reviewed.length !== 1) throw unavailable();
    const policy = reviewed[0]!;
    if (policy.review.reviewedAt === null
      || Date.parse(policy.review.reviewedAt) >= Date.parse(`${date.data}T00:00:00.000Z`) + 86_400_000) throw unavailable();
    const digest = policyDigest(policy);
    if (!this.approvedDigests.has(digest)) throw unavailable();
    return deepFreeze({ policy, digest });
  }

  available(asOfDate: string): PolicySummary[] {
    if (!policyDateSchema.safeParse(asOfDate).success) throw unavailable();
    const summaries: PolicySummary[] = [];
    for (const id of [...new Set(this.records.map((record) => record.id))].sort()) {
      try {
        const { policy, digest } = this.active(id, asOfDate);
        summaries.push({
          id: policy.id, version: policy.version, program: policy.program, title: policy.title,
          effectiveFrom: policy.effectiveFrom, effectiveTo: policy.effectiveTo,
          sourceUrl: policy.source.url, digest,
        });
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== 'POLICY_UNAVAILABLE') throw error;
      }
    }
    return deepFreeze(summaries);
  }
}

/**
 * Evaluate only a selection from PolicyRegistry.active against approved employment
 * facts supplied by the application. Conversation text is not an input. Each result
 * describes one supported criterion, never a whole program or invitation outcome.
 */
export function evaluatePolicy(selection: PolicySelection, employment: Employment | null, asOfDate?: string): PolicyCriterionResult[] {
  const policy = verifiedRecord(selection.policy);
  if (policy.review.status !== 'reviewed' || policyDigest(policy) !== selection.digest) throw unavailable();
  const facts = employment === null ? null : employmentSchema.parse(employment);
  return policy.criteria.map((criterion) => {
    if (criterion.kind === 'cec_work_experience') {
      if (!policyDateSchema.safeParse(asOfDate).success) throw new AppError(503, 'ASSESSMENT_DATE_REQUIRED', 'A server-selected application date is required.');
      return { criterionId: criterion.id, title: criterion.title, ...evaluateCecWork(facts, asOfDate!) };
    }
    let status: PolicyCriterionResult['status'] = 'needs_information';
    if (facts !== null && criterion.kind === 'answer_equals') {
      const answer = facts[criterion.field];
      if (answer === 'yes' || answer === 'no') status = answer === criterion.expected ? 'met' : 'not_met';
    } else if (facts !== null && criterion.kind === 'number_gte') {
      const amount = facts[criterion.field];
      if (amount !== null) status = amount >= criterion.minimum ? 'met' : 'not_met';
    }
    return { criterionId: criterion.id, title: criterion.title, status };
  });
}
