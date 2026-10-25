import { afterEach, expect, it, vi } from 'vitest';
import request from 'supertest';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); });
it('imports the hosted entrypoint without a listener/timer or provider request, and fails closed without config', async () => {
  vi.stubEnv('APP_ORIGIN', '');
  const network = vi.spyOn(globalThis, 'fetch');
  const timer = vi.spyOn(globalThis, 'setInterval');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { default: app } = await import('../server/hosted-app.js');
  expect(network).not.toHaveBeenCalled();
  expect(timer).not.toHaveBeenCalled();
  const response = await request(app).get('/health/ready');
  expect(response.status).toBe(503);
  expect(response.body).toMatchObject({ configured: false, nativeMemoryAvailable: false });
  expect(network).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith('CONFIGURATION_REQUIRED');
  expect((await request(app).post('/api/native/messages').send({})).status).toBe(503);
});
