import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import type { Surreal } from 'surrealdb';
import { ProviderEvidence } from '../server/provider-evidence.js';

it('requires the explicit schema marker and retains only owner-private integrity metadata', async () => {
  const retry = vi.fn(async () => [[{ version: 1 }]]);
  const query = vi.fn((_sql: string, _bindings?: Record<string, unknown>) => ({ retry }));
  const evidence = new ProviderEvidence({ query } as unknown as Surreal);
  await evidence.ready();
  await evidence.save('user_fixture', randomUUID(), 'native', { input: 'Private fixture utterance', response: { attributes: ['Private fixture fact'] } });
  const sent = query.mock.calls[1]![1]!;
  expect(sent.data).toMatchObject({ owner: 'user_fixture', purpose: 'native', digest: expect.stringMatching(/^[a-f0-9]{64}$/) });
  expect(JSON.stringify(sent)).not.toContain('Private fixture');
  expect(Object.keys(sent.data as object).sort()).toEqual(['digest', 'key', 'owner', 'purpose', 'recorded_at']);
  retry.mockResolvedValueOnce([[]]);
  await expect(evidence.ready()).rejects.toMatchObject({ code: 'PROVIDER_EVIDENCE_SCHEMA_REQUIRED' });
});
