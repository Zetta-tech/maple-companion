import { createRequire } from 'node:module';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

// Run after build: the official adapter is installed outside application dependencies.
// Explicit staging excludes source configuration, credentials and runtime diagnostics.
const toolsPath = process.argv[2];
if (!toolsPath) throw new Error('Pass the directory containing the pinned Vercel Express adapter.');
const require = createRequire(resolve(toolsPath, 'package.json'));
const { build } = require('@vercel/express');
const { FileFsRef } = require('@vercel/build-utils');
const version = require('@vercel/express/package.json').version;
if (version !== '22.0.2') throw new Error('Unexpected Vercel Express verification version.');
const source = process.cwd();
const stage = await mkdtemp(join(tmpdir(), 'maple-express-build-'));
for (const path of ['app.mjs', 'package.json', 'package-lock.json', 'dist', 'public', 'node_modules']) {
  await cp(resolve(source, path), resolve(stage, path), { recursive: true });
}
await readFile(resolve(stage, 'public/index.html'));
const result = await build({
  files: {
    'package.json': new FileFsRef({ fsPath: resolve(stage, 'package.json') }),
    'app.mjs': new FileFsRef({ fsPath: resolve(stage, 'app.mjs') }),
  },
  entrypoint: 'package.json', workPath: stage, repoRootPath: stage,
  meta: { skipDownload: true },
  config: {
    zeroConfig: true,
    excludeFiles: ['.local/**', '.env', '.env.*', 'tests/**', 'integration/**'],
    projectSettings: {
      nodeVersion: '24.x', framework: 'express', installCommand: '',
      // The preceding CI step already compiled and packaged the exact source.
      buildCommand: 'node -e "process.exit(0)"',
    },
  },
});
const output = result.output;
const files = Object.keys(output.files ?? {}).map(path => path.replaceAll('\\', '/'));
const forbidden = files.filter(path => /(^|\/)(?:\.env(?:\..*)?|\.local)(?:\/|$)|\.(?:sqlite|log)$/i.test(path));
if (output.type !== 'Lambda' || output.runtime !== 'nodejs24.x' || output.framework?.slug !== 'express'
  || !files.some(path => path.endsWith('dist/server/hosted-app.js')) || forbidden.length) {
  throw new Error('The Express artifact is incomplete or includes non-release files.');
}
console.log(JSON.stringify({ adapter: `@vercel/express@${version}`, runtime: output.runtime,
  handler: output.handler, framework: output.framework.slug, fileCount: files.length,
  compiledEntryIncluded: true, forbiddenFiles: forbidden, routes: result.routes }));
