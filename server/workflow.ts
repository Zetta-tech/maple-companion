import { z } from 'zod';
import { validateEmployment } from '../shared/employment.js';
import { businessDate } from '../shared/business-date.js';
import { MemoryStorageError, type Binding, type MemoryPort } from './am.js';
import { AppError } from './errors.js';
import { envelopeFor } from './journal.js';
import type { JournalStore } from './journal-store.js';

const proposalSchema = z.strictObject({ baseRevision: z.number().int().nonnegative(), employment: z.unknown() });
export const confirmationSchema = z.strictObject({ proposalRevision: z.literal(1) });
export class Workflow {
  constructor(readonly journal: JournalStore, private memory: MemoryPort, private resolve: (ownerId: string) => Binding, private now = () => new Date()) {}
  async read(owner: string) {
    const binding = this.resolve(owner);
    await this.journal.expireChat(owner, this.now().toISOString());
    if (await this.journal.active(owner)) throw new AppError(409, 'RECONCILIATION_REQUIRED', 'A save is still being checked. Current information is temporarily unavailable.');
    const head = await this.journal.head(owner);
    if (!head.receipt) return { revision: 0, employment: null };
    try {
      const envelope = await this.memory.read(binding, head.receipt);
      if (envelope.ownerId !== owner || envelope.revision !== head.revision) throw new Error();
      // Recheck after the await; a new commit invalidates this read.
      const current = await this.journal.head(owner);
      if (await this.journal.active(owner) || current.revision !== head.revision) throw new AppError(409, 'STALE_REVISION', 'Your information changed. Reload to continue.');
      return { revision: head.revision, employment: validateEmployment(envelope.employment, businessDate(this.now())) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'MEMORY_UNAVAILABLE', 'Your saved information could not be verified. Please try again later.');
    }
  }
  async propose(owner: string, body: unknown) {
    const input = proposalSchema.parse(body);
    const now = this.now();
    const employment = validateEmployment(input.employment, businessDate(now));
    const current = await this.read(owner);
    if (input.baseRevision !== current.revision) throw new AppError(409, 'STALE_REVISION', 'Your information changed. Reload before reviewing a change.');
    return await this.journal.propose(owner, input.baseRevision, current.employment, employment, this.now().toISOString());
  }
  async confirm(owner: string, id: string, body: unknown) {
    confirmationSchema.parse(body);
    const binding = this.resolve(owner);
    const candidate = await this.journal.get(owner, id);
    if (candidate.status === 'committed') return candidate;
    // Verify current AM evidence before claiming; no successful read means no write.
    await this.read(owner);
    const now = this.now();
    // Revalidate existing proposals too; older versions may have accepted UTC's tomorrow.
    if (candidate.status === 'pending') validateEmployment(candidate.newValue, businessDate(now));
    const op = await this.journal.claim(owner, id, () => this.now().toISOString());
    if (op.status === 'committed') return op;
    try {
      const receipt = await this.memory.write(binding, envelopeFor(op));
      return await this.journal.complete(owner, id, receipt, this.now().toISOString());
    } catch (error) {
      // A concurrent read-only reconciliation may already have persisted this exact receipt.
      let settled;
      try { settled = await this.journal.get(owner, id); }
      catch {
        // A DB outage after an AM write cannot be reported as an unsent save.
        // The persisted claim (applying) keeps subsequent writes blocked.
        throw new AppError(503, 'SAVE_UNCERTAIN', 'The save outcome could not be verified. Do not resubmit; check this change\'s status.');
      }
      if (settled.status === 'committed') return settled;
      // The AM adapter wraps every potentially transmitted POST error in write_uncertain.
      // Only its typed preflight failures prove no write was sent; generic errors stay uncertain.
      if (error instanceof MemoryStorageError && error.code !== 'write_uncertain') {
        await this.journal.releaseUnsent(owner, id);
        throw new AppError(503, 'SAVE_NOT_STARTED', 'Storage could not be verified. Your change was not saved. Review and confirm again once storage is available.');
      }
      try { await this.journal.uncertain(owner, id); }
      catch { /* The existing applying claim already blocks another save. */ }
      throw new AppError(503, 'SAVE_UNCERTAIN', 'We could not verify the save. It may have reached storage. Do not resubmit; check this change’s status.');
    }
  }
  async reconcile(owner: string, id: string) {
    const binding = this.resolve(owner);
    const op = await this.journal.get(owner, id);
    if (op.status === 'committed') return op;
    if (!['applying', 'uncertain'].includes(op.status)) throw new AppError(409, 'NOT_RECONCILABLE', 'This change does not need reconciliation.');
    try {
      const receipt = await this.memory.reconcile(binding, envelopeFor(op));
      if (receipt) return await this.journal.complete(owner, id, receipt, this.now().toISOString());
    } catch { /* Absence or transport failure is never proof that a write did not happen. */ }
    const settled = await this.journal.get(owner, id);
    if (settled.status === 'committed') return settled;
    await this.journal.uncertain(owner, id);
    throw new AppError(503, 'SAVE_UNCERTAIN', 'The save is still unverified. No additional write was attempted.');
  }
}
