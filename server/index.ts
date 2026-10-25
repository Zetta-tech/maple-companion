import { createApp } from './app.js';
import { loadAuthConfig, loadConfig, bindingFor, type AuthConfig, type Config } from './config.js';
import { AppError } from './errors.js';
import { loadDatabaseConfig } from './operational-db.js';
import { openRuntimeJournal } from './runtime-journal.js';
import type { Surreal } from 'surrealdb';
import { Workflow } from './workflow.js';
import { createAgentMemory } from './am.js';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { PolicyRegistry } from './policies.js';
import { Assessments } from './assessments.js';
import { createNativeChat, privateNativeDiagnostics, type NativeChat } from './native-chat.js';
import { SurrealNativeChatStore } from './native-chat-store.js';
import { SurrealDemoStore } from './demo-store.js';
import { createDemoMemory } from './demo-memory.js';
import { DemoJourney, privateGuideEvidence } from './demo-journey.js';
import { GuideSources } from './guide-sources.js';
import { loadDemoBindings } from './demo-config.js';

let config: Config | undefined;
let authConfig: AuthConfig | undefined;
let configurationError: AppError | undefined;
let workflow: Workflow | undefined;
let assessments: Assessments | undefined;
let nativeChat: NativeChat | undefined;
let demoJourney: DemoJourney | undefined;
let database: Surreal | undefined;
try {
  // Sign-in must work before the first authenticated user can be mapped to AM.
  // This validates configuration only; it sends no provider request.
  authConfig = loadAuthConfig();
  config = loadConfig();
  if (config.amAccessMode === 'single-user-development') console.warn('AM_SINGLE_USER_DEVELOPMENT_FULL_ACCESS');
  // Operator-controlled reviewed bundle only. No HTTP/model promotion route exists.
  const bundle = config.policyFile ? z.strictObject({ versions: z.array(z.unknown()), approvedDigests: z.array(z.string()) })
    .parse(JSON.parse(readFileSync(config.policyFile, 'utf8'))) : { versions: [], approvedDigests: [] };
  const policies = new PolicyRegistry(bundle.versions, bundle.approvedDigests);
  const databaseConfig = loadDatabaseConfig(process.env.NODE_ENV === 'production' ? 'production' : 'development');
  const opened = await openRuntimeJournal(databaseConfig, config.journalPath
    ? { path: config.journalPath, owners: [...config.bindings.keys()] } : undefined);
  database = opened.db;
  workflow = new Workflow(opened.journal, createAgentMemory(), owner => bindingFor(config!, owner));
  assessments = new Assessments(workflow.journal, workflow, policies);
  // Native raw-turn memory replaces the new-message six-label proposal path.
  // Historical form proposals still use the existing reviewed-evidence workflow.
  if (config.amAccessMode === 'single-user-development' && [...config.bindings.values()].every(b => b.nativePrincipalId && b.nativeScope)) {
    try {
      const store = new SurrealNativeChatStore(database);
      await store.ready();
      nativeChat = createNativeChat(owner => {
        const binding = bindingFor(config!, owner);
        if (!binding.nativePrincipalId || !binding.nativeScope) throw new AppError(503, 'NATIVE_BINDING_REQUIRED', 'Native memory identity setup is pending.');
        return { ...binding, principalId: binding.nativePrincipalId, principalMode: 'token', scope: binding.nativeScope };
      }, store, privateNativeDiagnostics('.local/native-chat-diagnostics'));
      if (process.env.MAPLE_GUIDE_SOURCES_FILE) {
        try {
          const demoStore = new SurrealDemoStore(database);
          await demoStore.ready();
          const demoBindings = loadDemoBindings(config);
          demoJourney = new DemoJourney(demoStore, createDemoMemory(owner => bindingFor({bindings:demoBindings},owner)),
            new GuideSources(process.env.MAPLE_GUIDE_SOURCES_FILE), privateGuideEvidence('.local/guide-diagnostics'));
        } catch { console.error('DEMO_JOURNEY_SETUP_REQUIRED'); }
      }
      const currentWorkflow = workflow;
      assessments = new Assessments(workflow.journal, workflow, policies, () => new Date(), async owner => {
        const messages = await store.list(owner);
        if (!messages.length) return true;
        if (messages.some(message => ['processing', 'uncertain'].includes(message.status))) return false;
        const latest = messages.reduce((a, b) => a.createdAt > b.createdAt ? a : b);
        const head = await currentWorkflow.journal.head(owner);
        const approved = (await currentWorkflow.journal.list(owner)).find(op => op.status === 'committed' && op.baseRevision + 1 === head.revision);
        return !!approved?.confirmedAt && approved.confirmedAt > latest.createdAt;
      });
    } catch { console.error('NATIVE_CHAT_SETUP_REQUIRED'); }
  }
} catch (error) {
  configurationError = error instanceof AppError ? error : new AppError(503, 'JOURNAL_UNAVAILABLE', 'The operation journal is unavailable. No data was saved.');
  config = undefined;
  workflow = undefined;
  try { await database?.close(); } catch { /* No credential/provider details in logs. */ }
  console.error(configurationError.code); // No config values or provider errors in logs.
}
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
let sweeping = false;
const sweepChat = async () => {
  if (sweeping) return;
  sweeping = true;
  try { if (config && workflow) for (const owner of config.bindings.keys()) await workflow.journal.expireChat(owner, new Date().toISOString()); }
  catch { console.error('CHAT_RETENTION_SWEEP_FAILED'); }
  finally { sweeping = false; }
};
sweepChat();
const sweep = setInterval(sweepChat, 60_000).unref();
const server = createApp({ config, authConfig, configurationError, workflow, assessments, nativeChat, demoJourney,
  webRoot: process.env.MAPLE_WEB_ROOT,
  operationalStore: 'surrealdb', operationalReady: () => database?.status === 'connected',
}).listen(port, '127.0.0.1', () => console.log(`Maple listening on loopback port ${port}`));
function close() { clearInterval(sweep); server.close(async () => { try { await workflow?.journal.close(); } finally { process.exit(0); } }); }
process.on('SIGTERM', close); process.on('SIGINT', close);
