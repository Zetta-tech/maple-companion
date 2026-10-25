import { cp, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Only compiled frontend assets are public. No source, bindings, policy files,
// .env, runtime records or evidence directory is copied to the CDN.
const root = process.cwd();
// Importing the lazy app proves the compiled ESM entry resolves, without
// loading credentials, starting a listener or connecting to memory/database.
const { default: app } = await import('../app.mjs');
if (typeof app !== 'function') throw new Error('The compiled Express entrypoint is unavailable.');
const source = resolve(root, 'dist/web');
const target = resolve(root, 'public');
await readFile(resolve(source, 'index.html')); // Fail rather than package an absent build.
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log('Packaged compiled frontend assets for Vercel. No deployment performed.');
