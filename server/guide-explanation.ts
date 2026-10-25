import { z } from 'zod';
import type { Discovery } from '../shared/demo.js';

const explanationSchema = z.strictObject({
  assessmentStatus: z.enum(['potential_pathway', 'needs_information', 'not_supported']),
  sourceUrls: z.array(z.url()).min(1).max(4),
  explanation: z.string().trim().min(1).max(5000),
});
export const guideReplyContract = 'Return only a JSON object with assessmentStatus (exactly the CONDITION CHECKS status), sourceUrls (the exact official URLs used), and explanation (plain text). Explain a lead and outstanding evidence, never assert eligibility, permission to keep working, guaranteed approval or a spouse extension.';

/** Structural/source checks and conservative red flags; not a second interpreter or proof of prose accuracy. */
export function reviewGuideExplanation(reply: string, discovery: Discovery):
  { status: 'available'; text: string } | { status: 'withheld'; reason: string } {
  let raw: unknown;
  // Native chat can wrap an otherwise valid JSON reply in one Markdown fence.
  // Accept that presentation wrapper only; never extract JSON from surrounding prose.
  const text=reply.trim();
  const fenced=/^```(?:json)?\r?\n([\s\S]*?)\r?\n```$/i.exec(text);
  try { raw = JSON.parse(fenced?fenced[1]!:text); } catch { return { status: 'withheld', reason: 'REPLY_FORMAT_UNVERIFIED' }; }
  const parsed = explanationSchema.safeParse(raw);
  if (!parsed.success) return { status: 'withheld', reason: 'REPLY_FORMAT_UNVERIFIED' };
  const value = parsed.data;
  if (value.assessmentStatus !== discovery.status) return { status: 'withheld', reason: 'REPLY_CONDITION_CONFLICT' };
  const allowed = new Set(discovery.sources.map(source => source.url));
  if (value.sourceUrls.some(url => !allowed.has(url))) return { status: 'withheld', reason: 'REPLY_SOURCE_UNVERIFIED' };
  // These known dangerous claims are held even if the model labels its status correctly.
  // Absence of a match does not establish legal accuracy; the UI says so explicitly.
  // A disclaimer such as "cannot be guaranteed" is not a guarantee. Check each
  // occurrence independently so a disclaimer cannot mask a later positive claim.
  const guarantee=[...value.explanation.matchAll(/\bguaranteed\b/gi)].some(match=>
    !/\b(?:not|never|cannot(?:\s+be)?|can't(?:\s+be)?)\s+$/i.test(value.explanation.slice(0,match.index)));
  if (guarantee||/\b(?:you|your spouse|your partner)\s+(?:are|is|will be)\s+(?:eligible|qualified|approved|entitled)\b|\bautomatically approved\b|\b(?:you|your spouse|your partner)\s+(?:can|may)\s+(?:continue|keep)\s+working\b|\b(?:will|definitely)\s+(?:receive|get|obtain)\s+(?:a |an |the )?(?:permit|extension|approval)\b/i.test(value.explanation)) {
    return { status: 'withheld', reason: 'REPLY_AUTHORIZATION_CLAIM' };
  }
  return { status: 'available', text: value.explanation };
}
