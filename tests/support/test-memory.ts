import { createHash } from 'node:crypto';
import type { Binding, Envelope, MemoryPort, Receipt } from '../../server/am.js';

/** Deterministic service double, available only to automated tests. Never imported by runtime. */
export class TestMemory implements MemoryPort {
  readonly records = new Map<string, { envelope: Envelope; receipt: Receipt }>();
  readonly writes: { binding: Binding; envelope: Envelope }[] = [];
  readonly reads: { binding: Binding; receipt: Receipt }[] = [];
  readonly reconciliations: { binding: Binding; envelope: Envelope }[] = [];
  failWrite: 'before' | 'after' | null = null;
  failRead = false;
  failReconcile = false;
  beforeWrite: (() => Promise<void>) | undefined;

  async write(binding: Binding, envelope: Envelope): Promise<Receipt> {
    if (binding.ownerId !== envelope.ownerId) throw new Error('test owner mismatch');
    this.writes.push(structuredClone({ binding, envelope }));
    await this.beforeWrite?.();
    if (this.failWrite === 'before') throw new Error('test transport failed before storage');
    const receipt = {
      factId: `test-fact-${envelope.operationId}`,
      digest: createHash('sha256').update(JSON.stringify(envelope)).digest('hex'),
    };
    this.records.set(`${binding.context}:${receipt.factId}`, structuredClone({ envelope, receipt }));
    if (this.failWrite === 'after') throw new Error('test response lost after storage');
    return structuredClone(receipt);
  }

  async read(binding: Binding, receipt: Receipt): Promise<Envelope> {
    this.reads.push(structuredClone({ binding, receipt }));
    if (this.failRead) throw new Error('test memory unavailable');
    const record = this.records.get(`${binding.context}:${receipt.factId}`);
    if (!record || record.receipt.digest !== receipt.digest || record.envelope.ownerId !== binding.ownerId) {
      throw new Error('test receipt not verified');
    }
    return structuredClone(record.envelope);
  }

  async reconcile(binding: Binding, envelope: Envelope): Promise<Receipt | null> {
    this.reconciliations.push(structuredClone({ binding, envelope }));
    if (this.failReconcile) throw new Error('test reconciliation unavailable');
    const record = [...this.records.entries()].find(([key, value]) =>
      key.startsWith(`${binding.context}:`) && value.envelope.ownerId === binding.ownerId
      && JSON.stringify(value.envelope) === JSON.stringify(envelope));
    return record ? structuredClone(record[1].receipt) : null;
  }
}
