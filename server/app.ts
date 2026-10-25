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
import { nativeMessageSchema, type NativeChat } from './native-chat.js';
import type { DemoJourney } from './demo-journey.js';
import { demoSeed } from '../shared/demo.js';

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
export function createApp(options: { config?: Config; authConfig?: AuthConfig; configurationError?: AppError; workflow?: Workflow; assessments?: Assessments; nativeChat?: NativeChat; demoJourney?: DemoJourney; authentication?: Authentication; webRoot?: string; operationalStore?: 'surrealdb'; operationalReady?: () => boolean }) {
  const app = express();
  const authConfig = options.authConfig ?? options.config;
  app.disable('x-powered-by');
  // Clerk components need their own JS/connect hosts; tighten to actual instance hosts before deployment.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/health/ready', (_req, res) => {
    const configured = !!options.config && !!options.workflow && (options.operationalReady?.() ?? true);
    res.status(configured ? 200 : 503).json({ configured, authConfigured: !!authConfig,
      memoryAccessMode: options.config?.amAccessMode ?? null, operationalStore: options.operationalStore ?? null,
      nativeMemoryAvailable: !!options.nativeChat && options.config?.amAccessMode === 'single-user-development',
      nativeMemoryMode: 'remember-profile', liveIntegrationsVerified: false });
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
  app.use('/api', async (_req, res, next) => {
    if (!options.config || !options.workflow) return next(options.configurationError ?? new AppError(503, 'CONFIGURATION_REQUIRED', 'Your private workspace is not configured yet. No data was saved.'));
    // Binding removal closes every workspace route, including journal-only history.
    bindingFor(options.config, res.locals.owner);
    await options.workflow.journal.expireChat(res.locals.owner, new Date().toISOString());
    next();
  });
  app.use('/api', express.json({ limit: '32kb', strict: true }));
  const workflow = () => options.workflow!;
  const nativeChat = options.config?.amAccessMode === 'single-user-development' ? options.nativeChat : undefined;
  const native = () => {
    if (!nativeChat) throw new AppError(503, 'NATIVE_CHAT_NOT_READY', 'Native memory setup is pending. Reviewed assessment inputs remain available.');
    return nativeChat;
  };
  const assessments = options.assessments ?? (options.workflow ? new Assessments(options.workflow.journal, options.workflow) : undefined);
  const id = (value: unknown) => z.uuid().parse(value);
  const demo = () => {
    if (!options.demoJourney || options.config?.amAccessMode !== 'single-user-development') throw new AppError(503,'DEMO_NOT_READY','The fictional demonstration workspace is not ready. Your existing workspace remains available.');
    return options.demoJourney;
  };
  app.get('/api/demo/status', (_req,res)=>res.json({available:!!options.demoJourney && options.config?.amAccessMode==='single-user-development',fictionalOnly:true}));
  app.get('/api/demo/seed', (_req,res)=>{demo();res.json({profile:demoSeed});});
  app.get('/api/demo/profile', async(_req,res)=>res.json(await demo().profile(res.locals.owner)));
  app.get('/api/demo/proposals', async(_req,res)=>res.json({proposals:await demo().store.proposals(res.locals.owner)}));
  app.post('/api/demo/proposals', async(req,res)=>res.status(201).json(await demo().propose(res.locals.owner,req.body)));
  app.post('/api/demo/proposals/:id/confirm', async(req,res)=>res.json(await demo().confirm(res.locals.owner,id(req.params.id),req.body)));
  app.post('/api/demo/proposals/:id/reject', async(req,res)=>{z.strictObject({}).parse(req.body);await demo().store.reject(res.locals.owner,id(req.params.id));res.json({status:'rejected'});});
  app.get('/api/demo/journey', async(_req,res)=>res.json(await demo().history(res.locals.owner)));
  app.post('/api/demo/discover', async(req,res)=>res.json(await demo().discover(res.locals.owner,req.body)));
  app.post('/api/demo/policy-replay', async(req,res)=>res.json(await demo().replay(res.locals.owner,req.body)));
  app.get('/api/employment', async (_req, res) => res.json(await workflow().read(res.locals.owner)));
  app.get('/api/native/status', async (_req, res) => res.json({ available: !!nativeChat, syntheticOnly: true,
    history: nativeChat ? await nativeChat.history(res.locals.owner) : [] }));
  app.get('/api/native/profile', async (_req, res) => res.json(await native().profile(res.locals.owner)));
  app.post('/api/native/messages', async (req, res) => {
    const channel = native();
    const message = nativeMessageSchema.parse(req.body);
    // Claim failures may be ambiguous too. From this point onward, no error may
    // assert that the native request was never started, regardless of status/code.
    res.locals.nativeRequestStarted = true;
    res.json(await channel.send(res.locals.owner, message));
  });
  app.get('/api/proposals', async (_req, res) => res.json({ proposals: await workflow().journal.list(res.locals.owner) }));
  app.post('/api/proposals', async (req, res) => res.status(201).json(await workflow().propose(res.locals.owner, req.body)));
  app.post('/api/proposals/:id/confirm', async (req, res) => res.json(await workflow().confirm(res.locals.owner, id(req.params.id), req.body)));
  app.post('/api/proposals/:id/reject', async (req, res) => {
    confirmationSchema.parse(req.body);
    res.json(await workflow().journal.reject(res.locals.owner, id(req.params.id)));
  });
  app.post('/api/proposals/:id/reconcile', async (req, res) => {
    z.strictObject({}).parse(req.body);
    res.json(await workflow().reconcile(res.locals.owner, id(req.params.id)));
  });
  app.get('/api/notifications', async (_req, res) => res.json({ notifications: await workflow().journal.notifications(res.locals.owner) }));
  app.get('/api/policies', (_req, res) => res.json({ policies: assessments!.available() }));
  app.post('/api/assessments', async (req, res) => res.json(await assessments!.run(res.locals.owner, req.body)));
  app.get('/api/assessments', async (_req, res) => res.json({ assessments: await assessments!.list(res.locals.owner) }));
  app.get('/api/assessments/:id', async (req, res) => res.json(await assessments!.get(res.locals.owner, id(req.params.id))));
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'This endpoint was not found.')));
  app.use(express.static(options.webRoot ?? resolve('dist/web')));
  const errors: ErrorRequestHandler = (error, req, res, _next) => {
    // This marker comes only from our known server execution boundary, never an
    // exception's properties or a provider/proxy HTTP status.
    const beforeNative = req.method === 'POST' && req.path === '/api/native/messages' && res.locals.nativeRequestStarted !== true;
    const nativeReceipt = beforeNative ? { nativeRequestState: 'not_started' } : {};
    if (error instanceof ZodError) { res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: res.locals.nativeRequestStarted === true
      ? 'This update could not be verified. Check its status before sending it again.'
      : 'Review the submitted fields and dates. No change was saved.', ...nativeReceipt } }); return; }
    if (error instanceof AppError) { res.status(error.status).json({ error: { code: error.code, message: error.message, ...nativeReceipt } }); return; }
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'The submitted information is too long. Shorten your message and send it again.', ...nativeReceipt } }); return; }
    if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: { code: 'INVALID_JSON', message: 'The submitted information could not be read. No change was saved.', ...nativeReceipt } }); return; }
    // Do not reflect provider payloads, tokens, database paths, or personal values.
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'This request could not be completed. Check the change status before submitting again.', ...nativeReceipt } });
  };
  app.use(errors);
  return app;
}
