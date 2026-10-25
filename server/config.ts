import { readFileSync } from 'node:fs';
import { createPublicKey } from 'node:crypto';
import { z } from 'zod';
import type { Binding } from './am.js';
import { AppError } from './errors.js';

const authRequired = ['APP_ORIGIN', 'CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'] as const;
const required = [...authRequired, 'MAPLE_AM_BINDINGS_FILE'] as const;
export type AuthConfig = { origin: string; publishableKey: string; secretKey: string; jwtKey?: string };
export type AmAccessMode = 'restricted' | 'single-user-development' | 'single-owner-production';
export type Config = AuthConfig & { amAccessMode: AmAccessMode; journalPath?: string; policyFile?: string; bindings: Map<string, Binding> };
const identityFields = {
  ownerId: z.string().regex(/^user_[a-zA-Z0-9]+$/), endpoint: z.string(), context: z.string().regex(/^[a-zA-Z0-9_-]+$/),
};
const bindingSchema = z.array(z.strictObject({
  ...identityFields,
  readKeyEnv: z.string().regex(/^AM_[A-Z0-9_]+_READ_KEY$/), writeKeyEnv: z.string().regex(/^AM_[A-Z0-9_]+_WRITE_KEY$/),
  nativePrincipalId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  nativeScope: z.string().regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/).optional(),
}).refine(value => Boolean(value.nativePrincipalId) === Boolean(value.nativeScope), 'Native principal and scope must be configured together.')).min(1);

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const missing = authRequired.filter(key => !env[key]?.trim());
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
    return { origin: origin.origin, publishableKey: env.CLERK_PUBLISHABLE_KEY!, secretKey: env.CLERK_SECRET_KEY!, jwtKey };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'CONFIGURATION_INVALID', 'Server configuration is invalid. No data was saved.');
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, read = (path: string) => readFileSync(path, 'utf8')): Config {
  const missing = required.filter(key => !(key === 'MAPLE_AM_BINDINGS_FILE' && env.MAPLE_AM_BINDINGS_JSON?.trim()) && !env[key]?.trim());
  if (missing.length) throw new AppError(503, 'CONFIGURATION_REQUIRED', `Configuration required: ${missing.join(', ')}. No data was saved.`);
  const auth = loadAuthConfig(env);
  try {
    const amAccessMode = z.enum(['restricted', 'single-user-development', 'single-owner-production']).parse(env.MAPLE_AM_ACCESS_MODE ?? 'restricted');
    if (amAccessMode === 'single-user-development') {
      const origin = new URL(auth.origin);
      if (env.NODE_ENV !== 'development' || origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname)
        || !auth.publishableKey.startsWith('pk_test_') || !auth.secretKey.startsWith('sk_test_')) {
        throw new AppError(503, 'DEVELOPMENT_MODE_REJECTED', 'Single-user AM development requires NODE_ENV=development, a loopback HTTP origin and Clerk test keys. No data was saved.');
      }
    }
    if (amAccessMode === 'single-owner-production') {
      const origin = new URL(auth.origin);
      if (env.NODE_ENV !== 'production' || origin.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
        || !auth.publishableKey.startsWith('pk_live_') || !auth.secretKey.startsWith('sk_live_')) {
        throw new AppError(503, 'PRODUCTION_MODE_REJECTED', 'The single-owner production mode requires a fixed HTTPS origin and Clerk production keys.');
      }
    }
    // Optional legacy source is retained only for migration verification, never runtime writes.
    if (env.MAPLE_JOURNAL_PATH === ':memory:' || /^file:/i.test(env.MAPLE_JOURNAL_PATH!)) throw new Error();
    const bindings = new Map<string, Binding>();
    const contexts = new Set<string>();
    const endpoints = new Set<string>();
    const keys = new Set<string>();
    if (env.MAPLE_AM_BINDINGS_JSON?.trim() && env.MAPLE_AM_BINDINGS_FILE?.trim()) throw new Error();
    // Inline JSON contains identity/host/key ENV NAMES only, never key values.
    const rawBindings: unknown = JSON.parse(env.MAPLE_AM_BINDINGS_JSON?.trim() || read(env.MAPLE_AM_BINDINGS_FILE!));
    const entries = (amAccessMode !== 'restricted' ? bindingSchema.length(1) : bindingSchema).parse(rawBindings);
    for (const entry of entries) {
      const endpoint = new URL(entry.endpoint);
      if (endpoint.origin !== entry.endpoint || endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error();
      const readKey = env[entry.readKeyEnv]?.trim();
      const writeKey = env[entry.writeKeyEnv]?.trim();
      if (!readKey || !writeKey) throw new AppError(503, 'CONFIGURATION_REQUIRED', `Configuration required: ${[...new Set([entry.readKeyEnv, entry.writeKeyEnv])].join(', ')}. No data was saved.`);
      if (bindings.has(entry.ownerId) || contexts.has(entry.context) || endpoints.has(endpoint.origin)
        || (amAccessMode !== 'single-user-development' && readKey === writeKey) || keys.has(readKey) || keys.has(writeKey)
        || (amAccessMode === 'single-owner-production' && !entry.nativePrincipalId)) throw new Error();
      contexts.add(entry.context); endpoints.add(endpoint.origin); keys.add(readKey); keys.add(writeKey);
      bindings.set(entry.ownerId, { ownerId: entry.ownerId, endpoint: endpoint.origin, context: entry.context, readKey, writeKey,
        ...(entry.nativePrincipalId ? { nativePrincipalId: entry.nativePrincipalId, nativeScope: entry.nativeScope } : {}) });
    }
    return { ...auth, amAccessMode,
      journalPath: env.MAPLE_JOURNAL_PATH?.trim() || undefined, policyFile: env.MAPLE_REVIEWED_POLICIES_FILE?.trim() || undefined, bindings };
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
