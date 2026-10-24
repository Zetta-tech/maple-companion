import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { Journal } from '../server/journal.js';
import { Workflow } from '../server/workflow.js';
import { bindingFor, loadConfig, type Config } from '../server/config.js';
import type { MemoryPort } from '../server/am.js';
import { TestMemory } from './support/test-memory.js';
import { Assessments } from '../server/assessments.js';
import { PolicyRegistry, policyDigest } from '../server/policies.js';
import { syntheticPolicy } from './support/test-policy.js';
import { ChatProposals } from '../server/chat-proposals.js';

const origin = 'http://localhost:3000';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrongKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const config: Config = { origin, amAccessMode: 'restricted', publishableKey: `pk_test_${Buffer.from('maple.clerk.accounts.dev$').toString('base64')}`,
  secretKey: 'sk_test_fixture_not_a_real_key', jwtKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  journalPath: ':memory:', bindings: new Map(['user_A', 'user_B'].map(ownerId => [ownerId, {
    ownerId, endpoint: `https://${ownerId.toLowerCase().replace('_', '-')}.example.test`, context: `private-${ownerId}`,
    readKey: `test-read-${ownerId}`, writeKey: `test-write-${ownerId}`,
  }])) };
const journals: Journal[] = [];
afterEach(() => { journals.splice(0).forEach(journal => journal.close()); });
function token(overrides: Record<string, unknown> = {}, wrongSignature = false) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'fixture' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ iss: 'https://maple.clerk.accounts.dev', sub: 'user_A', sid: 'sess_A',
    azp: origin, iat: now - 10, nbf: now - 10, exp: now + 60, ...overrides })).toString('base64url');
  const payload = `${header}.${body}`;
  return `${payload}.${sign('RSA-SHA256', Buffer.from(payload), wrongSignature ? wrongKeys.privateKey : keys.privateKey).toString('base64url')}`;
}
function app() {
  const journal = new Journal(':memory:'); journals.push(journal);
  const unusedMemory: MemoryPort = { async read() { throw new Error('unexpected'); }, async write() { throw new Error('unexpected'); }, async reconcile() { throw new Error('unexpected'); } };
  const workflow = new Workflow(journal, unusedMemory, ownerId => ({ ownerId, endpoint: `https://${ownerId}.am.example.test`, context: `private-${ownerId}`, readKey: 'test-read', writeKey: 'test-write' }));
  return createApp({ config, workflow }); // Actual Clerk middleware, no auth test double.
}

