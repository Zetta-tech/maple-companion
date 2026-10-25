import { createHash } from 'node:crypto';
import { RecordId, type Surreal } from 'surrealdb';
import { z } from 'zod';
import { AppError } from './errors.js';

/** Durable, owner-private processing metadata, without raw messages, facts or keys.
 * Full native replies remain in the authorized journey event, not a public log. */
export class ProviderEvidence {
  constructor(private db: Surreal) {}
  async ready() {
    const [rows] = await this.db.query<[{ version: number }[]]>('SELECT version FROM maple_schema:provider_evidence_v1;').retry(false);
    if (rows[0]?.version !== 1) throw new AppError(503, 'PROVIDER_EVIDENCE_SCHEMA_REQUIRED', 'Durable processing evidence is not configured.');
  }
  async save(owner: string, operation: string, purpose: 'native' | 'guide', evidence: unknown) {
    z.string().regex(/^user_[a-zA-Z0-9]+$/).parse(owner); z.uuid().parse(operation);
    const digest = createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
    const id = createHash('sha256').update(JSON.stringify([owner, purpose, operation])).digest('hex');
    // The digest proves which provider response this operation observed; it does
    // not claim that missing canonical facts were saved or that content is true.
    await this.db.query('CREATE $record CONTENT $data;', {
      record: new RecordId('maple_provider_evidence', id),
      data: { owner, key: operation, purpose, digest, recorded_at: new Date().toISOString() },
    }).retry(false);
  }
}
