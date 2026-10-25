# Demo acceptance and boundary review — 2026-10-25

## What actually produces each result

| Stage | Implementation | Evidence / limitation |
| --- | --- | --- |
| Starting profile | Editable, explicitly fictional seed | A deterministic starting profile, not a generated finding. It uses a fictional employer; no Oracle reciprocity claim. |
| Approved profile | Exact proposal and explicit confirmation; dedicated `demo_profile` entity in hosted AM | Actual SDK adapter and receipt checks are implemented. New demo hosted writes have not run. The operational store keeps a receipt pointer, not a canonical profile copy. |
| Source retrieval | `GuideSources.retrieve` fetches the two appropriate official IRCC pages for each request | Four official public texts were fetched and reviewed for the initial bundle. Per-request retrieval is covered by test transport; the live discovery has not run. A changed hash or failed fetch holds the request. |
| C20 condition checks | `discoverC20` computes a potential lead and missing evidence from the saved profile | It is a deterministic, reviewed criterion calculation. Employer name and wording do not trigger a positive result. This increment is explicitly C20-focused, not an autonomous search of every immigration pathway. |
| Natural explanation | Installed native AM `/chat`, with separate unchanged question, saved fictional profile, computed conditions and official source bodies | No second model/interpreter or canned runtime answer. The reply must be received before the event is completed, and its actual text/session/trace are saved in the journey. **Hosted generation quality and persistence remain unverified.** |
| Journey | Owner-bound event claim/result, including the actual reply and source/version evidence | The UI reloads saved records; profile/date changes move old results into a historical disclosure. Offline tests prove the coordinator/UI contract only; hosted SurrealDB tests await schema approval. |
| Express Entry replay | Developer action selects reviewed real source versions, retrieves current source text, calculates with the same saved profile/date | Independent of a trigger phrase. It computes the supported Canadian-work component only. No full CRS baseline, full Labour Market Integration offer comparison, or guaranteed total +40. The November 3 change remains future policy on October 25. |

The native explanation is not allowed to promote policy, approve profile facts, or
replace the deterministic result. The UI distinguishes the condition checks from
the generated explanation. A live mismatch between those surfaces needs review;
offline test prose is never evidence of AM understanding.

## Offline browser evidence

Codex IAB exercised the **actual component and DemoJourney coordinator** on the
separate loopback fixture at `http://127.0.0.1:5196/`. A prominent permanent banner
identifies its memory, store, generated reply and source transport as substitutes.
No Clerk session, existing localhost data, AM service or hosted database was used.

Observed through UI actions and fresh DOM/screenshot inspection:

1. Review → exact confirmation → fixture save → C20 lead.
2. Reload preserved the fixture profile and journey item.
3. Changed the employer to another fictional name and set reciprocity to **No**.
   Confirmed the variant; the new finding was `not_supported`. The previous positive
   lead remained available only as a historical item after the revision changed.
4. Policy replay produced the supported 46 → 86 **component** comparison, with the
   future effective date and unknown total CRS visibly stated.
5. Repeating replay did not add another card. A fresh load showed exactly three
   cards: one current component result, one current no-reciprocity result and one
   historical lead. The composer remained enabled after loading settled.
6. Light and dark rendered views were inspected. Actual screenshot pixels were
   available this time. The initial long editable fixture form remains a demo intake;
   after save it collapses so the question and journey are the primary surface.

Private local request/response trace and final fixture state:
`.local/demo-ui-fixture/ui-requests.jsonl` and `ui-state.json` in the active worktree.
These are **offline artifacts**, not hosted persistence traces. They are ignored by
Git and are not part of the PR. The fixture's in-process store surviving browser
reload does not prove survival of a database/server restart.

## Focused code review and corrections

- Fixed an AM-readback error hiding pending proposal metadata: independent request
  outcomes now keep the uncertain operation visible even when profile read fails.
- Source failures before event claim/provider use release the local UI wait state;
  network/uncertain outcomes retain the no-resubmit hold. No automatic retries.
- Reused the business-day/resume watcher so dated journey results become historical
  when the date changes without needing a profile edit.
- Source capture now writes an **unreviewed candidate**. Retrieval does not set
  `reviewedAt` or promote a source into the configured reviewed bundle.
- Actual Clerk HTTP tests cover unmapped/foreign owners, client owner injection,
  confirmation-only writes and production-style disablement. Fixture adapters are
  explicit test dependencies; runtime composition uses the real SDK/store adapters.

This was a focused implementation review, not a separate human security review.

## Exact approval and remaining setup

The denied operation was the command to run `scripts/apply-demo-schema.ts test`
against existing `maple/test`. The reviewer rejected it **before execution** because
hosted migrations require separate explicit approval. It was not retried.

The proposed transaction adds three new SCHEMAFULL tables (`maple_demo_heads`,
`maple_demo_proposals`, `maple_demo_events`), their fields/unique indexes and the
`maple_schema:demo_journey_v1` marker. New tables use `PERMISSIONS NONE`. It changes
no existing table definition, user, key, principal or grant; no records are deleted.
Existing database-scoped EDITOR credentials have database-system authority, so
server owner checks remain required. This is a **schema expansion**, not an access
grant expansion. Test fixture records would be retained.

Required approval bundle: apply that exact additive schema to `maple/test`, run the
isolated real-engine tests, then apply the same schema to `maple/development` after
they pass, configure the already-reviewed guide-source path for the local process
and restart the owned local preview. No new credentials or services are proposed.

Separately, native `/chat` is documented to persist memory updates. Its installed
options expose scopes and labels but no no-persistence switch. A fictional label
and a separate `demo_profile` entity protect the direct form target, but do **not**
prove that chat extraction/reconciliation cannot affect other memory in the same
Context. No live guide call has been made. Before such a call, resolve whether the
existing fictional Context may be affected, or use an independently provisioned
test Context with the necessary explicit setup approval. This is not assumed solved
by a scope name, prompt disclaimer, or the unchanged receipt-backed employment head.

## Existing-schema assessment (no implementation or mutation)

The existing employment head/operations are parsed as employment changes and use
that record's revisions. The native-request tables are parsed as native-message
results. Assessment tables refer to the ordinary profile revision and reviewed
policy registry. Putting demo records into those schemas would require changing
their invariants and reader filtering, and risks polluting the original scenario.
They are not a safe drop-in migration-free adapter. No alternate-table workaround
was attempted after the denial. The isolated offline fixture is verification only.
