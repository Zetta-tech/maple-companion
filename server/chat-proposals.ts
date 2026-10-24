import { z } from 'zod';
import { AppError } from './errors.js';
import type { Workflow } from './workflow.js';

const inputSchema = z.strictObject({ baseRevision: z.number().int().nonnegative(), message: z.string().trim().min(1).max(500) });
const interpretationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('hours'), hours: z.number().finite().gt(0).lte(168) }),
  z.strictObject({ kind: z.literal('clarify') }),
]);
export type HoursInterpretation = z.infer<typeof interpretationSchema>;
/** A provider suggests only a value. It cannot choose an owner, revision or operation. */
export interface HoursInterpreter { interpret(owner: string, message: string): Promise<unknown> }
export const CLASSIFIER_FALLBACK = 'We are facing technical difficulties, please update your information directly here';
const clarify = { kind: 'clarify' as const, message: 'Please state one weekly-hours correction, for example: I now work 36 hours per week. Use the employment form for other details.' };

/**
 * Deliberately limited baseline: accept a complete explicit statement/request,
 * never select one number out of a larger conversation. This is a semantic
 * guard, not a replacement model. The interpreter must independently agree.
 */
export function explicitWeeklyHours(message: string): number | null {
  const number = '(\\d{1,3}(?:\\.\\d{1,2})?)';
  const patterns = [
    new RegExp(`^I (?:now )?work ${number} hours (?:per|a) week[.!]?$`, 'i'),
    new RegExp(`^My weekly hours are (?:now )?${number}[.!]?$`, 'i'),
    new RegExp(`^(?:Please )?(?:change|update|set) my weekly hours to ${number}[.!]?$`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = message.trim().match(pattern);
    if (match) { const hours = Number(match[1]); return hours > 0 && hours <= 168 ? hours : null; }
  }
  return null;
}

/** Not constructed by index.ts while the hosted preview session side effect is unresolved. */
export class ChatProposals {
  constructor(private workflow: Workflow, private interpreter: HoursInterpreter) {}

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
    const hours = explicitWeeklyHours(input.message);
    if (hours === null) return clarify;
    let interpretation: HoursInterpretation;
    try {
      interpretation = interpretationSchema.parse(await this.interpreter.interpret(owner, input.message));
    } catch {
      // A failed classifier is not proof that storage is healthy. No form link
      // is returned unless a fresh authoritative read succeeds.
      await this.current(owner, input.baseRevision);
      return { kind: 'unavailable' as const, message: CLASSIFIER_FALLBACK, formHref: '#employment-heading' as const };
    }
    await this.current(owner, input.baseRevision);
    if (interpretation.kind !== 'hours' || interpretation.hours !== hours) return clarify;
    if (current.employment.hoursPerWeek === hours) return { kind: 'unchanged' as const, message: 'Those weekly hours are already saved. No change was proposed.' };
    // propose() reads/rechecks the current revision after the model await. There
    // is intentionally no confirmation, memory.write or raw-message persistence.
    try {
      const proposal = await this.workflow.propose(owner, { baseRevision: input.baseRevision,
        employment: { ...current.employment, hoursPerWeek: hours } });
      return { kind: 'proposal' as const, proposal };
    } catch (error) {
      if (error instanceof AppError && error.code === 'MEMORY_UNAVAILABLE') {
        throw new AppError(503, 'MEMORY_UNAVAILABLE', 'Storage is unavailable or your saved information could not be verified. No change was saved.');
      }
      throw error;
    }
  }
}
