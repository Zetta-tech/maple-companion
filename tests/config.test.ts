import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { loadAuthConfig, loadConfig, bindingFor } from '../server/config.js';

const binding = { ownerId: 'user_A', endpoint: 'https://alice.memory.example.test', context: 'private-a', readKeyEnv: 'AM_A_READ_KEY', writeKeyEnv: 'AM_A_WRITE_KEY' };
const env = { APP_ORIGIN: 'http://localhost:3000', CLERK_PUBLISHABLE_KEY: 'pk_test_fixture', CLERK_SECRET_KEY: 'sk_test_fixture',
  MAPLE_AM_BINDINGS_FILE: 'test-bindings', MAPLE_JOURNAL_PATH: '.local/test-operations.sqlite',
  AM_A_READ_KEY: 'fixture-read-only', AM_A_WRITE_KEY: 'fixture-write-only' };
describe('fail-closed configuration', () => {
  it('validates sign-in before any AM binding or journal is available', () => {
    const authOnly = { APP_ORIGIN: env.APP_ORIGIN, CLERK_PUBLISHABLE_KEY: env.CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY: env.CLERK_SECRET_KEY };
    expect(loadAuthConfig(authOnly)).toMatchObject({ origin: env.APP_ORIGIN, publishableKey: env.CLERK_PUBLISHABLE_KEY });
    expect(() => loadConfig(authOnly)).toThrow('MAPLE_AM_BINDINGS_FILE');
    expect(() => loadAuthConfig({ ...authOnly, CLERK_JWT_KEY: 'invalid' })).toThrow('complete RSA public PEM');
  });
  it('accepts blank optional JWT verification configuration as absent', () => {
    expect(loadConfig({ ...env, CLERK_JWT_KEY: '  ' }, () => JSON.stringify([binding])).jwtKey).toBeUndefined();
  });
  it('accepts a complete locally generated RSA public PEM', () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    expect(loadConfig({ ...env, CLERK_JWT_KEY: pem }, () => JSON.stringify([binding])).jwtKey).toBe(pem.trim());
  });
  it.each(['short-invalid-fixture', '-----BEGIN PUBLIC KEY-----', 'test.header.signature'])('rejects malformed optional JWT config without echoing it', jwtKey => {
    expect(() => loadConfig({ ...env, CLERK_JWT_KEY: jwtKey }, () => JSON.stringify([binding])))
      .toThrow('CLERK_JWT_KEY must be a complete RSA public PEM key, or left blank.');
  });
  it.each([':memory:', 'file::memory:?cache=shared'])('rejects volatile runtime journal %s', journalPath => {
    expect(() => loadConfig({ ...env, MAPLE_JOURNAL_PATH: journalPath }, () => JSON.stringify([binding]))).toThrow('invalid');
  });
  it('lists missing names without starting a demo', () => {
    expect(() => loadConfig({})).toThrow('CLERK_PUBLISHABLE_KEY');
    expect(() => loadConfig({})).toThrow('MAPLE_AM_BINDINGS_FILE');
  });
  it('resolves only an explicit unique owner/context binding', () => {
    const config = loadConfig(env, () => JSON.stringify([binding]));
    expect(bindingFor(config, 'user_A').context).toBe('private-a');
    expect(() => bindingFor(config, 'user_B')).toThrow('not configured');
  });
  it('loads a distinct HTTPS host for each private hosted Context', () => {
    const second = { ownerId: 'user_B', endpoint: 'https://bob.memory.example.test', context: 'private-b', readKeyEnv: 'AM_B_READ_KEY', writeKeyEnv: 'AM_B_WRITE_KEY' };
    const config = loadConfig({ ...env, AM_B_READ_KEY: 'test-b-read', AM_B_WRITE_KEY: 'test-b-write' }, () => JSON.stringify([binding, second]));
    expect(bindingFor(config, 'user_A').endpoint).toBe(binding.endpoint);
    expect(bindingFor(config, 'user_B').endpoint).toBe(second.endpoint);
    expect(bindingFor(config, 'user_B').readKey).toBe('test-b-read');
  });
  it('does not fall back to a legacy global AM_ENDPOINT when a user host is missing', () => {
    const { endpoint: _endpoint, ...legacy } = binding;
    expect(() => loadConfig({ ...env, AM_ENDPOINT: 'https://legacy.memory.example.test' }, () => JSON.stringify([legacy]))).toThrow('invalid');
  });
  it('rejects a shared hosted endpoint even with different Context IDs and keys', () => {
    const second = { ...binding, ownerId: 'user_B', context: 'private-b', readKeyEnv: 'AM_B_READ_KEY', writeKeyEnv: 'AM_B_WRITE_KEY' };
    expect(() => loadConfig({ ...env, AM_B_READ_KEY: 'test-b-read', AM_B_WRITE_KEY: 'test-b-write' }, () => JSON.stringify([binding, second]))).toThrow('invalid');
  });
  it.each(['http://memory.example.test', 'https://memory.example.test/path', 'https://user:pass@memory.example.test', 'https://memory.example.test?key=secret'])('rejects unsafe AM endpoint %s', endpoint => {
    expect(() => loadConfig(env, () => JSON.stringify([{ ...binding, endpoint }]))).toThrow('invalid');
  });
  it('rejects shared context and reused read/write key', () => {
    expect(() => loadConfig(env, () => JSON.stringify([binding, { ...binding, ownerId: 'user_B' }]))).toThrow('invalid');
    expect(() => loadConfig({ ...env, AM_A_WRITE_KEY: env.AM_A_READ_KEY }, () => JSON.stringify([binding]))).toThrow('invalid');
  });
  it('does not echo malformed binding JSON, secrets or paths', () => {
    expect(() => loadConfig(env, () => 'private-secret')).toThrow('Server configuration is invalid.');
  });
  it('rejects mixed Clerk environments', () => {
    expect(() => loadConfig({ ...env, CLERK_SECRET_KEY: 'sk_live_fixture' }, () => JSON.stringify([binding]))).toThrow('invalid');
  });
});
