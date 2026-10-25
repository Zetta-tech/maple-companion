import { z } from 'zod';
import { AppError } from './errors.js';
import type { Workflow } from './workflow.js';
import { hoursEvidenceIssue, capacityWasMentioned, weeklyPeriodWasStated } from './hours-evidence.js';
import { clarificationQuestion } from '../shared/chat.js';

const inputSchema = z.strictObject({ baseRevision: z.number().int().nonnegative(), message: z.string().min(1).max(500).refine(value => value.trim().length > 0), syntheticTest: z.literal(true) });
const interpretationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('hours'), hours: z.number().finite().gt(0).lte(168) }),
  z.strictObject({ kind: z.literal('clarify_hours'), hours: z.number().finite().gt(0).lte(168), issue: z.enum(['period', 'intent']) }),
  z.strictObject({ kind: z.literal('clarify') }),
  z.strictObject({ kind: z.literal('no_change') }),
]);
export type HoursInterpretation = z.infer<typeof interpretationSchema>;
/** A provider suggests only a value. It cannot choose an owner, revision or operation. */
export interface HoursInterpreter { interpret(owner: string, message: string, requestId: string, currentHoursPerWeek: number | null): Promise<unknown> }
export const CLASSIFIER_FALLBACK = 'We are facing technical difficulties, please update your information directly here';
const clarify = { kind: 'clarify' as const, message: 'The preview did not establish one clear weekly-hours correction. Please clarify your current hours or use the employment form. Employer, job title and other fields are not supported in this chat trial.' };

/** Runtime construction is limited to explicit single-user synthetic development. */
export class ChatProposals {
  constructor(private workflow: Workflow, private interpreter: HoursInterpreter, private now = () => new Date(), private syntheticOnly = false) {}

  private async current(owner: string, revision: number) {
    try {
      const value = await this.workflow.read(owner);
      if (value.revision !== revision) throw new AppError(409, 'STALE_REVISION', 'Your information changed. Reload before describing a correction.');
      return value;
    } catch (error) {
      if (error instanceof AppError && error.code === 'MEMORY_UNAVAILABLE') {
        throw new AppError(503, 'MEMORY_UNAVAILABLE', 'Storage is unavailable or your saved information could not be verified. No change was saved.');
      }
      throw error;
    }
  }

