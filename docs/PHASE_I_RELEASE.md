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

Approved additive schemas, applied to `maple/test` and `maple/production` on October 25, 2026:

- database/provider-evidence-v1.surql: one private metadata table.
- database/personal-guide-v1.surql: three private proposal/receipt/journey tables. Committed proposal payloads are cleared; confirmed inputs stay in AM.
- database/policy-registry-v1.surql: three shared official-information tables, no private facts.

Local candidate 2026-10-25.phase-i.v1 has digest 73407aaf2e09e085e389e4dfce92326b9a5eeb117ffb32ddff87ae90251aa54d: seven reviewed Guide sources and one previously approved CEC rule. CEC remains 2026-10-25.single-interval.v1, digest 2a4a9f8790ab98edd3a4e743d319f3f02e021510d668a4ceda4076aa530ace21. Calculator version is 2026-11-03.reviewed-evidence.v3. No rule effective date was inferred from a page modification date.

scripts/prepare-policy-release.ts prepares a local candidate. scripts/seed-policy-release.ts requires the approved exact digest and explicit test/production target. Seeding is transactional, refuses a different active release, verifies exact replay, and never changes schema or credentials. The exact candidate above was seeded and read back in both hosted databases after approval. Production contains seven official-source records, one release manifest, one active-release pointer and five schema markers. Its 15 private application tables contain zero records; no development/demo data was imported. MAPLE_POLICY_RELEASE_DIGEST must remain pinned to that approved digest.

Coverage is curated C20 and Express Entry/CRS. Broad automated policy discovery/extraction is not implemented. C20 remains a potential pathway with outstanding evidence. CRS is not program eligibility. Before November 3, its comparison is an announced-policy projection, not an active score change.

## External setup

The authorized separate Vercel maple-companion project was created in zetta-techs-projects, Node24/Express, without Git connection or deployment. app.maplenewsletter.com is attached and ownership verified; the coordinating task verified its CNAME and Vercel configuration. The CNAME target is ac26b9ce41802eb1.vercel-dns-017.com. Apex/www and the newsletter project were not changed.

The user manually deleted the old mixed AM Context after the assistant deletion was rejected. A control-plane read verified it absent and the demo Context intact. The approved clean replacement maple-companion-production was created in Oregon and is ready; no test facts have been written into it. Key minting remains blocked: automatic approval review rejected both unrestricted inheritance and a narrower maple/* request, requiring verified least privilege. Neither created a key. Do not retry or route around those denials. Production bindings remain inactive.

Remaining release requirements:

1. User-created least-privilege server credentials for the clean production AM target; preserve the working demo. Current configuration requires separate read/write keys. Scope their needed memory access to maple/approved and maple/conversation, with no management/forget/delete access, and verify effective grants. The user now owns credential creation; do not retry the rejected assistant mint operations. Bind the actual production Clerk user ID and restricted AM principal ID through MAPLE_AM_BINDINGS_JSON.
2. Production storage is provisioned: the user created maple/production and its database-level maple_prod EDITOR login. The app SDK authenticated using those credentials; all 19 tables, markers and the exact approved seed were verified. Configure the same approved server settings in Vercel; do not relabel development/test.
3. Clerk production instance/live keys and owned-domain setup. Google production OAuth needs configured credentials; changing sign-in methods is an explicit choice. Test keys on vercel.app are not production authentication.
4. Real-intake frontend integration/review using the API contract. Never reuse fictional seeds or fictional CRS defaults as personal facts.
5. Review/merge and explicit deployment approval, then real sign-in, owner denial, confirmation/readback, source-backed Guide, policy comparison, persistence/reload and uncertainty verification on the candidate.

The latest app-loader check after database verification stopped at missing Clerk live keys and the AM owner binding. The database login succeeded independently. This configuration failure occurs before AM key validation, so it does not establish whether those keys have been supplied or have correct effective permissions.

Native correction visibility remains an unresolved release risk; production is not assumed to cure it. Readback remains required. Demo-only polish, multi-user expansion, avatar work and broader policy coverage are deferred.

## Verification

631 offline tests across 36 files, typecheck and build passed. New regressions cover actual ended employment, legacy missing boundaries, pre-dispatch save release, exact-operation reconciliation after lost responses, owner denial and unknown-outcome holds without duplicate writes. Earlier completion-fence changes also passed two real SurrealDB tests.

The new production-path stores passed eight additional verification groups against hosted maple/test using the scoped test login: approved registry load/idempotent seed, wrong-pin refusal, current official C20/EE source-hash checks, metadata uniqueness without raw payload retention, proven pre-send release, uncertain-save reconciliation without replay, ended-employment hold, and reload/owner isolation/event deduplication. Four clearly synthetic operational records were retained in test; no records were deleted. AM was an explicitly substituted test transport, with zero live AM requests. A fresh production connection verified all private application tables empty after schema/seed. These storage checks do not establish live production AM or browser acceptance.

No public deployment, AM inference, private-memory mutation or localhost restart occurred during this preparation. The assistant did not execute data deletion; the old Context was removed manually by the user. Production credentials were entered by the user and consumed internally by the app loader; env contents were not dumped. The existing demo remains independently available. The frontend bundle has an existing size warning.

Official references: [Vercel Express](https://vercel.com/docs/frameworks/backend/express), [Git controls](https://vercel.com/docs/project-configuration/git-configuration), [Clerk production](https://clerk.com/docs/guides/development/deployment/vercel).
