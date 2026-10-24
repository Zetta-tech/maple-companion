import { z } from 'zod';
import { createMemoryPreview, PreviewUnavailable, type MemoryPreview } from './am-preview.js';
import { type HoursInterpretation, type HoursInterpreter } from './chat-proposals.js';
import type { Binding } from './am.js';
import type { Journal } from './journal.js';
import type { Config } from './config.js';
import { bindingFor } from './config.js';
import { ChatProposals } from './chat-proposals.js';
import type { Workflow } from './workflow.js';

const attributeSchema = z.object({ id: z.literal(''), entityId: z.literal(''),
  key: z.enum(['employment_record', 'hours_per_week', 'weekly_hours', 'hoursPerWeek', 'working_hours', 'work_hours']),
  value: z.string().max(500), memoryCategory: z.enum(['identity', 'context']) });

/** Narrow normalization of an AM candidate, never a semantic classifier by itself. */
export function normalizeHoursPreview(preview: MemoryPreview): HoursInterpretation {
  const e = preview.extraction;
  if (e.attributes.length === 0 && !e.uncertainties.length && !e.relations.length && !e.actions.length && !(e.corrections?.length ?? 0)) return { kind: 'no_change' };
  if (e.attributes.length !== 1 || e.entities.length > 1 || e.uncertainties.length
    || e.instructions.length || e.relations.length || e.actions.length || (e.corrections?.length ?? 0)) return { kind: 'clarify' };
  // A first-person subject hint is needed to associate an extracted attribute
  // with this one-job trial. It is never an authenticated ID or routing authority.
  if (e.entities.length !== 1 || !z.object({ entityType: z.literal('person'), name: z.string().regex(/^(?:self|user|the user)$/i) }).safeParse(e.entities[0]).success) return { kind: 'clarify' };
  const attribute = attributeSchema.safeParse(e.attributes[0]);
  if (!attribute.success) return { kind: 'clarify' };
  const { key, value } = attribute.data;
  // The whole value must be one supported assertion. Never pick a number from
  // explanatory prose, uncertainty, multiple values, conditions or other fields.
  const numeric = '(\\d{1,3}(?:\\.\\d{1,2})?)';
  const patterns = [
    new RegExp(`^(?:(?:I |User |The user )?(?:now )?works? |(?:Weekly hours|Hours per week)(?: are|:) )?${numeric} hours (?:per|a|each) week[.!]?$`, 'i'),
    new RegExp(`^(?:Weekly hours|Hours per week)(?: are|:) ${numeric}[.!]?$`, 'i'),
    ...(['employment_record', 'working_hours', 'work_hours'].includes(key) ? [] : [new RegExp(`^${numeric}$`)]),
  ];
  const match = patterns.map(pattern => value.trim().match(pattern)).find(Boolean);
  const hours = match ? Number(match[1]) : NaN;
  return Number.isFinite(hours) && hours > 0 && hours <= 168 ? { kind: 'hours', hours } : { kind: 'clarify' };
}

export class NativeHoursInterpreter implements HoursInterpreter {
  constructor(private resolve: (owner: string) => Binding, private journal: Journal,
    private preview = createMemoryPreview()) {}
  async interpret(owner: string, message: string, requestId: string, currentHoursPerWeek: number | null = null): Promise<HoursInterpretation> {
    const binding = this.resolve(owner);
    if (binding.ownerId !== owner) throw new PreviewUnavailable();
    const record = this.journal.chatPreview(owner, requestId);
    if (record.utterance !== message || record.status !== 'interpreting') throw new PreviewUnavailable();
    this.journal.recordChatRemote(owner, requestId, binding.endpoint, binding.context, null);
    try {
      const currentHours = z.number().finite().gt(0).lte(168).nullable().parse(currentHoursPerWeek);
      // Context comes only from the receipt-verified snapshot. Preserve the
      // original bounded message, without a desired answer or phrase rewrite.
      const context = currentHours === null ? 'no weekly work total is recorded.' : `the currently recorded work total is ${currentHours} hours per week.`;
      const tagged = `SYNTHETIC SEMANTIC EVALUATION ONLY. Fictional test person.\nSaved context (background): ${context}\nUser message (verbatim):\n${message}`;
      const preview = await this.preview(binding, tagged, session => this.journal.recordChatRemote(owner, requestId, binding.endpoint, binding.context, session));
      return normalizeHoursPreview(preview);
    } catch (error) {
      this.journal.finishChat(owner, requestId, error instanceof PreviewUnavailable ? error.state : 'uncertain');
      throw new PreviewUnavailable();
    }
  }
}

/** No environment toggle can enable this factory in normal/production mode. */
export function developmentChat(config: Config, workflow: Workflow) {
  if (config.amAccessMode !== 'single-user-development') return undefined;
  return new ChatProposals(workflow, new NativeHoursInterpreter(owner => bindingFor(config, owner), workflow.journal), () => new Date(), true);
}
