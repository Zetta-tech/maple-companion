import express from 'express';
import { buildRuntime } from './server/runtime.js';

// Vercel's recognized Express entrypoint. No port listener, background timer,
// credential pull or provisioning. Authentication remains in the shared app.
const app = express();
app.disable('x-powered-by');
let runtime: ReturnType<typeof buildRuntime> | undefined;
app.use(async (req, res, next) => {
  try { const current = await (runtime ??= buildRuntime()); current.app(req, res, next); }
  catch { res.status(503).json({ error: { code: 'STARTUP_UNAVAILABLE', message: 'Maple is not ready. No request was sent to memory.' } }); }
});
export default app;
