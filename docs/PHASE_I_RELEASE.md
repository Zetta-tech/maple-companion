# Single-owner release checkpoint

This is source/configuration preparation, not a deployed production service. The verified localhost demo remains on frozen build 3a412d4 for recording. PR8 was merged at 277688c; later correctness and hosting work is in draft PR9. Frontend polish is separate work; this change does not restart the demo.

## Implemented in source

- Native completion records an employment revision boundary under the confirmation guard. Only a later confirmed revision qualifies as fresh review. Assessment responses use a final revision/receipt/active fence; the browser suppresses conclusions during unresolved sends. Legacy receipts without completion evidence fail closed.
- Root app.ts and server/runtime.ts construct Express without a listener or background timer. build:vercel packages compiled frontend assets only. Local configuration and diagnostics are excluded; automatic Git deployments are disabled.
- single-owner-production requires HTTPS, production mode, Clerk live keys and exactly one configured owner/principal. No localhost/test-key fallback exists. MAPLE_AM_BINDINGS_JSON contains nonsecret bindings with server-secret environment references. Distinct keys alone do not prove restricted grants.
- Native memory accepts personal input in that mode. Provider evidence is durable owner/operation/purpose/digest/timestamp metadata, not private messages on the serverless filesystem.
- The personal /api/guide/* path reuses C20/CRS. It starts with unknown supplemental answers and derives employment from its confirmed receipt. AM holds an explicit reviewed assessment snapshot tied to that receipt, not a second editable employment profile. Changed employment/conversation evidence requires review. See [the frontend contract](PERSONAL_GUIDE_API.md).
- The shared Surreal information registry stores reviewed official bodies/URLs/hashes/dates, approved rule versions/digests and an active release. Runtime pins the approved digest and retrieves official pages to detect changed source content. Unavailable/changed guidance does not silently fall back to cached text.

## Registry preparation and approval

Prepared additive schemas, **not applied**:

- database/provider-evidence-v1.surql: one private metadata table.
- database/personal-guide-v1.surql: three private proposal/receipt/journey tables. Committed proposal payloads are cleared; confirmed inputs stay in AM.
- database/policy-registry-v1.surql: three shared official-information tables, no private facts.

Local candidate 2026-10-25.phase-i.v1 has digest 73407aaf2e09e085e389e4dfce92326b9a5eeb117ffb32ddff87ae90251aa54d: seven reviewed Guide sources and one previously approved CEC rule. CEC remains 2026-10-25.single-interval.v1, digest 2a4a9f8790ab98edd3a4e743d319f3f02e021510d668a4ceda4076aa530ace21. Calculator version is 2026-11-03.reviewed-evidence.v3. No rule effective date was inferred from a page modification date.

scripts/prepare-policy-release.ts prepares a local candidate. scripts/seed-policy-release.ts requires the approved exact digest and explicit test/production target. Seeding is transactional, refuses a different active release, verifies exact replay, and never changes schema or credentials. It has **not run against a hosted database**. Approve/test the schema and release, then seed production and set MAPLE_POLICY_RELEASE_DIGEST.

Coverage is curated C20 and Express Entry/CRS. Broad automated policy discovery/extraction is not implemented. C20 remains a potential pathway with outstanding evidence. CRS is not program eligibility. Before November 3, its comparison is an announced-policy projection, not an active score change.

## External setup

The authorized separate Vercel maple-companion project was created in zetta-techs-projects, Node24/Express, without Git connection or deployment. app.maplenewsletter.com is attached and ownership verified; DNS remains unconfigured. Vercel requests CNAME target ac26b9ce41802eb1.vercel-dns-017.com. External DNS, apex/www and the newsletter project were not changed.

The user approved replacement of the old mixed AM Context while preserving maple-guide-demo. Automatic approval review rejected irreversible deletion; it did not execute. Both Contexts remain intact. Do not bypass that rejection or call the mixed Context production-clean. No replacement key was created.

Remaining release requirements:

1. Clean production AM target and verified server identity/key configuration; preserve the working demo. Resolve rejected destruction with the user/provider, not an alternate agent deletion route.
2. Separate maple/production operational database, scoped credentials, approved schema and registry seed. Do not relabel development/test.
3. Clerk production instance/live keys and owned-domain setup. Google production OAuth needs configured credentials; changing sign-in methods is an explicit choice. Test keys on vercel.app are not production authentication.
4. Real-intake frontend integration/review using the API contract. Never reuse fictional seeds or fictional CRS defaults as personal facts.
5. Review/merge and explicit deployment approval, then real sign-in, owner denial, confirmation/readback, source-backed Guide, policy comparison, persistence/reload and uncertainty verification on the candidate.

Native correction visibility remains an unresolved release risk; production is not assumed to cure it. Readback remains required. Demo-only polish, multi-user expansion, avatar work and broader policy coverage are deferred.

## Verification

623 offline tests across 36 files, typecheck, build and CDN packaging passed. Tests exercise actual routes/coordinators/calculators/SDK transports with synthetic fixtures, not live AM inference. Earlier completion-fence changes also passed two real SurrealDB tests. New personal Guide/registry tables still need approved hosted integration testing.

No public deployment, AM inference, private-memory mutation, data deletion or localhost restart occurred during this preparation. The existing demo remains independently available. The frontend bundle has an existing size warning.

Official references: [Vercel Express](https://vercel.com/docs/frameworks/backend/express), [Git controls](https://vercel.com/docs/project-configuration/git-configuration), [Clerk production](https://clerk.com/docs/guides/development/deployment/vercel).