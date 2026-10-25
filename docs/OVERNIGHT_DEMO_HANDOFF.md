# Overnight demo implementation checkpoint — 2026-10-25

## Scope and directive

The full user directive was read from Library item
`libfile_7e9895b0327881918260c8cb9408edb3` (167 lines, 8,588 bytes).
Priority is an authentic C20 discovery, then an official Express Entry policy replay.
No pitch assets, extra interpreter, new service, credential change, merge or deployment.
The Library materialization helper was prepared privately, but the local Python alias
was unavailable; no claim is made that the attachment was downloaded. The complete
Library text was available and read, so implementation was not blocked on its content.

## Current experience status

- Existing local application: `http://localhost:3000`, single authorized Clerk account.
- C20: **Blocked on hosted schema approval and live end-to-end validation**. Local
  profile/review, AM adapter, source retrieval, condition checks, native hosted-chat
  request, journey persistence adapter and UI are implemented, not yet live-validated.
- Express Entry: **Partial**. Source ingestion and the Canadian-work component
  projection are implemented; no complete CRS calculator or invented baseline.
  Live persistence/replay depends on the same schema approval.
- Existing ordinary employment revision 7 remains separate from the fictional demo
  entity. No overnight demo profile or model request has been sent yet.

## Exact blocked action

Automatic approval review denied execution of `scripts/apply-demo-schema.ts test`
before execution. It would add `maple_demo_heads`, `maple_demo_proposals`,
`maple_demo_events` and `maple_schema:demo_journey_v1` to existing `maple/test`.
The stated reason was that hosted migrations require separate explicit approval.
No schema operation ran. Do not retry or redirect through another tool without
materially new authorization. The same additive schema in `maple/development`
also needs approval before local feature activation. No existing record deletion,
user/grant changes or credentials are involved.

## Implemented workflow

1. Review an explicitly fictional, editable profile. The seed uses a fictional
   employer and reports an HR mobility program with documents promised, not proven.
2. A distinct proposal and confirmation save a dedicated `demo_profile` AM entity.
   The ordinary `employment_record` entity is never targeted. AM readback must match
   the exact receipt and owner; uncertain writes are held without automatic retries.
3. Guide discovery rereads the approved demo profile, fetches current official IRCC
   sources, and holds if their reviewed content hash changed or retrieval failed.
4. Deterministic reviewed conditions explain why C20 is or is not a potential lead.
   A native AM `/chat` request supplies an additional source-grounded explanation.
   This is not another interpreter or an exact-phrase trigger. Native chat is not
   yet live-verified; do not present the test-transport response as model evidence.
5. The private journey stores result/provenance, not a second canonical profile.
   A later profile revision/date marks old findings historical.
6. Developer-triggered EE replay fetches the real announcement/tier sources and
   computes against the same saved profile/date. Duplicate same-day policy updates
   are reused. The demo profile's reviewed NOC is 21221, not a silent switch to 21223.

The demo tables hold revision/receipt pointers, pending proposed inputs and derived
journey results. Pending profile JSON is cleared on verified commit or explicit
discard. It is not a canonical profile copy. Existing full-context-key limitations
and the single-user production gate are unchanged.

## Source review

Reviewed public source text/hash snapshots: `policy-sources/guide-2026-10-25.json`.
The C20 August 13 update removed the prior-employed-abroad restriction. C20 needs a
Canadian offer and evidence of reciprocal opportunities for Canadians/PRs abroad;
brand and expiry do not establish this. A reported program is a lead, not approval.
Spouse eligibility, status, employer submission, admissibility and other conditions
remain separate checks. No fixed reciprocity percentage is invented.

The October 16 Express Entry change takes effect November 3, 2026. The current
projection only supports reviewed NOCs 21221/21223 and one consistent work interval.
It caps weekly hours at 30, does not accelerate years with overtime, and distinguishes
occupation median wage from personal salary. A +40 Canadian-work component is not
a +40 verified total CRS. A qualifying-offer alternative is not added to work points.
Full CRS inputs, complex work history and additional occupations remain outside this
increment. The interface labels the projection and replay explicitly.

## Intended reproduction after approval and verification

1. Sign in at localhost with the existing authorized account.
2. In Maple Guide, review the fictional profile, then select **Review demo profile**
   and **Confirm and save demo profile**. Verify the AM readback success.
3. Enter a natural question about work options and select **Explore work options**.
   Inspect the profile-specific C20 reasons, unresolved evidence, next steps and
   official sources. Reload and confirm the saved journey item is retained.
4. Under **Demo controls: official policy replay**, select **Process official
   Express Entry update**. Inspect future effective date, component-only comparison
   and unknown total CRS. Repeat to verify notification/result deduplication.

These are intended reproduction steps, not a claim that the live workflow passed.

## Validation and next step

Completed locally: **656 tests in 34 files**, TypeScript typecheck, server build and
Vite build passed. The initial restricted-shell run could not open loopback test
sockets; the authorized loopback rerun passed. Tracked-file hygiene passed; this
does not replace secret review. The complete staged set of 143 files subsequently
passed hygiene checks, and the production dependency audit reported no known
vulnerabilities. Vite reports a 500.87 kB JavaScript chunk warning, not a build failure.

The combined build is in `.local/overnight-guide-build/` within the active worktree.
At 05:14:57 UTC, the owned localhost process was restarted to serve the approved
warning/date cleanup. Readiness passed with the existing Surreal operational store,
Clerk configuration and native remember/profile route. **The guide source setting
is absent, so the new demo remains disabled.** This restart did not apply schema or
send an AM message. Source publication is a separate draft-review step and is not
evidence of live demo activation.

Targeted SDK-transport, condition and UI tests cover dedicated entity writes,
receipt integrity, wrong owner, native `/chat` routing, employer-name independence,
missing reciprocity, future policy dates, NOC/condition holds and hours caps.
The real-engine test in `integration/demo-journey.test.ts` covers exact approval,
foreign-owner denial, replay, concurrent proposals and history after reconstruction;
it has **not run** because its hosted schema setup was denied. Its AM transport is
explicitly synthetic and does not validate model quality or hosted AM persistence.

See `DEMO_ACCEPTANCE_REVIEW.md` for the actual offline IAB trace, deterministic versus
generated boundaries, source review guard and the additional shared-Context chat
side-effect limitation. The fixture is at `http://127.0.0.1:5196/` and is visibly
labelled offline. It does not establish live AM or hosted database acceptance.

Next: obtain the exact schema approval, apply/test on `maple/test`, then apply to
`maple/development`, load the configured source bundle, and verify one real fictional
profile + guide request + replay through the actual UI. Preserve raw native JSON
only in ignored `.local/guide-diagnostics`. Never create an artificial live Clerk
session or call a mock result a completed demo.
