import { z } from 'zod';
import { createMemoryPreview, PreviewUnavailable, type MemoryPreview } from './am-preview.js';
import { explicitWeeklyHours, type HoursInterpretation, type HoursInterpreter } from './chat-proposals.js';
import type { Binding } from './am.js';
import type { Journal } from './journal.js';
import type { Config } from './config.js';
import { bindingFor } from './config.js';
import { ChatProposals } from './chat-proposals.js';
import type { Workflow } from './workflow.js';

const attributeSchema = z.object({ id: z.literal(''), entityId: z.string().max(256),
  key: z.enum(['employment_record', 'hours_per_week', 'weekly_hours', 'hoursPerWeek', 'working_hours']),
  value: z.string().max(500), memoryCategory: z.enum(['identity', 'context']) });

/** Narrow normalization of an AM candidate, never a semantic classifier by itself. */
export function normalizeHoursPreview(message: string, preview: MemoryPreview): HoursInterpretation {
  const expected = explicitWeeklyHours(message);
  const e = preview.extraction;
  if (expected === null || e.attributes.length !== 1 || e.entities.length > 1 || e.uncertainties.length
    || e.instructions.length || e.relations.length || e.actions.length || (e.corrections?.length ?? 0)) return { kind: 'clarify' };
  const attribute = attributeSchema.safeParse(e.attributes[0]);
  if (!attribute.success) return { kind: 'clarify' };
  const { key, value } = attribute.data;
  // The whole value must be one supported assertion. Never pick a number from
  // explanatory prose, uncertainty, multiple values, conditions or other fields.
  const numeric = '(\\d{1,3}(?:\\.\\d{1,2})?)';
  const patterns = [
    new RegExp(`^(?:(?:I |User |The user )?(?:now )?works? |(?:Weekly hours|Hours per week)(?: are|:) )?${numeric} hours (?:per|a) week[.!]?$`, 'i'),
    new RegExp(`^(?:Weekly hours|Hours per week)(?: are|:) ${numeric}[.!]?$`, 'i'),
    ...(['employment_record', 'working_hours'].includes(key) ? [] : [new RegExp(`^${numeric}$`)]),
  ];
  const match = patterns.map(pattern => value.trim().match(pattern)).find(Boolean);
  const hours = match ? Number(match[1]) : NaN;
  return hours === expected ? { kind: 'hours', hours } : { kind: 'clarify' };
}

export class NativeHoursInterpreter implements HoursInterpreter {
  constructor(private resolve: (owner: string) => Binding, private journal: Journal,
    private preview = createMemoryPreview()) {}
  async interpret(owner: string, message: string, requestId: string): Promise<HoursInterpretation> {
    const binding = this.resolve(owner);
    if (binding.ownerId !== owner) throw new PreviewUnavailable();
    const record = this.journal.chatPreview(owner, requestId);
    if (record.utterance !== message || record.status !== 'interpreting') throw new PreviewUnavailable();
    this.journal.recordChatRemote(owner, requestId, binding.endpoint, binding.context, null);
    try {
      // The tag carries no real account identity or existing approved facts.
      const tagged = `SYNTHETIC MAPLE DEVELOPMENT TEST ONLY. Fictional employment record: ${message}`;
      const preview = await this.preview(binding, tagged, session => this.journal.recordChatRemote(owner, requestId, binding.endpoint, binding.context, session));
      return normalizeHoursPreview(message, preview);
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
