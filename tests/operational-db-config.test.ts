import { describe, expect, it } from 'vitest';
import { databaseConnectionOptions, loadDatabaseConfig } from '../server/operational-db.js';

const env = { MAPLE_DB_ENDPOINT: 'wss://fixture.example', MAPLE_DB_NAMESPACE: 'maple', MAPLE_DB_DATABASE: 'development',
  MAPLE_DB_USERNAME: 'fixture-dev', MAPLE_DB_PASSWORD: 'synthetic-password',
  MAPLE_TEST_DB_ENDPOINT: 'https://fixture.example', MAPLE_TEST_DB_NAMESPACE: 'maple', MAPLE_TEST_DB_DATABASE: 'test',
  MAPLE_TEST_DB_USERNAME: 'fixture-test', MAPLE_TEST_DB_PASSWORD: 'synthetic-test-password' };

describe('operational database target separation (configuration only, no database claims)', () => {
  it('keeps development and test credentials and targets separate', () => {
    expect(loadDatabaseConfig('development', env)).toMatchObject({ namespace: 'maple', database: 'development', username: 'fixture-dev' });
    expect(loadDatabaseConfig('test', env)).toMatchObject({ namespace: 'maple', database: 'test', username: 'fixture-test' });
  });
  it.each(['development', 'production'])('rejects a test credential configured for %s', database => {
    expect(() => loadDatabaseConfig('test', { ...env, MAPLE_TEST_DB_DATABASE: database })).toThrow('wrong environment');
  });
  it('never falls back to development credentials when test configuration is missing', () => {
    expect(() => loadDatabaseConfig('test', { MAPLE_DB_ENDPOINT: env.MAPLE_DB_ENDPOINT })).toThrow('MAPLE_TEST_DB_');
  });
  it.each(['https://user:password@fixture.example', 'https://fixture.example?key=secret', 'https://fixture.example/api/v1/context', 'http://fixture.example'])('rejects an unsafe/AM endpoint without printing it', endpoint => {
    expect(() => loadDatabaseConfig('development', { ...env, MAPLE_DB_ENDPOINT: endpoint })).toThrow('Database configuration is invalid');
  });
  it('allows loopback development but never plaintext production', () => {
    expect(loadDatabaseConfig('development', { ...env, MAPLE_DB_ENDPOINT: 'http://127.0.0.1:8000' }).database).toBe('development');
    expect(() => loadDatabaseConfig('production', { ...env, MAPLE_DB_DATABASE: 'production', MAPLE_DB_ENDPOINT: 'http://127.0.0.1:8000' })).toThrow();
  });
  it('authenticates at database scope and disables automatic replay', () => {
    const options = databaseConnectionOptions(loadDatabaseConfig('test', env));
    expect(options).toEqual({ namespace: 'maple', database: 'test', authentication: {
      namespace: 'maple', database: 'test', username: 'fixture-test', password: 'synthetic-test-password',
    }, reconnect: false, retry: false });
  });
});
