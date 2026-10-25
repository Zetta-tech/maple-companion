# Personal Guide integration contract

Backend preparation, not activated or live verified. Existing `/api/demo/*` and its separate fictional Context stay unchanged. No frontend files were changed by this work.

Production mode is `single-owner-production`. Every route uses the existing Clerk owner, configured single-owner binding, origin check and request controls. Clients cannot supply owner, Context, principal or scope.

## Intake and canonical employment

`GET /api/guide/status` returns `available`, `fictionalOnly:false`, supported `coverage:['c20','express_entry_crs']` and `sourceMode:'approved_registry_with_live_change_check'`. This is curated coverage, not an exhaustive immigration search.

`GET /api/guide/profile` returns `PersonalGuideSnapshot` from `shared/personal-guide.ts`: `revision`, verified saved `profile`, editable supplemental `intake`, `employmentRevision`, and `reviewRequired`.

New intake has null names/dates and explicit unknown answers. It never imports the fictional seed. The employment form remains the only editable employment source. Guide intake contains name, arrival/permit dates, current status, offer/reciprocity evidence, spouse information and optional full CRS evidence. It does **not** accept employer, title, hours, NOC, work dates or owner identifiers. Those are read from the existing verified employment receipt.

For optional real CRS intake use `emptyCrsEvidence(asOf, confirmedEmploymentEndDate)` from `shared/crs.ts`, never `fictionalCrsEvidence`. The calculator version is now `2026-11-03.reviewed-evidence.v3`; older stored comparisons remain historical, not silently current.

`POST /api/guide/proposals` accepts exactly:

```json
{"baseRevision":0,"employmentRevision":1,"intake":{"fictional":false,"...":"the PersonalIntake fields"}}
```

The returned proposal includes the exact assembled assessment inputs for review, with employment revision and receipt digest. `POST /api/guide/proposals/:id/confirm` accepts `{"confirm":true}`. Rejection uses the same route suffix `/reject` with `{}`. Pending proposals are listed at `GET /api/guide/proposals`.

Employment snapshots also carry `workEnd` and `currentJob` from the canonical receipt. Ended jobs stop accruing experience at that end date. Legacy snapshots missing either boundary remain readable with unchanged receipt hashes, but cannot produce a score until reviewed again.

For a save error, refresh the proposal list. `GUIDE_WRITE_NOT_STARTED` means the transport proved no facts POST was dispatched and the same reviewed proposal was restored to `pending`; let the user explicitly confirm it again or reject it. Do not retry automatically. An `applying` or `uncertain` operation instead offers **Check save status**, calling `POST /api/guide/proposals/:id/reconcile` with `{}`. That endpoint only reads AM for the exact owner/purpose/operation/revision/content/previous-fact chain and finalizes the existing journal receipt when verified. It never resends a facts POST. No match or unavailable readback retains the hold. Reconfirming an unresolved operation also takes this read-only verification path. A recovered snapshot may still require review if employment or conversation changed meanwhile.

Confirmed inputs are stored in AM under the explicit `maple-personal-assessment` purpose and `assessment_inputs` attribute. They are dated review snapshots linked to canonical employment, not a competing editable employment profile. A changed employment receipt or unresolved native-memory update sets `reviewRequired` and blocks new conclusions until the inputs are reviewed again. Missing interval evidence yields needs-information, not a score.

## Research and updates

`POST /api/guide/discover`: `{requestId: UUID, question: string (1–2000 trimmed characters), fictional:false}`. Native hosted AM chat uses the supplied reviewed personal inputs and retrieved official sources. The reply is checked against the existing output contract. It can be withheld without replacing it with canned research.

`POST /api/guide/policy-replay`: `{requestId: UUID, fictional:false}`. This explicitly replays the real reviewed announcement. It is not a background-monitor notification or an active November rule before its effective date.

`GET /api/guide/journey` returns `revision`, `reviewRequired`, and persisted events. Preserve historical explanations for inspection, but suppress current conclusions when review is required, date/version changes, or profile revision differs. Reloading a journey proves app event persistence, not independent native conversational recall.

On research errors, release a pending request ID only when `error.guideRequestState === 'not_started'`. The server supplies this only before the durable claim boundary, including body and rate-limit rejections. Do not infer safety from HTTP status or an error code after dispatch. Unknown outcomes remain on hold; do not resend automatically.

## Required activation (not executed)

Prepare additive `personal-guide-v1.surql`, `policy-registry-v1.surql` and `provider-evidence-v1.surql` in the approved production database. Seed the exact approved official-information release, then set `MAPLE_POLICY_RELEASE_DIGEST` to its digest. Runtime reads the shared Surreal registry and independently checks official page hashes before research. No startup schema/seed/promotion is performed. The deployment must use the clean production Context and real Clerk production owner mapping.
