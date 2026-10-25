import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';

const { buildRuntime } = vi.hoisted(() => ({ buildRuntime: vi.fn() }));
vi.mock('../server/runtime.js', () => ({ buildRuntime }));

beforeEach(() => { vi.resetModules(); buildRuntime.mockReset(); });

it('imports the hosted app without initializing private services and reuses initialization for requests', async () => {
  const runtime = express();
  runtime.get('/health/ready', (_req, res) => res.json({ configured: true }));
  buildRuntime.mockResolvedValue({ app: runtime });
  const { default: app } = await import('../server/hosted-app.js');
  expect(buildRuntime).not.toHaveBeenCalled();
  expect((await request(app).get('/health/ready')).body).toEqual({ configured: true });
  expect((await request(app).get('/health/ready')).status).toBe(200);
  expect(buildRuntime).toHaveBeenCalledTimes(1);
});

it('keeps failed startup private and does not repeatedly initialize on subsequent requests', async () => {
  buildRuntime.mockRejectedValue(new Error('private provider details'));
  const { default: app } = await import('../server/hosted-app.js');
  for (const path of ['/health/ready', '/api/employment']) {
    const response = await request(app).get(path);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('STARTUP_UNAVAILABLE');
    expect(response.text).not.toContain('private provider details');
  }
  expect(buildRuntime).toHaveBeenCalledTimes(1);
});
