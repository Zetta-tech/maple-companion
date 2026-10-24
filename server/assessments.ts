import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AssessmentRecord, AssessmentView } from '../shared/assessment.js';
import { AppError } from './errors.js';
import type { Journal } from './journal.js';
import type { Workflow } from './workflow.js';
import { PolicyRegistry, evaluatePolicy } from './policies.js';

const requestSchema = z.strictObject({ policyId: z.string().min(1).max(120) });
export function assessmentDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export class Assessments {
  constructor(private journal: Journal, private workflow: Workflow, readonly policies: PolicyRegistry = new PolicyRegistry(), private now = () => new Date()) {}
  available() { return this.policies.available(assessmentDate(this.now())); }
  async run(owner: string, body: unknown): Promise<AssessmentView> {
    const { policyId } = requestSchema.parse(body);
    const now = this.now();
    const date = assessmentDate(now);
    const selected = this.policies.active(policyId, date);
    // Every run, including a deduplication hit, verifies the current approved AM evidence.
    const snapshot = await this.workflow.read(owner);
    const verifiedAt = this.now();
    if (assessmentDate(verifiedAt) !== date) throw new AppError(409, 'ASSESSMENT_DATE_CHANGED', 'The assessment date changed. Run the check again.');
    const head = this.journal.head(owner);
    if (head.revision !== snapshot.revision || this.journal.active(owner)) throw new AppError(409, 'STALE_REVISION', 'Your information changed. Run the check again.');
    const policy = selected.policy;
    const record: AssessmentRecord = {
      id: randomUUID(), ownerId: owner, profileRevision: snapshot.revision, evidence: head.receipt,
      assessmentDate: date, createdAt: verifiedAt.toISOString(),
      policy: { id: policy.id, version: policy.version, program: policy.program, title: policy.title, digest: selected.digest,
        sourceUrl: policy.source.url, sourceBodySha256: policy.source.bodySha256, effectiveFrom: policy.effectiveFrom, effectiveTo: policy.effectiveTo },
      results: evaluatePolicy(selected, snapshot.employment),
    };
    const stored = this.journal.saveAssessment(owner, record);
    return this.view(stored, 'current');
  }
  async list(owner: string): Promise<AssessmentView[]> {
    return this.verify(owner, this.journal.assessments(owner));
  }
  async get(owner: string, id: string): Promise<AssessmentView> {
    // Owner check precedes provider access and returns the same 404 for absent/foreign IDs.
    const record = this.journal.assessment(owner, id);
    return (await this.verify(owner, [record]))[0]!;
  }
  private async verify(owner: string, records: AssessmentRecord[]): Promise<AssessmentView[]> {
    if (!records.length) return [];
    let currentRevision: number;
    try { currentRevision = (await this.workflow.read(owner)).revision; }
    catch { return records.map(record => this.view(record, 'unverified')); }
    const date = assessmentDate(this.now());
    const head = this.journal.head(owner);
    return records.map(record => {
      let currentPolicy = false;
      try { currentPolicy = this.policies.active(record.policy.id, date).digest === record.policy.digest; } catch { /* No approved current rule => stale. */ }
      const current = currentPolicy && record.assessmentDate === date && record.profileRevision === currentRevision
        && head.revision === currentRevision && !this.journal.active(owner)
        && JSON.stringify(record.evidence) === JSON.stringify(head.receipt);
      return this.view(record, current ? 'current' : 'stale');
    });
  }
  private view(record: AssessmentRecord, freshness: AssessmentView['freshness']): AssessmentView {
    const { ownerId: _owner, evidence: _evidence, ...publicToOwner } = record;
    // Retain historical metadata, but never present stale judgments as a current conclusion.
    return { ...publicToOwner, results: freshness === 'current' ? record.results : [], freshness };
  }
}
