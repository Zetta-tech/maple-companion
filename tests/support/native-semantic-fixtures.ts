import type { MemoryPreview } from '../../server/am-preview.js';

// Sanitized outputs from diagnostic semantic-20261024-A. Session IDs replaced;
// extraction content preserved. These fixtures are not new live model calls.
const base: MemoryPreview = { mode: 'preview', preview: true, sessionId: 'captured-synthetic-session', extraction: {
  turnId: '', entities: [{ id: '', name: 'self', entityType: 'person', memoryCategory: 'identity', isNew: true }],
  attributes: [], relations: [], actions: [], instructions: [], uncertainties: [], corrections: [],
} };
export const nativeSemanticFixtures = [
  { category: 'paraphrase/typo', message: 'I currenly put in 37 hours each week at my fictional job.', proposal: true,
    response: { ...base, extraction: { ...base.extraction, attributes: [{ id: '', entityId: '', key: 'work_hours', value: '37 hours each week', memoryCategory: 'identity' }] } } },
  { category: 'missing period', message: 'I now work 37 hours.', proposal: true,
    response: { ...base, extraction: { ...base.extraction, attributes: [{ id: '', entityId: '', key: 'employment_record', value: '37 hours per week', memoryCategory: 'context' }] } } },
  { category: 'negation', message: 'I do not work 37 hours per week. Do not change my current hours.', proposal: false,
    response: { ...base, extraction: { ...base.extraction, instructions: [{ id: '', label: 'maintain_current_hours', description: "Do not change the user's currently recorded work hours." }] } } },
  { category: 'hypothetical', message: 'If I worked 37 hours per week next month, what would change? This is hypothetical.', proposal: false,
    response: { ...base, extraction: { ...base.extraction, entities: [] } } },
] satisfies { category: string; message: string; proposal: boolean; response: MemoryPreview }[];
