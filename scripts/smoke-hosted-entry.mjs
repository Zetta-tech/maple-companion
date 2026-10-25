import assert from 'node:assert/strict';
import request from 'supertest';

// Exercise the exact compiled deployment entry without loading credentials.
// Invalid origin must fail closed before private services or memory can run.
process.env.APP_ORIGIN = '';
let providerRequests = 0;
globalThis.fetch = async () => { providerRequests++; throw new Error('Unexpected provider request in entry smoke check.'); };
const { default: app } = await import('../app.mjs');
for (const [method, path] of [['get', '/health/ready'], ['post', '/api/native/messages']]) {
  const response = await request(app)[method](path);
  assert.equal(response.status, 503);
  assert.equal(response.headers['x-powered-by'], undefined);
}
assert.equal(providerRequests, 0);
console.log('Compiled Express entry routes requests and fails closed without provider calls.');
