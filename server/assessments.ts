import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AssessmentRecord, AssessmentView } from '../shared/assessment.js';
import { businessDate as assessmentDate } from '../shared/business-date.js';
import { validateEmployment } from '../shared/employment.js';
import { AppError } from './errors.js';
import type { JournalStore } from './journal-store.js';
import type { Workflow } from './workflow.js';
import { PolicyRegistry, evaluatePolicy } from './policies.js';

const requestSchema = z.strictObject({ policyId: z.string().min(1).max(120) });
export { assessmentDate };

export class Assessments {
  constructor(private journal: JournalStore, private workflow: Workflow, readonly policies: PolicyRegistry = new PolicyRegistry(), private now = () => new Date(),
    private evidenceStillReviewed: (owner: string) => Promise<boolean> = async () => true) {}
  available() { return this.policies.available(assessmentDate(this.now())); }
  async run(owner: string, body: unknown): Promise<AssessmentView> {
    const { policyId } = requestSchema.parse(body);
    const now = this.now();
    const date = assessmentDate(now);
    const selected = this.policies.active(policyId, date);
    if (!await this.evidenceStillReviewed(owner)) throw new AppError(409, 'ASSESSMENT_INPUT_REVIEW_REQUIRED', 'Review and save your assessment inputs after conversation updates, then run this check. Any unfinished update must be checked first.');
    // Every run, including a deduplication hit, verifies the current approved AM evidence.
    const snapshot = await this.workflow.read(owner);
    const verifiedAt = this.now();
    if (assessmentDate(verifiedAt) !== date) throw new AppError(409, 'ASSESSMENT_DATE_CHANGED', 'The assessment date changed. Run the check again.');
    let employment;
    try { employment = snapshot.employment === null ? null : validateEmployment(snapshot.employment, date); }
    catch { throw new AppError(503, 'ASSESSMENT_EVIDENCE_INVALID', 'Saved employment dates could not be verified for this assessment date.'); }
    const head = await this.journal.head(owner);
    if (head.revision !== snapshot.revision || await this.journal.active(owner) || !await this.evidenceStillReviewed(owner)) throw new AppError(409, 'STALE_REVISION', 'Your information changed. Run the check again.');
    const policy = selected.policy;
    const record: AssessmentRecord = {
      id: randomUUID(), ownerId: owner, profileRevision: snapshot.revision, evidence: head.receipt,
      assessmentDate: date, createdAt: verifiedAt.toISOString(),
      policy: { id: policy.id, version: policy.version, program: policy.program, title: policy.title, digest: selected.digest,
        sourceUrl: policy.source.url, sourceBodySha256: policy.source.bodySha256, effectiveFrom: policy.effectiveFrom, effectiveTo: policy.effectiveTo },
      results: evaluatePolicy(selected, employment, date),
    };
    const stored = await this.journal.saveAssessment(owner, record);
    // A delayed save response/callback can cross a confirmation or date boundary.
    const reviewed = await this.evidenceStillReviewed(owner);
    const fence = await this.journal.assessmentFence(owner);
    return this.view(stored, reviewed && this.matchesFence(stored, fence)
      && assessmentDate(this.now()) === date ? 'current' : 'stale');
  }
  async list(owner: string): Promise<AssessmentView[]> {
    return this.verify(owner, await this.journal.assessments(owner));
  }
  async get(owner: string, id: string): Promise<AssessmentView> {
    // Owner check precedes provider access and returns the same 404 for absent/foreign IDs.
    const record = await this.journal.assessment(owner, id);
    return (await this.verify(owner, [record]))[0]!;
  }
  private async verify(owner: string, records: AssessmentRecord[]): Promise<AssessmentView[]> {
    if (!records.length) return [];
    let currentRevision: number;
    let date: string;
    try {
      if (!await this.evidenceStillReviewed(owner)) return records.map(record => this.view(record, 'unverified'));
      const snapshot = await this.workflow.read(owner);
      date = assessmentDate(this.now());
      if (snapshot.employment !== null) validateEmployment(snapshot.employment, date);
      currentRevision = snapshot.revision;
    }
    catch { return records.map(record => this.view(record, 'unverified')); }
    if (!await this.evidenceStillReviewed(owner)) return records.map(record => this.view(record, 'unverified'));
    // Must follow the final callback, which itself can await a concurrent save.
    const fence = await this.journal.assessmentFence(owner);
    date = assessmentDate(this.now());
    return records.map(record => {
      let currentPolicy = false;
      try { currentPolicy = this.policies.active(record.policy.id, date).digest === record.policy.digest; } catch { /* No approved current rule => stale. */ }
      const current = currentPolicy && record.assessmentDate === date && record.profileRevision === currentRevision
        && this.matchesFence(record, fence);
      return this.view(record, current ? 'current' : 'stale');
    });
  }
  private matchesFence(record: AssessmentRecord, fence: Awaited<ReturnType<JournalStore['assessmentFence']>>) {
    return !fence.active && fence.revision === record.profileRevision
      && JSON.stringify(record.evidence) === JSON.stringify(fence.receipt);
  }
  private view(record: AssessmentRecord, freshness: AssessmentView['freshness']): AssessmentView {
    const { ownerId: _owner, evidence: _evidence, ...publicToOwner } = record;
    // Retain historical metadata, but never present stale judgments as a current conclusion.
    return { ...publicToOwner, results: freshness === 'current' ? record.results : [], freshness };
  }
}
