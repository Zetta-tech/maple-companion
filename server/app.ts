import express, { type RequestHandler, type ErrorRequestHandler } from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { resolve } from 'node:path';
import { AppError } from './errors.js';
import { bindingFor, type AuthConfig, type Config } from './config.js';
import { Workflow, confirmationSchema } from './workflow.js';
import { Assessments } from './assessments.js';

export type Authentication = { middleware: RequestHandler; owner: (req: express.Request) => string | null };
export function clerkAuthentication(config: AuthConfig): Authentication {
  return {
    middleware: clerkMiddleware({ publishableKey: config.publishableKey, secretKey: config.secretKey, jwtKey: config.jwtKey, authorizedParties: [config.origin] }),
    owner(req) {
      const auth = getAuth(req, { acceptsToken: 'session_token' });
      return auth.isAuthenticated && auth.userId ? auth.userId : null;
    },
  };
}

/** Dependency injection exists for unit tests; index.ts always constructs the real Clerk/AM adapters. */
export function createApp(options: { config?: Config; authConfig?: AuthConfig; configurationError?: AppError; workflow?: Workflow; assessments?: Assessments; authentication?: Authentication; webRoot?: string }) {
  const app = express();
  const authConfig = options.authConfig ?? options.config;
  app.disable('x-powered-by');
  // Clerk components need their own JS/connect hosts; tighten to actual instance hosts before deployment.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/health/ready', (_req, res) => {
    const configured = !!options.config && !!options.workflow;
    res.status(configured ? 200 : 503).json({ configured, authConfigured: !!authConfig,
      memoryAccessMode: options.config?.amAccessMode ?? null, liveIntegrationsVerified: false });
  });
  app.get('/api/config', (_req, res, next) => {
    if (!authConfig) return next(options.configurationError ?? new AppError(503, 'CONFIGURATION_REQUIRED', 'Maple is not configured yet. No data was saved.'));
    res.json({ clerkPublishableKey: authConfig.publishableKey });
  });
  app.use('/api', (req, _res, next) => {
    if (!authConfig) return next(options.configurationError ?? new AppError(503, 'CONFIGURATION_REQUIRED', 'Maple is not configured yet. No data was saved.'));
    const origin = req.get('Origin');
    if ((!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !origin) || (origin && origin !== authConfig.origin) || req.get('Sec-Fetch-Site') === 'cross-site') {
      return next(new AppError(403, 'ORIGIN_REJECTED', 'Open Maple at its configured address to make changes.'));
    }
    next();
  });
  const auth = options.authentication ?? (authConfig ? clerkAuthentication(authConfig) : undefined);
  if (auth) app.use('/api', auth.middleware);
  app.use('/api', (req, res, next) => {
    const owner = auth?.owner(req);
    if (!owner) return next(new AppError(401, 'UNAUTHENTICATED', 'Sign in to access your information.'));
    res.locals.owner = owner;
    next();
  });
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    keyGenerator: (_req, res) => String(res.locals.owner),
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Please wait a moment before trying again.')) }));
  // Only verified identity is exposed here. No AM call, journal write or automatic
  // provisioning occurs during first sign-in, even if a Context is not ready.
  app.get('/api/session', (_req, res) => res.json({ ownerId: res.locals.owner,
    workspaceReady: !!options.config && !!options.workflow && options.config.bindings.has(res.locals.owner) }));
  app.use('/api', (_req, res, next) => {
    if (!options.config || !options.workflow) return next(options.configurationError ?? new AppError(503, 'CONFIGURATION_REQUIRED', 'Your private workspace is not configured yet. No data was saved.'));
    // Binding removal closes every workspace route, including journal-only history.
    bindingFor(options.config, res.locals.owner);
    next();
  });
  app.use('/api', express.json({ limit: '32kb', strict: true }));
  const workflow = () => options.workflow!;
  const assessments = options.assessments ?? (options.workflow ? new Assessments(options.workflow.journal, options.workflow) : undefined);
  const id = (value: unknown) => z.uuid().parse(value);
  app.get('/api/employment', async (_req, res) => res.json(await workflow().read(res.locals.owner)));
  app.get('/api/proposals', (_req, res) => res.json({ proposals: workflow().journal.list(res.locals.owner) }));
  app.post('/api/proposals', async (req, res) => res.status(201).json(await workflow().propose(res.locals.owner, req.body)));
  app.post('/api/proposals/:id/confirm', async (req, res) => res.json(await workflow().confirm(res.locals.owner, id(req.params.id), req.body)));
  app.post('/api/proposals/:id/reject', (req, res) => {
    confirmationSchema.parse(req.body);
    res.json(workflow().journal.reject(res.locals.owner, id(req.params.id)));
  });
  app.post('/api/proposals/:id/reconcile', async (req, res) => {
    z.strictObject({}).parse(req.body);
    res.json(await workflow().reconcile(res.locals.owner, id(req.params.id)));
  });
  app.get('/api/notifications', (_req, res) => res.json({ notifications: workflow().journal.notifications(res.locals.owner) }));
  app.get('/api/policies', (_req, res) => res.json({ policies: assessments!.available() }));
  app.post('/api/assessments', async (req, res) => res.json(await assessments!.run(res.locals.owner, req.body)));
  app.get('/api/assessments', async (_req, res) => res.json({ assessments: await assessments!.list(res.locals.owner) }));
  app.get('/api/assessments/:id', async (req, res) => res.json(await assessments!.get(res.locals.owner, id(req.params.id))));
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'This endpoint was not found.')));
  app.use(express.static(options.webRoot ?? resolve('dist/web')));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) { res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Review the submitted fields and dates. No change was saved.' } }); return; }
    if (error instanceof AppError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'The submitted information is too long. No change was saved.' } }); return; }
    if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: { code: 'INVALID_JSON', message: 'The submitted information could not be read. No change was saved.' } }); return; }
    // Do not reflect provider payloads, tokens, database paths, or personal values.
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'This request could not be completed. Check the change status before submitting again.' } });
  };
  app.use(errors);
  return app;
}
