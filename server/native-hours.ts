import { z } from 'zod';
import { createMemoryPreview, PreviewUnavailable, type MemoryPreview } from './am-preview.js';
import { type HoursInterpretation, type HoursInterpreter } from './chat-proposals.js';
import type { Binding } from './am.js';
import type { JournalStore } from './journal-store.js';
import type { Config } from './config.js';
import { bindingFor } from './config.js';
import { ChatProposals } from './chat-proposals.js';
import type { Workflow } from './workflow.js';
import { previewEvidence, type PreviewReason } from './preview-diagnostics.js';
import { recognizedHoursField } from './hours-field.js';

const attributeSchema = z.object({ id: z.literal(''), entityId: z.literal(''),
  key: z.string().min(1).max(500), value: z.string().max(500), memoryCategory: z.string() });

export function hoursPreviewText(message: string, currentHoursPerWeek: number | null) {
  const currentHours = z.number().finite().gt(0).lte(168).nullable().parse(currentHoursPerWeek);
  const context = currentHours === null ? 'no weekly work total is recorded.' : `the currently recorded work total is ${currentHours} hours per week.`;
  return `SYNTHETIC SEMANTIC EVALUATION ONLY. Fictional test person.\nSaved context (background): ${context}\nUser message (verbatim):\n${message}`;
}

/** Narrow normalization of an AM candidate, never a semantic classifier by itself. */
export function normalizeHoursPreview(preview: MemoryPreview): HoursInterpretation {
  return analyzeHoursPreview(preview).interpretation;
}

export function analyzeHoursPreview(preview: MemoryPreview): { interpretation: HoursInterpretation; reason: PreviewReason; evidence: ReturnType<typeof previewEvidence> } {
  const e = preview.extraction;
  const evidence = previewEvidence(preview);
  const held = (reason: PreviewReason) => ({ interpretation: { kind: 'clarify' as const }, reason, evidence });
  if (e.attributes.length === 0 && !e.uncertainties.length && !e.relations.length && !e.actions.length && !(e.corrections?.length ?? 0)) return { interpretation: { kind: 'no_change' }, reason: Object.values(evidence.counts).every(count => count === 0) ? 'NATIVE_EMPTY' : 'NATIVE_NO_CANDIDATE', evidence };
  if (e.attributes.length !== 1 || e.entities.length > 1 || e.uncertainties.length
    || e.instructions.length || e.relations.length || e.actions.length || (e.corrections?.length ?? 0)) return held('NATIVE_AMBIGUOUS');
  // A first-person subject hint is needed to associate an extracted attribute
  // with this one-job trial. It is never an authenticated ID or routing authority.
  if (e.entities.length !== 1 || !z.object({ entityType: z.literal('person'), name: z.string().regex(/^(?:self|user|the user)$/i) }).safeParse(e.entities[0]).success) return held('NATIVE_SUBJECT_UNSUPPORTED');
  const attribute = attributeSchema.safeParse(e.attributes[0]);
  if (!attribute.success) return held('NATIVE_ATTRIBUTE_INVALID');
  if (!['identity', 'context'].includes(attribute.data.memoryCategory)) return held('NATIVE_CATEGORY_UNSUPPORTED');
  const key = recognizedHoursField(attribute.data.key);
  if (!key) return { interpretation: { kind: 'clarify_field' }, reason: 'NATIVE_KEY_UNMAPPED', evidence };
  const { value } = attribute.data;
  // The whole value must be one supported assertion. Never pick a number from
  // explanatory prose, uncertainty, multiple values, conditions or other fields.
  const numeric = '(\\d{1,3}(?:\\.\\d{1,2})?)';
  const patterns = [
    new RegExp(`^(?:(?:I |User |The user )?(?:now )?works? |(?:Weekly hours|Hours per week)(?: are|:) )?${numeric} hours (?:per|a|each) week[.!]?$`, 'i'),
    new RegExp(`^(?:Weekly hours|Hours per week)(?: are|:) ${numeric}[.!]?$`, 'i'),
    ...(['employment_record', 'working_hours', 'work_hours'].includes(key) ? [] : [new RegExp(`^${numeric}$`)]),
  ];
  const match = patterns.map(pattern => value.trim().match(pattern)).find(Boolean);
  const unitless = value.trim().match(new RegExp(`^${numeric} hours[.!]?$`, 'i'));
  const availability = value.trim().match(new RegExp(`^(?:(?:I am|User is|The user is) )?(?:available to work|can work) ${numeric} hours(?: (?:per|a|each) week)?[.!]?$`, 'i'));
  const hours = Number((match ?? unitless ?? availability)?.[1] ?? NaN);
  if (!Number.isFinite(hours)) return held('NATIVE_VALUE_UNSUPPORTED');
  if (hours <= 0 || hours > 168) return held('NATIVE_OUT_OF_RANGE');
  if (availability) return { interpretation: { kind: 'clarify_hours', hours, issue: 'intent' }, reason: 'NATIVE_AVAILABILITY', evidence };
  if (unitless) return { interpretation: { kind: 'clarify_hours', hours, issue: 'period' }, reason: 'NATIVE_PERIOD_MISSING', evidence };
  return { interpretation: { kind: 'hours', hours }, reason: 'NATIVE_CANDIDATE', evidence };
}

export class NativeHoursInterpreter implements HoursInterpreter {
  constructor(private resolve: (owner: string) => Binding, private journal: JournalStore,
    private preview = createMemoryPreview()) {}
  async interpret(owner: string, message: string, requestId: string, currentHoursPerWeek: number | null = null): Promise<HoursInterpretation> {
    const binding = this.resolve(owner);
    if (binding.ownerId !== owner) throw new PreviewUnavailable();
    const record = await this.journal.chatPreview(owner, requestId);
    if (record.utterance !== message || record.status !== 'interpreting') throw new PreviewUnavailable();
    await this.journal.recordChatRemote(owner, requestId, binding.endpoint, binding.context, null);
    try {
      // Context comes only from the receipt-verified snapshot. Preserve the
      // original bounded message, without a desired answer or phrase rewrite.
      const tagged = hoursPreviewText(message, currentHoursPerWeek);
      const preview = await this.preview(binding, tagged, async session => await this.journal.recordChatRemote(owner, requestId, binding.endpoint, binding.context, session));
      const result = analyzeHoursPreview(preview);
      await this.journal.recordChatDiagnostic(owner, requestId, result.reason, result.evidence);
      return result.interpretation;
    } catch (error) {
      const reason: PreviewReason = error instanceof PreviewUnavailable ? error.httpStatus !== null && error.httpStatus >= 400 ? 'PROVIDER_HTTP_ERROR'
        : error.state === 'blocked' || error.httpStatus !== null ? 'PROVIDER_RESPONSE_INVALID' : error.state === 'uncertain' ? 'PROVIDER_TRANSPORT_UNCERTAIN' : 'LOCAL_PREVIEW_REJECTED' : 'INTERPRETER_FAILED';
      await this.journal.recordChatDiagnostic(owner, requestId, reason, undefined, error instanceof PreviewUnavailable ? error.httpStatus : null);
      await this.journal.finishChat(owner, requestId, error instanceof PreviewUnavailable ? error.state : 'uncertain');
      throw new PreviewUnavailable();
    }
  }
}

/** No environment toggle can enable this factory in normal/production mode. */
export function developmentChat(config: Config, workflow: Workflow) {
  if (config.amAccessMode !== 'single-user-development') return undefined;
  return new ChatProposals(workflow, new NativeHoursInterpreter(owner => bindingFor(config, owner), workflow.journal), () => new Date(), true);
}
