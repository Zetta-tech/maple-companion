# Maple evaluation notes

**Built solo by Aakash Umamaheswaran.**

This technical evaluation accompanies the project write-up. It separates implemented behavior, repository test evidence and what the recording demonstrates; it does not provide an unrestricted production account.

## Evaluation materials

- [Demo video](https://www.loom.com/share/402cbd06ef4c41e9b32e632c705745a6)
- [Live application](https://app.maplenewsletter.com)
- [Repository](https://github.com/Zetta-tech/maple-companion)
- [Pinned reviewed main commit](https://github.com/Zetta-tech/maple-companion/tree/4ee725d548bf6d23775656499f4f0631384b7468)

The hosted application is deliberately owner-gated for an own-data-only trial. That limits whose personal data is processed, not processing by Clerk, Vercel, SurrealDB and Agent Memory within their respective roles. No unrestricted judge account is supplied.

**Repository access:** If a repository link returns 404, request repository access from the project owner. The demo video and live application are linked separately above.

**Reviewed application commit and checks:** `4ee725d548bf6d23775656499f4f0631384b7468`. PR20 merged at 02:52 UTC and PR21 at 02:54 UTC on October 26. [CI for this exact main commit](https://github.com/Zetta-tech/maple-companion/actions/runs/40261390267) succeeded at 02:55 UTC.

## What the recording demonstrates

The demonstration is informed by the builder's real immigration experience and supplied personal facts. Its discovery cards replay saved results originally calculated from prepared inputs by Maple's real deterministic engines:

- `discoverC20()` returned `potential_pathway` for the prepared reciprocal-employment scenario.
- `projectExpressEntry()` called `calculateCrs()` and produced the 528-to-568 comparison.
- A separate pure rerun reproduced both outputs. The expected numbers were asserted, not manually assigned as the calculation result.

The calculation used a stored, reviewed IRCC source snapshot and implemented rules. It assessed an October 25 scenario and projected a November 3 effective change. The +40 comparison is prospective; this code verification does not independently establish every real-world input, legal eligibility or additional points already awarded.

The editable personal profile is separate from those saved recording results. Editing that profile does not recalculate the recorded discovery cards. The recording also does not demonstrate a live language-model/provider call, background policy detection or live freshness invalidation of every visible card.

The per-skill language values displayed in the editable profile are a staged allocation from supplied demonstration values. They have not been verified against an actual language-test report, and they are separate from the prepared inputs used for the saved CRS calculation. This limitation concerns that allocation and calculation linkage; it does not imply that the builder's immigration experience or all supplied facts are fictional.

## What the backend tests establish

The following links are pinned to commit `4ee725d548bf6d23775656499f4f0631384b7468`, rather than the moving main branch.

### Reviewed input revisions

[tests/assessments.test.ts at line 206](https://github.com/Zetta-tech/maple-companion/blob/4ee725d548bf6d23775656499f4f0631384b7468/tests/assessments.test.ts#L206) covers a new committed input revision hiding old conclusions. The returned state is stale with an empty results list. A new explicit `assessments.run` operation generates a fresh result.

### Approved policy versions

[tests/assessments.test.ts at line 220](https://github.com/Zetta-tech/maple-companion/blob/4ee725d548bf6d23775656499f4f0631384b7468/tests/assessments.test.ts#L220) covers historical conclusions becoming stale when a policy is removed, becomes unapproved, or its version or criteria change.

### Employment review boundary

[tests/personal-guide.test.ts at line 161](https://github.com/Zetta-tech/maple-companion/blob/4ee725d548bf6d23775656499f4f0631384b7468/tests/personal-guide.test.ts#L161) covers an employment change setting `reviewRequired`. Stale confirmation and discovery are refused before an Agent Memory write. Saving the updated, reviewed inputs clears the hold.

### Official source changes

[tests/guide-sources.test.ts at line 17](https://github.com/Zetta-tech/maple-companion/blob/4ee725d548bf6d23775656499f4f0631384b7468/tests/guide-sources.test.ts#L17) rejects changed fetched official-source content with `OFFICIAL_SOURCE_CHANGED`. [tests/policy-store.test.ts at line 32](https://github.com/Zetta-tech/maple-companion/blob/4ee725d548bf6d23775656499f4f0631384b7468/tests/policy-store.test.ts#L32) covers the same refusal through the production registry adapter.

These are request-time checks against reviewed revisions, approved policy versions and fetched source content. They do not establish a background monitor, immediate invalidation of every dashboard card or automatic recalculation. Changed-source checks occur when discovery or replay is invoked; recalculation is an explicit operation. The saved recording cards are not evidence that these production checks ran during the video.

## Test commands

From the repository with dependencies installed:

```sh
npm test
npm run check
```

`npm test` runs Vitest. `npm run check` performs type checking, tests and the build. These commands provide inspectable test evidence; they do not by themselves validate broad hosted multi-user isolation or all provider behavior.

## Guide model and data flow

Guide explanations call SurrealDB Agent Memory's hosted `/chat` endpoint through `@surrealdb/memory` version `1.0.0-alpha.11`. The application sends the question, reviewed profile, condition checks, official-source text and a response contract. The underlying model is managed behind Agent Memory; the app does not select a named GPT or Claude model.

Native conversational memory uses full inference. Confirmed structured forms use triple extraction. Generated explanations interpret the supplied evidence; deterministic TypeScript rules remain responsible for numerical results.

Clerk handles email-based identity and sessions. The Vercel-hosted backend processes authenticated messages and profile inputs. Agent Memory receives personal messages, work/status details, reviewed education and language information, source evidence and generated conversations. SurrealDB separately holds owner-linked proposals, revisions, receipts, assessments and saved explanations.

Provider training policies and downstream subprocessors remain unverified. A native-memory correction/current-readback edge case remains unresolved, and self-service export/deletion and retention controls are not established as complete. Owner gating does not remove these considerations for the owner's own data.

## Build Week and prior-work provenance

[Build Week ran October 16–25, 2026](https://luma.com/build-north). The [Devpost schedule](https://build-north.devpost.com/details/dates) is the official submission schedule. The dates below record commits, not claims that every line was first conceived at that moment.

### Earlier Build Week prototype

The backup repository began with a README at commit `46304bdf` on October 23, 2026, at 04:03 UTC. The prototype's first substantive implementation was committed on October 23, during Build Week: commit `8691c2cf` at 04:34 UTC. These timestamps do not establish when every individual line was first authored. Existing Maple Newsletter work predates these repositories and informed discovery and source-provenance design; its automatic collector-to-Companion connection remains planned.

### Current Companion foundation

The current repository's [first commit](https://github.com/Zetta-tech/maple-companion/commit/a3b301728aa96dd9080fae3fd083f3ddd42db7f4), at October 24, 2026, 18:19 UTC, contained a two-line README, not a bulk code import. The [first backend implementation](https://github.com/Zetta-tech/maple-companion/commit/047e7e50e358f9927f8414c4752a72e5db2e2dc8), at 19:06 UTC, introduced 42 files.

A comparison of all 42 initial backend file blobs against backup commit `eefd1c7` found no identical whole-file blobs. This is not a claim of 100 percent original code: the comparison also identified concrete adaptations and retained patterns.

- Authentication adapted the backup's Clerk session-verification and authorized-origin pattern.
- Agent Memory retained SDK endpoint guards and idempotency principles, with different employment-record triples, receipts, digests, supersession and reconciliation workflows.
- SQLite setup boilerplate was retained, while the Companion journal workflow differs from the backup's canonical workspace store.
- Assessment and policy logic were introduced as distinct modules rather than wholesale copies of backup modules.

Subsequent commits added [SurrealDB operational storage](https://github.com/Zetta-tech/maple-companion/commit/d22bc48) on October 25 at 05:16 UTC, [full CRS calculations](https://github.com/Zetta-tech/maple-companion/commit/4c50551) at 06:00 UTC, and the [shared policy registry](https://github.com/Zetta-tech/maple-companion/commit/57e9460) at 14:02 UTC.

### Direct visual reuse

A [direct avatar port](https://github.com/Zetta-tech/maple-companion/commit/ac6245062ef9a42fef7d9429d8f42f7f0756bd82) occurred on October 25 at 20:31 UTC. `MapleCompanion.tsx` was adapted, `companionMotion.ts` matched the earlier controller after normalization, and the SVG, styling and tests were adapted from the backup implementation. Existing Maple branding was also reused.

This distinguishes direct reuse, adapted patterns and subsequent Companion work without claiming blanket originality.
