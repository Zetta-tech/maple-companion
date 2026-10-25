# Maple demo handoff — October 25, 2026

## Current result

Local URL: **http://localhost:3000**. Use the existing authorized Clerk account.
Draft PR: https://github.com/Zetta-tech/maple-companion/pull/8. Nothing has been
merged or deployed by this task.

| Experience | Verified now | Remaining acceptance |
| --- | --- | --- |
| C20 discovery | Real fictional profile confirmed and receipt-read from the dedicated AM Context; two live official sources; one native `/chat` response; private journey result reloaded | Actual signed-in browser interaction; Codex IAB currently shows Clerk sign-in |
| Express Entry replay | Real five-source retrieval; complete fictional 528 → 568 calculation; same profile/date; future November 3 label; persistent event and duplicate replay reuse | Actual signed-in browser presentation/replay |
| Ordinary memory | Current attributes unchanged against the preflight snapshot; all synthetic writes went to the separate demo Context | Existing mixed Context remains a production candidate, not clean or production-ready |

These are live backend results, not substitutes for the authenticated UI test.
The earlier offline browser tests exercised the actual component/coordinator with
explicit test adapters. They do not establish Clerk or hosted-service acceptance.

## What ran live

On October 25 around 11:58 UTC, the authorized fictional Avery profile was proposed
and explicitly confirmed through the same `DemoJourney` coordinator used by HTTP.
Its complete CRS evidence was explicitly marked reviewed for October 25. The exact
profile is held only in ignored private evidence and AM; the operational database
keeps its receipt pointer. AM readback verified revision 1 and the envelope digest.

C20 retrieval checked both reviewed official source body hashes. One native AM
chat request generated a reciprocal-employment lead, HR evidence requests, unknowns
and a separate-spouse-assessment caveat. The response was originally withheld for
a Markdown JSON fence. Local validation also mistook “cannot be guaranteed” for a
guarantee. Both defects have targeted regressions. The existing recorded response
was revalidated and its derived journey display conditionally repaired; no second
model call, fact rewrite, or deletion was used. Before/after records are retained.

A native session read returned the persisted user and assistant turns without
pagination. This separately verifies conversational persistence; merely reloading
the app-owned journey would not prove AM retained the exchange. Provider token
usage/cost was not returned, so no cost estimate is claimed.

The EE replay retrieved five actual official sources and calculated **528 → 568
(+40)** for this fully specified fictional profile. It is an announced-policy
projection effective **November 3, 2026**, not an active increase on October 25.
Both versions use identical facts and assessment date. A second replay returned
the original event, and a fresh database connection reloaded the profile receipt
and both journey events. The +40 is calculated, not a universal or hardcoded delta.

## User reproduction

1. Sign in at localhost in Codex IAB with the existing account. No artificial Clerk
   session or copied Chrome cookies are used. The real sign-in tab is kept open.
2. Find **Maple Guide — Fictional demonstration**. The saved Avery profile should
   show verified demo revision 1. **Review or edit demonstration profile** exposes
   its explicit invented facts and complete CRS assumptions.
3. Inspect the saved C20 discovery: why it is a potential lead, outstanding evidence,
   next steps and official sources. Open **Saved generated explanation** for the
   actual native response, clearly distinguished from reviewed condition checks.
4. Inspect the saved policy update and the full points breakdown. Its future date,
   replay provenance and fictional assumptions must remain visible.
5. Use **Refresh journey**, then reload. Both saved items should remain. Under
   **Demo controls: official policy replay**, repeat the update; the same result
   should be reused rather than creating another event or model request.
6. Additional profile edits require exact review/confirmation. Do not regenerate
   the C20 answer just to prove reload. The existing normal employment record is
   separate and must not be edited as part of this demo.

## Architecture and safety boundaries

The Guide uses its own Context/key binding for the same single authorized Clerk
owner. It cannot fall back to ordinary memory. Missing configuration disables it;
matching ordinary Context/key or a different owner is rejected. Full-access keys
remain a server-only development exception, not restricted reader/writer grants.

Confirmed fictional facts live in AM as an explicit `demo_profile` triple. The
Surreal operational store holds pending proposals, receipt/revision metadata and
derived journey results, not a second canonical profile. Native `/chat` persists
conversation/extraction in the isolated Context. No additional interpreter or
reflection fallback is active. Historical legacy proposal parsers remain only
where existing records still need them.

C20 is the supported discovery coverage, not an exhaustive immigration search.
Employer brand or permit expiry alone never establishes the pathway. The August 13
update removed the prior-employed-abroad requirement; reciprocity evidence remains
necessary. A reported program is only a lead. No work authorization, spouse permit,
eligibility or approval is promised. Native text receives format/source/status and
known-dangerous-claim checks; those checks are not semantic or legal certification.

CRS scope and unresolved future cap edge cases are documented in
[CRS_COMPLETION_SCOPE.md](CRS_COMPLETION_SCOPE.md). Missing or conflicting evidence
holds exact totals. Official source updates require reviewed hash promotion.

## Validation and private evidence

- **774 local tests / 38 files**, typecheck and production build pass after the live
  formatting/disclaimer fixes. Bundle 521.32 kB / 149.86 kB gzip; size warning remains.
- Two earlier real Surreal integration tests passed against `maple/test`; AM was
  explicitly substituted in those tests. Ten synthetic records are retained there.
- The live run used the real scoped development DB credentials and real demo AM key.
  It did not bypass HTTP authentication or claim authenticated UI execution.
- Additive demo schema/marker is present in test and development. No existing records,
  users, grants or credentials were changed by schema application.
- Secrets, raw messages/session identifiers and provider payloads remain ignored.

Private evidence in the active worktree:
`.local/demo-live-20261025/preflight.json`, `activation.json`, `live-backend.json`,
`recorded-reply-review.json`, `recorded-reply-review-v2.json` and `guide-raw/`.
The original checkout's `.local/preview-isolated-guide.process.json` records the
owned local process. Do not commit these runtime artifacts.

Existing-memory cleanup inventory is at
`.local/production-memory-inventory/REPORT.md` with a private exact-ID manifest.
No forget, purge or session deletion has run. Mixed user-entered details must be
preserved until a precise cleanup action is approved; labels are not isolation.
