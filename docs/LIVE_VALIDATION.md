# First hosted validation: one private user Context

Status: prepared, not executed. The current user-reported Free allowance is one
Context. Use that Context for one Clerk development user and fictional employment
data. Additional users remain unprovisioned. Do not upgrade the plan, share a user
Context, or install broad credentials to make the test proceed.

## Prerequisites and action boundaries

- The user completes local Clerk/AM setup or explicitly approves a specific agent
  configuration action. Preserve `.env` and `.local/` concurrent edits. Never send
  secret values in chat, command arguments, screenshots or test reports.
- Locally validate required names, PEM format, the one-owner binding and distinct
  reader/writer references without displaying values. A blank optional JWT public
  key is allowed; it does not prove remote signature-key retrieval works.
- Confirm the actual Context host/ID and `maple/approved` scope. Context/principal
  setup is not performed by the data-plane SDK. Exact hosted grant enforcement is
  still unverified. A differently labelled key is not proof of a narrower grant.
- Obtain approval for the exact live target, fictional data and a bounded set of
  provider reads/writes and any usage cost before transmitting credentials. Do not
  create another Clerk account, Context, key or grant as a side effect of testing.
- Keep the local app bound to loopback with the matching `APP_ORIGIN`. Only use
  Codex's in-app browser for UI validation. Do not deploy to obtain a test URL.

User-led sign-in may happen first using the configured Clerk public interface.
The signed-in setup page displays the authenticated account ID from `/api/session`
before any AM mapping is installed. The UI does not load memory while workspace
readiness is false. This is not authorization for AM reads/writes or automatic
Context provisioning.

## First run after approval

1. Read each key's `GET /api/v1/{context}/me` and inspect effective grants privately.
   Record only pass/fail and grant names, not raw tokens or personal identifiers.
   Stop if credentials can manage grants/scopes or access root/unapproved memory.
2. Run approved negative authorization checks using synthetic probes: reader may
   read `maple/approved` but may not write; writer may write there but may not read
   or manage grants/scopes. Neither may access an unapproved scope. These probes
   may have effects if grants are wrong, so their target and disposable payload
   must be included in the live-test approval. Stop on an unexpected success.
3. Use the existing authorized test account to sign in at `/`. Verify unauthenticated
   requests fail, the accepted session belongs to the mapped owner, and responses
   remain private/no-store. Do not log session tokens or profile contents.
4. Submit one fictional ongoing employment record with a start date, hours and
   applicable details. Inspect the exact old/new proposal. Verify proposing alone
   does not write an authoritative fact; explicit confirmation commits once.
5. Check exact receipt readback from the approved scope, provenance and revision.
   Reload/restart locally and confirm the record and private saved notification
   persist. Reconfirm the same proposal and verify no second write/notification.
6. Make one explicitly confirmed correction. Verify revision/supersession and that
   a stale proposal cannot overwrite it. The ongoing job must have no artificial
   end date; elapsed duration uses the assessment date.
7. If a real write becomes uncertain, stop writes and use the read-only reconcile
   action. Report pending/uncertain honestly; never resend merely because the
   receipt is absent or the documented 24-hour receipt window has elapsed.
8. With the empty reviewed-policy registry, confirm the UI reports no available
   reviewed checks. Do not create immigration requirements to manufacture a result.
   Private assessment behavior remains covered by synthetic automated tests until
   real policies are manually reviewed and explicitly promoted.

No raw conversational extraction is enabled. Live background-derived fact,
supersession and grant behavior must be verified before expanding this boundary.
Record each stage as passed, failed or unrun; no secrets or personal fact bodies
belong in the report. Cleanup that changes hosted data needs an approved target.

## What one Context cannot prove

The existing automated tests verify two-owner application isolation using explicit
test adapters and locally signed Clerk tokens. A one-user hosted run cannot prove
cross-Context credential denial or account-switching behavior for two provisioned
users. Those stages remain blocked until another private Context is available.
Keep a second user out of the binding file; the app returns
`CONTEXT_NOT_PROVISIONED` without creating a Context or falling back to another
owner. The shared public-policy Context is also not wired or needed for this run.

Future capacity choices need separate review: a hosted tier with sufficient
Context capacity, or another AM hosting arrangement with the same verified
isolation contract. Pricing, quotas, region/data handling and operational cost
must be confirmed from current provider terms before recommending a purchase.
No capacity choice, upgrade or alternative deployment is authorized here.
