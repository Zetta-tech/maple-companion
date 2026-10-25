import { prepareLegacyMigration, legacyTables, type LegacySnapshot, type LegacyRow } from './legacy-migration.js';

const columns = {
  heads: ['owner','revision','receipt_json'],
  operations: ['id','owner','base_revision','status','old_json','new_json','created_at','confirmed_at','previous_fact_id','receipt_json'],
  notifications: ['id','operation_id','owner','revision','created_at'],
  assessments: ['id','owner','profile_revision','policy_digest','assessment_date','created_at','result_json'],
  assessment_notifications: ['id','assessment_id','owner','revision','created_at'],
  chat_previews: ['id','owner','base_revision','utterance','created_at','expires_at','status','endpoint','context','session_id','proposal_id'],
  chat_diagnostics: ['id','owner','reason','evidence_json','provider_status','updated_at'],
  chat_clarifications: ['id','owner','hours','issue','answer','answered_at'],
} as const;
export class MigrationError extends Error {
  constructor(readonly code: string) { super(code); }
}
function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new MigrationError(code);
}
const composite = (row: LegacyRow, key = 'id') => JSON.stringify([row.owner, row[key]]);
function receipt(value: unknown) {
  requireCondition(typeof value === 'string', 'INVALID_SOURCE_RECEIPT');
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new MigrationError('INVALID_SOURCE_RECEIPT'); }
  requireCondition(parsed && typeof parsed.factId === 'string' && parsed.factId.length > 0
    && typeof parsed.digest === 'string' && /^[a-f0-9]{64}$/.test(parsed.digest), 'INVALID_SOURCE_RECEIPT');
}
/** Validates without modifying/defaulting any row or re-encoding any receipt. */
export function validateLegacyMigration(snapshot: LegacySnapshot, approvedOwners: readonly string[]) {
  requireCondition(approvedOwners.length > 0 && new Set(approvedOwners).size === approvedOwners.length
    && approvedOwners.every(owner => /^user_[A-Za-z0-9]+$/.test(owner)), 'INVALID_APPROVED_OWNERS');
  requireCondition(snapshot.version === 1 && Object.keys(snapshot.tables).sort().join() === [...legacyTables].sort().join(), 'INVALID_SOURCE_SCHEMA');
  const owners = new Set(approvedOwners);
  for (const table of legacyTables) {
    const expected = [...columns[table]].sort().join();
    const seen = new Set<string>();
    for (const row of snapshot.tables[table]) {
      requireCondition(Object.keys(row).sort().join() === expected, 'INVALID_SOURCE_COLUMNS');
      requireCondition(typeof row.owner === 'string' && owners.has(row.owner), 'UNAPPROVED_SOURCE_OWNER');
      requireCondition(Object.values(row).every(value => value === null || typeof value === 'string'
        || (typeof value === 'number' && Number.isFinite(value))), 'INVALID_SOURCE_VALUE');
      const identity = composite(row, table === 'heads' ? 'owner' : 'id');
      requireCondition(!seen.has(identity), 'DUPLICATE_SOURCE_ID');
      seen.add(identity);
      if (table !== 'heads') requireCondition(typeof row.id === 'string' && row.id.length > 0, 'INVALID_SOURCE_ID');
    }
  }
  const operations = new Map(snapshot.tables.operations.map(row => [composite(row), row]));
  const previews = new Map(snapshot.tables.chat_previews.map(row => [composite(row), row]));
  const assessments = new Map(snapshot.tables.assessments.map(row => [composite(row), row]));
  const heads = new Map(snapshot.tables.heads.map(row => [row.owner, row]));
  const activeOwners = new Set<string>();
  const committedRevisions = new Set<string>();
  for (const op of operations.values()) {
    requireCondition(Number.isSafeInteger(op.base_revision) && Number(op.base_revision) >= 0, 'INVALID_SOURCE_REVISION');
    requireCondition(['pending','applying','uncertain','committed','rejected','stale'].includes(String(op.status)), 'INVALID_SOURCE_STATUS');
    if (['applying','uncertain'].includes(String(op.status))) {
      requireCondition(!activeOwners.has(String(op.owner)), 'MULTIPLE_ACTIVE_SOURCE_OPERATIONS');
      activeOwners.add(String(op.owner));
    }
    if (['pending','applying','uncertain'].includes(String(op.status))) {
      requireCondition(typeof op.new_json === 'string', 'MISSING_PENDING_PAYLOAD');
      requireCondition(op.base_revision === (heads.get(op.owner)?.revision ?? 0), 'STALE_ACTIVE_SOURCE_OPERATION');
    } else {
      requireCondition(op.old_json === null && op.new_json === null, 'SETTLED_SOURCE_PAYLOAD_REQUIRES_REVIEW');
    }
    if (op.status === 'committed') {
      receipt(op.receipt_json);
      requireCondition(typeof op.confirmed_at === 'string', 'MISSING_SOURCE_CONFIRMATION');
      const revision = JSON.stringify([op.owner, Number(op.base_revision) + 1]);
      requireCondition(!committedRevisions.has(revision), 'DUPLICATE_COMMITTED_REVISION');
      committedRevisions.add(revision);
    } else requireCondition(op.receipt_json === null, 'UNCOMMITTED_SOURCE_RECEIPT');
  }
  for (const head of heads.values()) {
    requireCondition(Number.isSafeInteger(head.revision) && Number(head.revision) >= 0, 'INVALID_SOURCE_REVISION');
    if (head.revision === 0) requireCondition(head.receipt_json === null, 'INVALID_SOURCE_HEAD');
    else {
      receipt(head.receipt_json);
      requireCondition([...operations.values()].some(op => op.owner === head.owner && op.status === 'committed'
        && Number(op.base_revision) + 1 === head.revision && op.receipt_json === head.receipt_json), 'SOURCE_HEAD_RECEIPT_MISMATCH');
    }
  }
  for (const op of operations.values()) {
    if (op.status === 'committed') requireCondition(Number(op.base_revision) < Number(heads.get(op.owner)?.revision ?? 0), 'SOURCE_HEAD_BEHIND_HISTORY');
  }
  for (const row of snapshot.tables.notifications) {
    const op = operations.get(composite(row, 'operation_id'));
    requireCondition(op?.status === 'committed' && Number(op.base_revision) + 1 === row.revision, 'ORPHAN_SOURCE_NOTIFICATION');
  }
  for (const row of assessments.values()) {
    let parsed;
    try { parsed = JSON.parse(String(row.result_json)); } catch { throw new MigrationError('INVALID_SOURCE_ASSESSMENT'); }
    requireCondition(parsed && parsed.ownerId === row.owner && parsed.id === row.id
      && parsed.profileRevision === row.profile_revision && parsed.policy?.digest === row.policy_digest
      && parsed.assessmentDate === row.assessment_date, 'INVALID_SOURCE_ASSESSMENT');
  }
  for (const row of snapshot.tables.assessment_notifications) {
    const assessment = assessments.get(composite(row, 'assessment_id'));
    requireCondition(assessment && assessment.profile_revision === row.revision, 'ORPHAN_SOURCE_ASSESSMENT_NOTIFICATION');
  }
  for (const row of previews.values()) {
    if (row.proposal_id !== null) requireCondition(operations.has(composite(row, 'proposal_id')), 'ORPHAN_SOURCE_CHAT_PROPOSAL');
  }
  for (const row of [...snapshot.tables.chat_clarifications, ...snapshot.tables.chat_diagnostics]) {
    requireCondition(previews.has(composite(row)), 'ORPHAN_SOURCE_CHAT_METADATA');
  }
  const plan = prepareLegacyMigration(snapshot);
  return { ...plan, recordCount: plan.records.length,
    receiptStringCount: [...snapshot.tables.heads, ...snapshot.tables.operations].filter(row => typeof row.receipt_json === 'string').length };
}
