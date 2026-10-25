# Express framework detection repair

Production attempt `dpl_4c4AbjmLd2P1P4KHG1gpTbpEnPXx` built merged PR10 (`0a1c314e`) successfully through TypeScript, Vite and asset packaging, then failed before going live: `No entrypoint found which imports express. Found possible entrypoint: app.mjs`.

The earlier local check exercised `@vercel/node`, which does not run the Express framework's entrypoint detector. The official `@vercel/express@22.0.2` adapter reproduced the exact failure. Its documented entry requires a direct Express import plus a default application export. Root `app.mjs` now creates a thin Express app, disables its identifying header and delegates to the same compiled, lazy-initialized hosted app. Authentication, rate limits, route handlers, configuration loading and private-service initialization remain in the existing runtime.

Verification passed: 673 tests, typecheck, build and frontend packaging; an exact compiled-entry smoke check returned 503 for readiness/native requests with deliberately invalid configuration and zero provider calls. The actual pinned Express adapter then produced a Node24 Lambda with handler `app.mjs`, the compiled hosted entry, expected filesystem/fallback routes and 558 files, without environment files or local diagnostics. The adapter tool is installed outside application dependencies; GitHub CI now performs this framework check after its existing build. Vercel still runs only its build/package steps.

This is local framework/artifact verification, not successful hosted deployment or production memory validation. The failed deployment was not retried unchanged. No production records, credentials, authentication settings or localhost recording process were changed. A reviewed merge and deployment are needed before hosted route/login validation.

Reference: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express#exporting-the-express-application).
