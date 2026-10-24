import { createApp } from './app.js';
import { loadAuthConfig, loadConfig, bindingFor, type AuthConfig, type Config } from './config.js';
import { AppError } from './errors.js';
import { Journal } from './journal.js';
import { Workflow } from './workflow.js';
import { createAgentMemory } from './am.js';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { PolicyRegistry } from './policies.js';
import { Assessments } from './assessments.js';

let config: Config | undefined;
let authConfig: AuthConfig | undefined;
let configurationError: AppError | undefined;
let workflow: Workflow | undefined;
let assessments: Assessments | undefined;
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
  workflow = new Workflow(new Journal(config.journalPath), createAgentMemory(), owner => bindingFor(config!, owner));
  assessments = new Assessments(workflow.journal, workflow, policies);
} catch (error) {
  configurationError = error instanceof AppError ? error : new AppError(503, 'JOURNAL_UNAVAILABLE', 'The operation journal is unavailable. No data was saved.');
  config = undefined;
  console.error(configurationError.code); // No config values or provider errors in logs.
}
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const server = createApp({ config, authConfig, configurationError, workflow, assessments }).listen(port, '127.0.0.1', () => console.log(`Maple listening on loopback port ${port}`));
function close() { server.close(() => { workflow?.journal.close(); process.exit(0); }); }
process.on('SIGTERM', close); process.on('SIGINT', close);
