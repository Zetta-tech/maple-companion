// Vercel bundles the same NodeNext output checked by our build, rather than
// recompiling the TypeScript sources with a different module resolver.
export { default } from './dist/server/hosted-app.js';