describe('real Clerk verification and HTTP boundaries, with locally generated test JWTs', () => {
  it('refuses a supplied chat interpreter in restricted/production composition', async () => {
    const journal = new Journal(':memory:'); journals.push(journal);
    const workflow = new Workflow(journal, new TestMemory(), owner => bindingFor(config, owner));
    let invoked = false;
    const chatProposals = new ChatProposals(workflow, { async interpret() { invoked = true; return { kind: 'hours', hours: 36 }; } });
    const application = createApp({ config, workflow, chatProposals });
    const status = await request(application).get('/api/chat/status').auth(token(), { type: 'bearer' });
    expect(status.body.available).toBe(false);
    const result = await request(application).post('/api/chat/proposals').set('Origin', origin).auth(token(), { type: 'bearer' }).send({ baseRevision: 0, message: 'I work 36 hours per week.', syntheticTest: true });
    expect(result.status).toBe(503); expect(result.body.error.code).toBe('CHAT_NOT_AVAILABLE'); expect(invoked).toBe(false);
  });
  it('keeps chat unavailable without an explicitly constructed interpreter', async () => {
    const application = app();
    const body = { baseRevision: 0, message: 'I work 36 hours per week.' };
    const missing = await request(application).post('/api/chat/proposals').set('Origin', origin).send(body);
    expect(missing.status).toBe(401);
    const mapped = await request(application).post('/api/chat/proposals').set('Origin', origin).auth(token(), { type: 'bearer' }).send(body);
    expect(mapped.status).toBe(503); expect(mapped.body.error.code).toBe('CHAT_NOT_AVAILABLE');
    expect(mapped.headers['cache-control']).toBe('no-store');
    const unmapped = await request(application).post('/api/chat/proposals').set('Origin', origin).auth(token({ sub: 'user_unmapped' }), { type: 'bearer' }).send(body);
    expect(unmapped.status).toBe(503); expect(unmapped.body.error.code).toBe('CONTEXT_NOT_PROVISIONED');
  });
  it('binds chat proposals to the actual Clerk subject and requires a separate confirmation request', async () => {
    const journal = new Journal(':memory:'); journals.push(journal);
    const memory = new TestMemory();
    const workflow = new Workflow(journal, memory, owner => bindingFor(config, owner), () => new Date('2026-10-24T15:00:00Z'));
    const employment = { employer: 'Synthetic employer', title: 'Synthetic role', duties: '', startDate: '2025-01-01', currentJob: true,
      endDate: null, hoursPerWeek: 34, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
    const initial = await workflow.propose('user_A', { baseRevision: 0, employment });
    await workflow.confirm('user_A', initial.id, { proposalRevision: 1 });
    const interpretedOwners: string[] = [];
    const chatProposals = new ChatProposals(workflow, { async interpret(owner) { interpretedOwners.push(owner); return { kind: 'hours', hours: 36 }; } });
    const trialConfig: Config = { ...config, amAccessMode: 'single-user-development', bindings: new Map([['user_A', config.bindings.get('user_A')!]]) };
    const application = createApp({ config: trialConfig, workflow, chatProposals });
    const post = (path: string, body: object, jwt = token()) => request(application).post(path).set('Origin', origin).set('x-owner-id', 'user_B').auth(jwt, { type: 'bearer' }).send(body);
    const body = { baseRevision: 1, message: 'I now work 36 hours per week.', syntheticTest: true };
    expect((await post('/api/chat/proposals', { ...body, ownerId: 'user_B' })).status).toBe(400);
    const result = await post('/api/chat/proposals?ownerId=user_B', body);
    expect(result.status).toBe(201); expect(result.body.kind).toBe('proposal');
    expect(result.body.proposal).toMatchObject({ ownerId: 'user_A', status: 'pending', baseRevision: 1, oldValue: employment, newValue: { ...employment, hoursPerWeek: 36 } });
    expect(interpretedOwners).toEqual(['user_A']); expect(memory.writes).toHaveLength(1);
    expect(journal.notifications('user_A')).toHaveLength(1);
    expect((await post(`/api/proposals/${result.body.proposal.id}/confirm`, { proposalRevision: 1 }, token({ sub: 'user_B' }))).status).toBe(503);
    expect((await post(`/api/proposals/${result.body.proposal.id}/confirm`, { proposalRevision: 1 })).status).toBe(200);
    expect(memory.writes).toHaveLength(2); expect(journal.notifications('user_A')).toHaveLength(2);
    expect(journal.list('user_B')).toEqual([]);
  });
  it('denies all workspace routes after an owner binding is removed, retaining private records', async () => {
    const bindings = new Map([['user_A', { ownerId: 'user_A', endpoint: 'https://a.example.test', context: 'ctx_a', readKey: 'test-read', writeKey: 'test-write' }]]);
    const instance = { ...config, bindings };
    const journal = new Journal(':memory:'); journals.push(journal);
    const memory = new TestMemory();
    const now = () => new Date('2026-10-24T15:00:00Z');
    const workflow = new Workflow(journal, memory, owner => bindingFor(instance, owner), now);
    const policy = syntheticPolicy();
    const assessments = new Assessments(journal, workflow, new PolicyRegistry([policy], [policyDigest(policy)]), now);
    const application = createApp({ config: instance, workflow, assessments });
    const employment = { employer: 'Test-only employer', title: 'Test role', duties: '', startDate: '2025-01-01', currentJob: true,
      endDate: null, hoursPerWeek: 35, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
    const proposal = await workflow.propose('user_A', { baseRevision: 0, employment });
    await workflow.confirm('user_A', proposal.id, { proposalRevision: 1 });
    const assessed = await assessments.run('user_A', { policyId: policy.id });
    const pending = await workflow.propose('user_A', { baseRevision: 1, employment });
    const reads = memory.reads.length;
    bindings.delete('user_A');
    const session = await request(application).get('/api/session').auth(token(), { type: 'bearer' });
    expect(session.body).toEqual({ ownerId: 'user_A', workspaceReady: false });
    for (const path of ['/api/employment', '/api/proposals', '/api/notifications', '/api/policies', '/api/chat/status', '/api/assessments', `/api/assessments/${assessed.id}`]) {
      const result = await request(application).get(path).auth(token(), { type: 'bearer' });
      expect(result.status, path).toBe(503);
      expect(result.body.error.code).toBe('CONTEXT_NOT_PROVISIONED');
      expect(result.headers['cache-control']).toBe('no-store');
    }
    for (const path of ['/api/proposals', '/api/chat/proposals', `/api/proposals/${pending.id}/confirm`, `/api/proposals/${pending.id}/reject`, `/api/proposals/${pending.id}/reconcile`, '/api/assessments']) {
      const result = await request(application).post(path).set('Origin', origin).auth(token(), { type: 'bearer' }).send({});
      expect(result.status, path).toBe(503);
      expect(result.body.error.code).toBe('CONTEXT_NOT_PROVISIONED');
    }
    expect(journal.list('user_A')).toHaveLength(2);
    expect(journal.get('user_A', pending.id).status).toBe('pending');
    expect(journal.notifications('user_A')).toHaveLength(2);
    expect(journal.assessments('user_A')).toHaveLength(1);
    expect(memory.reads).toHaveLength(reads);
    expect(memory.writes).toHaveLength(1);
  });
  it('keeps every private data route closed to additional users in the one-key development trial', async () => {
    const trial = loadConfig({ NODE_ENV: 'development', MAPLE_AM_ACCESS_MODE: 'single-user-development', APP_ORIGIN: origin,
      CLERK_PUBLISHABLE_KEY: config.publishableKey, CLERK_SECRET_KEY: config.secretKey, CLERK_JWT_KEY: config.jwtKey,
      MAPLE_JOURNAL_PATH: '.local/test-journal.sqlite', MAPLE_AM_BINDINGS_FILE: 'test-bindings', AM_A_READ_KEY: 'test-full-access', AM_A_WRITE_KEY: 'test-full-access' },
    () => JSON.stringify([{ ownerId: 'user_A', endpoint: 'https://a.example.test', context: 'ctx_a', readKeyEnv: 'AM_A_READ_KEY', writeKeyEnv: 'AM_A_WRITE_KEY' }]));
    const journal = new Journal(':memory:'); journals.push(journal);
    let storageCalls = 0;
    const unexpected = async () => { storageCalls++; throw new Error('unexpected memory access'); };
    const workflow = new Workflow(journal, { read: unexpected, write: unexpected, reconcile: unexpected }, owner => bindingFor(trial, owner));
    const application = createApp({ config: trial, workflow });
    const other = token({ sub: 'user_B', sid: 'sess_B' });
    expect((await request(application).get('/api/session').auth(token(), { type: 'bearer' })).body.workspaceReady).toBe(true);
    expect((await request(application).get('/api/session').auth(other, { type: 'bearer' })).body).toEqual({ ownerId: 'user_B', workspaceReady: false });
    for (const path of ['/api/employment', '/api/proposals', '/api/notifications', '/api/assessments', '/api/policies']) {
      const result = await request(application).get(path).auth(other, { type: 'bearer' });
      expect(result.status).toBe(503);
      expect(result.body.error.code).toBe('CONTEXT_NOT_PROVISIONED');
    }
    expect((await request(application).post('/api/proposals').set('Origin', origin).auth(other, { type: 'bearer' }).send({})).status).toBe(503);
    expect((await request(application).get('/health/ready')).body.memoryAccessMode).toBe('single-user-development');
    expect(storageCalls).toBe(0);
    expect(journal.list('user_B')).toEqual([]);
  });
  it('allows sign-in bootstrap and verified self-identification while AM remains unavailable', async () => {
    const application = createApp({ authConfig: config });
    const bootstrap = await request(application).get('/api/config');
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body).toEqual({ clerkPublishableKey: config.publishableKey });
    expect(bootstrap.headers['cache-control']).toBe('no-store');
    const result = await request(application).get('/api/session?ownerId=user_B').set('x-owner-id', 'user_B').auth(token(), { type: 'bearer' });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ownerId: 'user_A', workspaceReady: false });
    expect(result.headers['cache-control']).toBe('no-store');
    expect((await request(application).get('/health/ready')).status).toBe(503);
    for (const path of ['/api/employment', '/api/proposals', '/api/notifications', '/api/assessments']) {
      expect((await request(application).get(path).auth(token(), { type: 'bearer' })).status).toBe(503);
    }
    expect((await request(application).post('/api/proposals').set('Origin', origin).auth(token(), { type: 'bearer' }).send({})).status).toBe(503);
  });
  it('does not expose any identity to missing or forged sessions during setup', async () => {
    const application = createApp({ authConfig: config });
    for (const jwt of [undefined, token({}, true)]) {
      const req = request(application).get('/api/session');
      if (jwt) req.auth(jwt, { type: 'bearer' });
      const result = await req;
      expect(result.status).toBe(401);
      expect(result.body).not.toHaveProperty('ownerId');
      expect(JSON.stringify(result.body)).not.toContain(config.secretKey);
    }
    expect((await request(application).get('/api/session').set('Origin', 'https://attacker.example').auth(token(), { type: 'bearer' })).status).toBe(403);
  });
  it('keeps an authenticated unmapped user out of a configured workspace', async () => {
    const journal = new Journal(':memory:'); journals.push(journal);
    const bindings = new Map([['user_A', { ownerId: 'user_A', endpoint: 'https://a.example.test', context: 'ctx_a', readKey: 'test-read', writeKey: 'test-write' }]]);
    const application = createApp({ config: { ...config, bindings }, workflow: new Workflow(journal, new TestMemory(), owner => {
      const binding = bindings.get(owner); if (!binding) throw new Error('unexpected storage access'); return binding;
    }) });
    expect((await request(application).get('/api/session').auth(token(), { type: 'bearer' })).body).toEqual({ ownerId: 'user_A', workspaceReady: true });
    expect((await request(application).get('/api/session').auth(token({ sub: 'user_B', sid: 'sess_B' }), { type: 'bearer' })).body)
      .toEqual({ ownerId: 'user_B', workspaceReady: false });
    expect(journal.list('user_B')).toEqual([]);
  });
  it('isolates real authenticated HTTP assessments and notifications, and refuses owner injection', async () => {
    const journal = new Journal(':memory:'); journals.push(journal);
    const memory = new TestMemory();
    const now = () => new Date('2026-10-24T15:00:00Z');
    const workflow = new Workflow(journal, memory, ownerId => ({ ownerId, endpoint: `https://${ownerId.toLowerCase().replace('_', '-')}.example.test`, context: `private-${ownerId}`, readKey: `test-read-${ownerId}`, writeKey: `test-write-${ownerId}` }), now);
    const policy = syntheticPolicy();
    const assessments = new Assessments(journal, workflow, new PolicyRegistry([policy], [policyDigest(policy)]), now);
    const application = createApp({ config, workflow, assessments });
    const a = token(); const b = token({ sub: 'user_B', sid: 'sess_B' });
    const post = (path: string, jwt: string, body: object) => request(application).post(path).set('Origin', origin).auth(jwt, { type: 'bearer' }).send(body);
    const employment = { employer: 'Test-only employer', title: 'Test role', duties: '', startDate: '2025-01-01', currentJob: true,
      endDate: null, hoursPerWeek: 35, countryCode: 'CA', paid: 'yes', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
    const proposed = await post('/api/proposals', a, { baseRevision: 0, employment });
    expect(proposed.status).toBe(201);
    expect((await post(`/api/proposals/${proposed.body.id}/confirm`, b, { proposalRevision: 1 })).status).toBe(404);
    expect((await post(`/api/proposals/${proposed.body.id}/confirm`, a, { proposalRevision: 1 })).status).toBe(200);
    const assessed = await post('/api/assessments', a, { policyId: policy.id });
    expect(assessed.status).toBe(200);
    expect(assessed.body.freshness).toBe('current');
    expect((await post('/api/assessments', b, { policyId: policy.id, ownerId: 'user_A' })).status).toBe(400);
    const foreign = await request(application).get(`/api/assessments/${assessed.body.id}`).auth(b, { type: 'bearer' });
    expect(foreign.status).toBe(404);
    expect((await request(application).get('/api/assessments?ownerId=user_A').auth(b, { type: 'bearer' })).body).toEqual({ assessments: [] });
    expect((await request(application).get('/api/notifications?ownerId=user_A').auth(b, { type: 'bearer' })).body).toEqual({ notifications: [] });
    const inbox = await request(application).get('/api/notifications').auth(a, { type: 'bearer' });
    expect(inbox.body.notifications.map((value: { kind: string }) => value.kind).sort()).toEqual(['assessed', 'saved']);
    const repeated = await post('/api/assessments', a, { policyId: policy.id });
    expect(repeated.body.id).toBe(assessed.body.id);
    expect((await request(application).get('/api/notifications').auth(a, { type: 'bearer' })).body.notifications).toHaveLength(2);
    expect(inbox.headers['cache-control']).toBe('no-store');
  });
  it('denies missing and invalid tokens and ignores owner headers', async () => {
    expect((await request(app()).get('/api/employment').set('x-owner-id', 'user_A')).status).toBe(401);
    expect((await request(app()).get('/api/employment').auth('invalid-token', { type: 'bearer' })).status).toBe(401);
  });
  it('accepts a signed valid session token through the actual Clerk SDK', async () => {
    const result = await request(app()).get('/api/employment').auth(token(), { type: 'bearer' });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ revision: 0, employment: null });
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it.each([
    [{ exp: 1 }, false], [{ azp: 'https://attacker.example' }, false], [{ nbf: Math.floor(Date.now()/1000) + 3600 }, false], [{}, true],
  ])('denies expired, wrong-party, future or forged JWT %#', async (claims, wrong) => {
    expect((await request(app()).get('/api/employment').auth(token(claims, wrong), { type: 'bearer' })).status).toBe(401);
  });
  it('rejects unsafe origin before any mutation', async () => {
    const application = app();
    for (const badOrigin of [undefined, 'https://attacker.example']) {
      const req = request(application).post('/api/proposals').auth(token(), { type: 'bearer' });
      if (badOrigin) req.set('Origin', badOrigin);
      expect((await req.send({})).status).toBe(403);
    }
  });
  it('does not let a valid user read another user’s operations or notifications', async () => {
    const application = app();
    const result = await request(application).get('/api/proposals?ownerId=user_B').auth(token(), { type: 'bearer' });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ proposals: [] });
    expect((await request(application).get('/api/notifications').auth(token({ sub: 'user_B', sid: 'sess_B' }), { type: 'bearer' })).body).toEqual({ notifications: [] });
  });
  it('fails clearly without configuration and never exposes secrets', async () => {
    const application = createApp({});
    expect((await request(application).get('/health/ready')).status).toBe(503);
    const result = await request(application).get('/api/employment');
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe('CONFIGURATION_REQUIRED');
    expect(JSON.stringify(result.body)).not.toContain(config.secretKey);
  });
});
