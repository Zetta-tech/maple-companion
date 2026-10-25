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
