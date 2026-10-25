import { mkdtemp, rm, writeFile, utimes, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';

const roots: string[] = [];
const stamp = new Date('2018-10-20T01:46:40Z');
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'maple-html-cache-'));
  roots.push(root);
  await writeFile(join(root, 'index.html'), '<script src="/assets/old.js"></script>');
  await utimes(join(root, 'index.html'), stamp, stamp);
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets/new.js'), 'window.loaded = true;');
  return root;
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe('HTML deployment freshness', () => {
  it.each(['/', '/index.html', '/?release=current'])('replaces stale equal-sized HTML at %s despite matching old validators', async path => {
    const root = await fixture();
    const old = await request(express().use(express.static(root))).get('/').expect(200);
    const oldTag = old.headers.etag;
    const oldModified = old.headers['last-modified'];
    if (!oldTag || !oldModified) throw new Error('Baseline validators missing');
    await writeFile(join(root, 'index.html'), '<script src="/assets/new.js"></script>');
    await utimes(join(root, 'index.html'), stamp, stamp);
    // Demonstrate the real failure: same size and normalized mtime falsely 304.
    await request(express().use(express.static(root))).get('/').set('If-None-Match', oldTag).expect(304);
    const app = createApp({ webRoot: root });
    for (const validator of [{ 'If-None-Match': oldTag }, { 'If-Modified-Since': oldModified }]) {
      const response = await request(app).get(path).set(validator).expect(200);
      expect(response.text).toContain('/assets/new.js');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.etag).toBeUndefined();
      expect(response.headers['last-modified']).toBeUndefined();
    }
  });
  it('retains conditional caching for assets and does not route missing assets to HTML', async () => {
    const root = await fixture();
    const app = createApp({ webRoot: root });
    const first = await request(app).get('/assets/new.js').expect(200);
    const assetTag = first.headers.etag;
    if (!assetTag) throw new Error('Asset validator missing');
    await request(app).get('/assets/new.js').set('If-None-Match', assetTag).expect(304);
    await request(app).get('/assets/missing.js').expect(404);
    const head = await request(app).head('/').expect(200);
    expect(head.headers['cache-control']).toBe('no-store');
    expect(head.headers.etag).toBeUndefined();
  });
});
