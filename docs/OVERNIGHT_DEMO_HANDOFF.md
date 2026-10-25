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
- C20: **Ready for isolated AM setup and live end-to-end validation**. Local
  profile/review, AM adapter, source retrieval, condition checks, native hosted-chat
  request, journey persistence adapter and UI are implemented, not yet live-validated.
- Express Entry: **Working offline within the supported fictional subset; live
  validation blocked**. Source ingestion, component fallback and complete fictional
  CRS before/after calculation are implemented. All full-score inputs are explicitly
  reviewed; no real-user baseline is invented. Live persistence/replay depends on
  the separate AM-context setup. Hosted operational schema is now applied.
- Existing ordinary employment revision 7 remains separate from the fictional demo
  entity. No overnight demo profile or model request has been sent yet.

The isolated Guide binding is now enforced in runtime composition: its Context
and key cannot match ordinary memory, and the Clerk owner must match the existing
authorized account. Missing demo configuration leaves Guide disabled. The native
`/chat` design is retained; the unactivated reflection experiment was removed.
The original UI's unused preview callbacks/status polling and never-assigned
server interpreter hook were removed. Historical proposal/receipt parsing and
its regression coverage remain because existing records still depend on them.

Current local verification: **763 tests across 38 files**, typecheck and build
pass. The two hosted database tests are separate from that fixture suite. No
dependency was added for the separate Context. The live guide is not activated.

## Hosted schema stage completed after specific approval

Automatic approval review denied execution of `scripts/apply-demo-schema.ts test`
before execution. It would add `maple_demo_heads`, `maple_demo_proposals`,
`maple_demo_events` and `maple_schema:demo_journey_v1` to existing `maple/test`.
The stated reason was that hosted migrations require separate explicit approval.
That first attempt did not execute. The user's later specific approval resolved
the blocker. On October 25, the exact additive operation succeeded on `maple/test`
at 11:20:56 UTC, followed by the existing real-engine workflow test. The same
schema then succeeded on `maple/development` at 11:21:49 UTC. No existing records,
users, grants or credentials changed; no deletion occurred.

Two live Surreal integration tests now pass. The second retrieves five real
official CRS sources, holds unknown Canadian-employer evidence, then persists
the fully reviewed fictional 528-to-568 projection and verifies reload and
deduplication. AM remains explicitly substituted in these two tests. A separate
read-only retrieval verified both C20 source hashes. At 11:25 UTC, test retained
two heads, four proposals and four journey events; development's three demo
tables were empty. Schema marker version is 1 in both databases.

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

The October 16 Express Entry change takes effect November 3, 2026. The legacy
component view supports reviewed NOCs 21221/21223. The optional full-score path
uses all 186 reviewed high-wage occupation codes and explicit fictional evidence
for every claimed factor. It caps weekly hours at 30, does not accelerate years
with overtime, and distinguishes occupation median wage from personal salary.
Work-duration plus bonus competes with the qualifying-offer alternative; it is
not added to it. Both totals use the same facts/date. Complex histories and
special exceptions hold for review. The unresolved future overall-cap boundary
also holds a projection above 1,200. See `CRS_COMPLETION_SCOPE.md` for exact scope,
sources and independently supplied numeric fixtures. No invitation is predicted.

## Intended reproduction after approval and verification

1. Sign in at localhost with the existing authorized account.
2. In Maple Guide, review the fictional profile, then select **Review demo profile**
   and **Confirm and save demo profile**. Verify the AM readback success.
3. Enter a natural question about work options and select **Explore work options**.
   Inspect the profile-specific C20 reasons, unresolved evidence, next steps and
   official sources. Reload and confirm the saved journey item is retained.
4. For a full fictional score, open **Optional: complete fictional CRS evidence**,
   add the invented example values, review every factor and the dated review box,
   then inspect and confirm the exact revised profile. This is optional; otherwise
   the replay remains component-only. No facts are silently attached.
5. Under **Demo controls: official policy replay**, select **Process official
   Express Entry update**. The complete default fictional profile yields 528 to
   568, with source versions, subtotals and future effective date. Repeat and reload
   to verify the same saved result. Do not treat this intended live reproduction
   as evidence it has passed against the hosted services.

These are intended reproduction steps, not a claim that the live workflow passed.

## Validation and next step

Earlier checkpoint: 656 tests in 34 files passed; the follow-up review reached
670 tests, and the full CRS increment adds numeric and workflow coverage. The final
verification count is recorded below. Restricted-shell loopback tests needed the
authorized local-socket runner; no hosted database or AM call is part of that
suite. Hygiene checks do not replace secret review. The dependency audit at the
preceding checkpoint reported no known production vulnerabilities. Vite's large
chunk warning is recorded as a remaining performance limitation.

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
it **passed against hosted maple/test** after specific approval. Its AM transport is
explicitly synthetic and does not validate model quality or hosted AM persistence.

See `DEMO_ACCEPTANCE_REVIEW.md` for the actual offline IAB trace, deterministic versus
generated boundaries, source review guard and the additional shared-Context chat
side-effect limitation. The fixture is at `http://127.0.0.1:5196/` and is visibly
labelled offline. It does not establish live AM or hosted database acceptance.

Final full-CRS checkpoint: **754 tests in 37 files**, TypeScript typecheck, server
build and Vite build passed. The JavaScript bundle is 521.70 kB (149.96 kB gzip);
Vite reports a size warning. Codex IAB verified the complete fictional score,
visible subtotals, repeat replay returning one card and a fresh-load result.
The independently reviewed Alex fixture produces 521 to 561; offer-dominance
fixtures produce deltas of 30 and 54, confirming the change is not hardcoded +40.
No new AM request, hosted write or localhost:3000 restart was made for the CRS
increment. The live guide remains disabled at the existing approval boundary.

The v2 consistency follow-up holds conflicting offer answers, dates before the
applicant's birth and missing Canadian-employer evidence. Old receipts are not
rewritten; absent evidence remains unknown. The offline browser verified the
hold, explicit correction and subsequent offer-dominant 528 to 582 result, with
the older hold preserved as historical. Exact numeric baseline fixtures remain
unchanged. See `DEMO_ACCEPTANCE_REVIEW.md` for reproduction and limitations.

Next: finish the dedicated AM Context setup in [ISOLATED_DEMO_SETUP.md](ISOLATED_DEMO_SETUP.md),
load the configured source bundle, and verify one real fictional
profile + guide request + replay through the actual UI. Preserve raw native JSON
only in ignored `.local/guide-diagnostics`. Never create an artificial live Clerk
session or call a mock result a completed demo.
