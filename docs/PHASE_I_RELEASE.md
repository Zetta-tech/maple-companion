# Single-owner pilot release checkpoint

This is preparation, not a deployment or a production-readiness claim. The verified
localhost demonstration remains on frozen build `3a412d4` for recording. PR8 was
merged at `277688c`; subsequent correctness changes are on `feat/pilot-readiness`.

## Required path

1. Finish the ordinary native-memory/assessment ordering fix and review its new PR.
   A native completion records the employment revision (including a confirmation
   already in flight) under the same database commit guard. Only a later confirmed
   revision qualifies as fresh input review. Assessment reads use a final atomic
   head/receipt/active snapshot; the browser hides results during unresolved sends.
   Legacy native receipts without an ordering boundary remain blocked for explicit
   reconciliation; no timestamp or migration is invented for them.
2. Package the existing Express/Vite app for the authorized Vercel team in a new
   `maple-companion` project. Do not repurpose `maple-newsletter`. No project or
   domain has been created/verified by this implementation task. Use a fixed HTTPS
   origin, one server-authorized owner, and a Node 24 entrypoint. Static assets must
   be packaged for Vercel rather than relying on Express static middleware there.
3. Enable a deliberately restricted hosted single-owner mode. Current native/Guide
   code is localhost/development-only and the Guide profile is explicitly fictional.
   Reuse the existing Guide calculations, source retrieval and persistence engine;
   do not relabel the fictional seed as real biography. Real intake must start empty
   and require explicit reviewed inputs. C20 remains the only discovery coverage.
4. Select a clean real-memory Context, preserving both mixed development memory and
   the working demonstration unless the user approves an exact alternative. The two
   current Context slots are occupied. No reset, deletion, purchase or new key is
   authorized by this document. Full-access server keys are not limited grants.
5. Configure the separate `maple/production` operational database and scoped runtime
   credentials, reviewed policy bundle, AM binding and Clerk settings. Current
   development/test databases cannot be silently relabelled. Required provider
   diagnostics must be retained durably in the existing operational database, not
   the serverless filesystem. Any additive schema needs its specific approval.
6. Validate the deployed candidate before promotion: real sign-in/owner denial,
   profile confirmation/readback, source-backed Guide, dated assessment/notification,
   reload/idempotency, uncertain outcomes and no cross-environment fallback. Native
   correction visibility remains an unresolved provider/integration release risk.

## Decisions/approvals still needed

- Exact Vercel project/team/environment and fixed HTTPS domain, followed by explicit
  deployment/promotion approval. Signing into Vercel is not deployment authorization.
  Parent verified the existing `zetta-techs-projects` team and `maplenewsletter.com`.
  `app.maplenewsletter.com` is a candidate separate subdomain with no returned
  assignment/conflict; it is not reserved or configured. External DNS control and
  the exact DNS/Clerk changes still require confirmation. Preserve the newsletter
  apex/www and its existing project.
- Clean AM target and preservation choice; any required new credential or destructive
  action must be approved separately and never supplied through chat.
- Production database/schema and scoped credential setup. No production DB was
  created by the current source changes.
- Clerk production instance and domain configuration for a real release. A hosted
  test-key pilot, if specifically selected, must stay one-owner, labelled a pilot,
  and cannot be represented as production authentication readiness.
- Review/merge of the new source changes. PR8's merge does not merge later fixes.

Multi-user support, extra pathways, cosmetic refinement, stress tests and the
isolated demonstration's rate-limit recovery issue are deferred. No new provider
experiments or recording reruns are required for this correctness change.

## Correctness verification

602 offline tests across 32 files, TypeScript and build passed. Two targeted tests
passed on real SurrealDB `maple/test`, using synthetic operational metadata only:
completion ordering, persisted/reloaded receipts, later same-timestamp review,
active confirmation reservation and owner-private atomic assessment snapshots.
No AM calls, schema changes, deletions or localhost restart were performed. These
tests prove database ordering, not native-model reliability or hosted readiness.

## Hosting preparation (not activated)

The new root `app.ts` is a recognized Vercel Express entrypoint. `server/runtime.ts`
constructs the same backend without a listener or background timer. Local
`server/index.ts` still owns its loopback listener and retention sweep. Hosted
requests retain the existing request-time expiry check. `build:vercel` copies only
compiled frontend assets into generated `public/`; `.local`, environment files and
runtime evidence are excluded from deployment input. Automatic Git deployments
are disabled in `vercel.json` pending a specific release approval.

`single-owner-production` is prepared but not enabled: HTTPS, NODE_ENV=production,
Clerk live keys, exactly one bound owner/principal and separate key references are
required. Distinct keys are not proof of restricted grants; live permissions still
need verification. A nonsecret `MAPLE_AM_BINDINGS_JSON` can replace the local binding
file, never coexist with it. Native status reports `syntheticOnly: false` in that
mode and accepts only an explicit `syntheticTest: false` input contract. The UI must
follow that capability; the existing localhost mode and test contract are unchanged.

Hosted native processing requires the prepared additive
`database/provider-evidence-v1.surql` table/marker. It stores only owner, operation,
purpose, response digest and timestamp, not raw personal messages or provider
payloads. There is no filesystem fallback or automatic schema application. The
schema is **not applied**. This metadata supports processing integrity but cannot
recover a missing provider response or prove that a fact is visible in AM.

The real-profile Guide transition is still outstanding and the hosted runtime
deliberately does not expose the fictional Guide as a personal product. Do not
deploy this intermediate adapter as if the full release were finished.

Official setup references: [Vercel Express entrypoint and static assets](https://vercel.com/docs/frameworks/backend/express),
[disable automatic Git deployments](https://vercel.com/docs/project-configuration/git-configuration),
and [Clerk production deployment on Vercel](https://clerk.com/docs/guides/development/deployment/vercel).
Clerk production requires an owned domain; an ordinary `*.vercel.app` address with
development keys is not production authentication setup.

Hosting-preparation validation: 611 offline tests across 34 files, typecheck, build
and local CDN asset packaging pass. Importing the hosted entrypoint makes no
provider request and starts no listener/timer; missing configuration returns 503.
The production mode rejects test keys, loopback origins, multiple owners, missing
principal bindings and the reused full-key development exception. No hosted test of
this new mode or evidence schema has run. The 523 kB frontend bundle still emits a
size warning; cosmetic/bundle optimization is not part of this correctness change.
