import { Surreal, type ConnectOptions } from 'surrealdb';
import { AppError } from './errors.js';

export type DatabaseEnvironment = 'development' | 'test' | 'production';
export type DatabaseConfig = {
  endpoint: string; namespace: string; database: string; username: string; password: string;
  environment: DatabaseEnvironment;
};

/** Separate from AM bindings. Reading configuration never connects or provisions. */
export function loadDatabaseConfig(environment: DatabaseEnvironment, env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const prefix = environment === 'test' ? 'MAPLE_TEST_DB_' : 'MAPLE_DB_';
  const fields = ['ENDPOINT', 'NAMESPACE', 'DATABASE', 'USERNAME', 'PASSWORD'] as const;
  const missing = fields.filter(field => !env[prefix + field]?.trim()).map(field => prefix + field);
  if (missing.length) throw new AppError(503, 'DATABASE_CONFIGURATION_REQUIRED', `Configuration required: ${missing.join(', ')}. No database request was sent.`);
  try {
    const endpoint = new URL(env[prefix + 'ENDPOINT']!);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash
      || !['', '/', '/rpc'].includes(endpoint.pathname)
      || !(['https:', 'wss:'].includes(endpoint.protocol)
        || (environment !== 'production' && local && ['http:', 'ws:'].includes(endpoint.protocol)))) throw new Error();
    const namespace = env[prefix + 'NAMESPACE']!;
    const database = env[prefix + 'DATABASE']!;
    // The designated databases were explicitly selected for this project.
    // Test configuration cannot redirect tests into development or production.
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(namespace) || database !== environment) throw new Error();
    return { endpoint: endpoint.toString().replace(/\/$/, ''), namespace, database,
      username: env[prefix + 'USERNAME']!, password: env[prefix + 'PASSWORD']!, environment };
  } catch { throw new AppError(503, 'DATABASE_CONFIGURATION_INVALID', 'Database configuration is invalid or targets the wrong environment. No database request was sent.'); }
}

/** Database-level system authentication; never a Clerk identity or an AM key. */
export function databaseConnectionOptions(config: DatabaseConfig): ConnectOptions {
  return {
    namespace: config.namespace, database: config.database,
    authentication: { namespace: config.namespace, database: config.database, username: config.username, password: config.password },
    reconnect: false, retry: false,
  };
}

/** Real SDK connector. No SQLite fallback, migrations, retries or model calls. */
export async function connectOperationalDatabase(config: DatabaseConfig): Promise<Surreal> {
  const db = new Surreal();
  try {
    await db.connect(config.endpoint, databaseConnectionOptions(config));
    return db;
  } catch {
    try { await db.close(); } catch { /* No credentials/provider details in the public error. */ }
    throw new AppError(503, 'DATABASE_UNAVAILABLE', 'The operational database could not be connected. No fallback store was opened.');
  }
}
