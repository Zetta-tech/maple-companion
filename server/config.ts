import { readFileSync } from 'node:fs';
import { createPublicKey } from 'node:crypto';
import { z } from 'zod';
import type { Binding } from './am.js';
import { AppError } from './errors.js';

const required = ['APP_ORIGIN', 'CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'MAPLE_AM_BINDINGS_FILE', 'MAPLE_JOURNAL_PATH'] as const;
export type Config = { origin: string; publishableKey: string; secretKey: string; jwtKey?: string; journalPath: string; policyFile?: string; bindings: Map<string, Binding> };
const bindingSchema = z.array(z.strictObject({
  ownerId: z.string().regex(/^user_[a-zA-Z0-9]+$/), endpoint: z.string(), context: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  readKeyEnv: z.string().regex(/^AM_[A-Z0-9_]+_READ_KEY$/), writeKeyEnv: z.string().regex(/^AM_[A-Z0-9_]+_WRITE_KEY$/),
})).min(1);

export function loadConfig(env: NodeJS.ProcessEnv = process.env, read = (path: string) => readFileSync(path, 'utf8')): Config {
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw new AppError(503, 'CONFIGURATION_REQUIRED', `Configuration required: ${missing.join(', ')}. No data was saved.`);
  try {
    const origin = new URL(env.APP_ORIGIN!);
    if (origin.origin !== env.APP_ORIGIN || origin.username || origin.password ||
      !(origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new Error();
    if (!/^pk_(test|live)_/.test(env.CLERK_PUBLISHABLE_KEY!) || !/^sk_(test|live)_/.test(env.CLERK_SECRET_KEY!)) throw new Error();
    if (env.CLERK_PUBLISHABLE_KEY!.split('_')[1] !== env.CLERK_SECRET_KEY!.split('_')[1]) throw new Error();
    const jwtKey = env.CLERK_JWT_KEY?.trim() || undefined;
    if (jwtKey) {
      try {
        if (!jwtKey.includes('-----BEGIN PUBLIC KEY-----') || !jwtKey.includes('-----END PUBLIC KEY-----')
          || /PRIVATE KEY/.test(jwtKey)) throw new Error();
        const publicKey = createPublicKey(jwtKey);
        if (publicKey.asymmetricKeyType !== 'rsa' || (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error();
      } catch { throw new AppError(503, 'CLERK_JWT_KEY_INVALID', 'CLERK_JWT_KEY must be a complete RSA public PEM key, or left blank. No data was saved.'); }
    }
    // Runtime durability is mandatory; in-memory journals exist only in automated tests.
    if (env.MAPLE_JOURNAL_PATH === ':memory:' || /^file:/i.test(env.MAPLE_JOURNAL_PATH!)) throw new Error();
    const bindings = new Map<string, Binding>();
    const contexts = new Set<string>();
    const endpoints = new Set<string>();
    const keys = new Set<string>();
    for (const entry of bindingSchema.parse(JSON.parse(read(env.MAPLE_AM_BINDINGS_FILE!)))) {
      const endpoint = new URL(entry.endpoint);
      if (endpoint.origin !== entry.endpoint || endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error();
      const readKey = env[entry.readKeyEnv]?.trim();
      const writeKey = env[entry.writeKeyEnv]?.trim();
      if (!readKey || !writeKey) throw new AppError(503, 'CONFIGURATION_REQUIRED', `Configuration required: ${entry.readKeyEnv}, ${entry.writeKeyEnv}. No data was saved.`);
      if (bindings.has(entry.ownerId) || contexts.has(entry.context) || endpoints.has(endpoint.origin) || readKey === writeKey || keys.has(readKey) || keys.has(writeKey)) throw new Error();
      contexts.add(entry.context); endpoints.add(endpoint.origin); keys.add(readKey); keys.add(writeKey);
      bindings.set(entry.ownerId, { ownerId: entry.ownerId, endpoint: endpoint.origin, context: entry.context, readKey, writeKey });
    }
    return { origin: origin.origin, publishableKey: env.CLERK_PUBLISHABLE_KEY!, secretKey: env.CLERK_SECRET_KEY!, jwtKey,
      journalPath: env.MAPLE_JOURNAL_PATH!, policyFile: env.MAPLE_REVIEWED_POLICIES_FILE?.trim() || undefined, bindings };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'CONFIGURATION_INVALID', 'Server configuration is invalid. No data was saved.');
  }
}

export function bindingFor(config: Pick<Config, 'bindings'>, ownerId: string): Binding {
  const binding = config.bindings.get(ownerId);
  if (!binding || binding.ownerId !== ownerId) throw new AppError(503, 'CONTEXT_NOT_PROVISIONED', 'Your private memory context is not configured yet. No data was saved.');
  return binding;
}
