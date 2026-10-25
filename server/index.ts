import { buildRuntime } from './runtime.js';

const runtime = await buildRuntime();
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
let sweeping = false;
const sweepExpired = async () => {
  if (sweeping) return;
  sweeping = true;
  try { await runtime.sweepExpired(); }
  catch { console.error('CHAT_RETENTION_SWEEP_FAILED'); }
  finally { sweeping = false; }
};
void sweepExpired();
const sweep = setInterval(sweepExpired, 60_000).unref();
const server = runtime.app.listen(port, '127.0.0.1', () => console.log('Maple listening on loopback port ' + port));
function close() { clearInterval(sweep); server.close(async () => { try { await runtime.close(); } finally { process.exit(0); } }); }
process.on('SIGTERM', close); process.on('SIGINT', close);