  async propose(owner: string, body: unknown) {
    const input = inputSchema.parse(body);
    // Real approved evidence and binding are checked before any interpretation.
    const current = await this.current(owner, input.baseRevision);
    if (!current.employment) return { kind: 'clarify' as const, message: 'Save an employment record using the form before proposing a correction in chat.' };
    if (this.syntheticOnly && !current.employment.employer.startsWith('SYNTHETIC TEST ONLY - ')) throw new AppError(403, 'SYNTHETIC_RECORD_REQUIRED', 'Chat is available only for the labelled fictional test record. No preview was sent.');
    const requestId = this.workflow.journal.beginChat(owner, input.baseRevision, input.message, this.now().toISOString());
    let interpretation: HoursInterpretation;
    try {
      interpretation = interpretationSchema.parse(await this.interpreter.interpret(owner, input.message, requestId, current.employment.hoursPerWeek));
    } catch {
      this.workflow.journal.recordChatDiagnostic(owner, requestId, 'INTERPRETER_FAILED', undefined, null, true);
      this.workflow.journal.finishChat(owner, requestId, 'failed');
      // A failed classifier is not proof that storage is healthy. No form link
      // is returned unless a fresh authoritative read succeeds.
      await this.current(owner, input.baseRevision);
      return { kind: 'unavailable' as const, message: CLASSIFIER_FALLBACK, formHref: '#employment-heading' as const };
    }
    try { await this.current(owner, input.baseRevision); }
    catch (error) { this.workflow.journal.recordChatDiagnostic(owner, requestId, error instanceof AppError && error.code === 'STALE_REVISION' ? 'STALE_DURING_PREVIEW' : 'POST_PREVIEW_READ_FAILED'); this.workflow.journal.finishChat(owner, requestId, 'failed'); throw error; }
    if (interpretation.kind !== 'hours' && interpretation.kind !== 'clarify_hours') {
      this.workflow.journal.finishChat(owner, requestId, 'held');
      return interpretation.kind === 'no_change'
        ? { kind: 'unchanged' as const, message: 'The preview identified no weekly-hours change. Your employment record is unchanged.' } : clarify;
    }
    const hours = interpretation.hours;
    const evidenceIssue = hoursEvidenceIssue(input.message, hours);
    if (evidenceIssue) { this.workflow.journal.recordChatDiagnostic(owner, requestId, evidenceIssue.reason); this.workflow.journal.finishChat(owner, requestId, 'held'); return { kind: 'clarify' as const, message: evidenceIssue.message }; }
    const issue = capacityWasMentioned(input.message) || (interpretation.kind === 'clarify_hours' && interpretation.issue === 'intent') ? 'intent'
      : interpretation.kind === 'clarify_hours' || !weeklyPeriodWasStated(input.message, hours) ? 'period' : null;
    if (issue) {
      const clarification = this.workflow.journal.askHours(owner, requestId, hours, issue, this.now().toISOString());
      this.workflow.journal.recordChatDiagnostic(owner, requestId, 'CLARIFICATION_REQUIRED');
      return { kind: 'clarification' as const, clarification, message: clarificationQuestion(clarification) };
    }
    if (current.employment.hoursPerWeek === hours) {
      this.workflow.journal.recordChatDiagnostic(owner, requestId, 'MAPLE_NO_CHANGE');
      this.workflow.journal.finishChat(owner, requestId, 'held');
      return { kind: 'unchanged' as const, message: 'Those weekly hours are already saved. No change was proposed.' };
    }
    // propose() reads/rechecks the current revision after the model await. There
    // is intentionally no confirmation or approved-fact write here.
    try {
      const proposal = await this.workflow.propose(owner, { baseRevision: input.baseRevision,
        employment: { ...current.employment, hoursPerWeek: hours } }, requestId);
      this.workflow.journal.recordChatDiagnostic(owner, requestId, 'PROPOSAL_PREPARED');
      return { kind: 'proposal' as const, proposal };
    } catch (error) {
      this.workflow.journal.finishChat(owner, requestId, 'failed');
      if (error instanceof AppError && error.code === 'MEMORY_UNAVAILABLE') {
        throw new AppError(503, 'MEMORY_UNAVAILABLE', 'Storage is unavailable or your saved information could not be verified. No change was saved.');
      }
      throw error;
    }
  }

  pending(owner: string) { return this.workflow.journal.pendingHoursClarification(owner, this.now().toISOString()); }

  async answer(owner: string, id: string, body: unknown) {
    const { answer } = z.strictObject({ answer: z.enum(['actual_weekly_work', 'availability_only', 'different_period']) }).parse(body);
    const journal = this.workflow.journal;
    const question = journal.hoursClarification(owner, id, this.now().toISOString());
    const chat = journal.chatPreview(owner, id);
    if (answer !== 'actual_weekly_work') {
      journal.declineHours(owner, id, answer, this.now().toISOString());
      journal.recordChatDiagnostic(owner, id, 'CLARIFICATION_DECLINED');
      return { kind: 'unchanged' as const, message: answer === 'availability_only'
        ? 'Availability is not actual working hours. Your employment record is unchanged.'
        : 'No change was proposed. Please describe your actual weekly hours or use the employment form; Maple will not convert a different period automatically.' };
    }
    const current = await this.current(owner, chat.base_revision);
    if (!current.employment || (this.syntheticOnly && !current.employment.employer.startsWith('SYNTHETIC TEST ONLY - '))) throw new AppError(403, 'SYNTHETIC_RECORD_REQUIRED', 'This clarification is no longer available.');
    if (current.employment.hoursPerWeek === question.hours) {
      journal.declineHours(owner, id, 'actual_weekly_work', this.now().toISOString());
      journal.recordChatDiagnostic(owner, id, 'MAPLE_NO_CHANGE');
      return { kind: 'unchanged' as const, message: 'Those actual weekly hours are already saved. No change was proposed.' };
    }
    const proposal = await this.workflow.propose(owner, { baseRevision: chat.base_revision,
      employment: { ...current.employment, hoursPerWeek: question.hours } }, id, true);
    journal.recordChatDiagnostic(owner, id, 'PROPOSAL_PREPARED');
    return { kind: 'proposal' as const, proposal };
  }
}
