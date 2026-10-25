# Native memory integration — local, development gated

The path sends unchanged conversational turns to Agent Memory and reads its native state/profile. It does not interpret employment labels with Maple's six-key mapper. The routes and UI are active on the local preview after the approved setup on 2026-10-25; missing-attribute readback remains unresolved. This increment uses remember/profile, not hosted AM /chat conversational replies. It adds no caller-owned conversational model.

## First increment

`server/native-memory.ts` accepts only a server-owned mapping from authenticated Clerk owner to Context, endpoint, expected AM principal and registered scope. Before reads or writes it checks the key's resolved identity using `GET /me`. Optional delegation is supported only for an explicitly configured, already provisioned principal; no principals, keys or grants are created. Session ownership must be retrieved from a server-side registry, not accepted from a browser or model.

Raw turns use `infer: full`, without sentence rewriting, an extra interpreter, or label filtering. Native attributes, uncertainties and corrections remain intact. Ingestion and state/profile readback are reported separately: a returned extraction ID that is missing from state remains unverified. No automatic write retries. Stable request keys supplement, but do not replace, durable application operation claims; provider receipts expire.

Phase I is explicitly limited to one authorized user. Clerk authentication, the single-owner binding restriction, server-selected Context/principal mapping, session ownership checks and server-only credentials remain enforced. No additional user is provisioned by signing in. The current development Context uses its existing verified token principal and full-access key; scopes do not restrict that key.

Multiple fictional names under that token are not independent users. Scaling and multi-user validation are deferred to Phase II, not marked complete. The previously agreed separate Context per owner remains the proposed isolation design; choosing shared-Context delegation instead would be a separate design and access decision. No Phase II provisioning or access expansion is part of the current implementation.

## Canonical-data transition boundary

The existing receipt-backed employment envelope remains the running app's reviewed assessment evidence. The new UI labels the form Reviewed assessment inputs and displays only native selfFacts in the remembered-information panel; other-entity legacy envelopes are not silently displayed as another personal profile. Native messages do not dual-write that envelope. Later native messages withhold current assessment conclusions until the inputs are explicitly reviewed again. Processing or uncertain native requests continue to hold assessments.

A direct edit of remembered information currently uses a natural-language correction through the same native path. The separate form is an explicit evidence-review workflow for deterministic requirement checks, not a live mirror of native memory. Existing receipts remain provenance for those reviewed inputs. Further cutover must preserve provenance and must not treat every raw extraction or computed profile entry as assessment approval.

## Validation status

The adapter tests run the actual installed SDK with a test transport. They verify identity binding, delegated headers, session ownership, exact raw text, no mapping, absent/truncated readback and uncertain-write behavior. HTTP/UI/coordinator tests cover authenticated routing, production disablement, escaped rendering, duplicate requests and truthful status. They do not test AI understanding, live delegation permissions, or resolve the hosted missing-attribute discrepancy.

The existing SDK/key was separately checked using one read-only `GET /me`: it resolves to the same principal seen in native extraction and has full effective Context grants. The private investigation artifacts remain ignored and are not included here.

Live synthetic evidence: a fresh-session native fact was visible in state/profile and a second session's context. One subsequent explicit correction returned a correction diff, but both old and new values were absent from current reads. Correct full-ingestion session routing was separately verified. The discrepancy is an unresolved release risk, not an established development-only problem. Hosted AM /chat retrieval of the correction has not been tested.

## Storage and activation status

The AM hosted backing store retains native memory and the existing reviewed evidence envelope. The separate operational database stores owner/session bindings, request digests/statuses, receipts, assessments and notifications; it does not become the canonical personal-fact store.

On 2026-10-25, the explicitly approved additive native schema was applied and verified only in maple/test. Real-engine native metadata and CEC assessment tests both passed. All synthetic records were retained. No AM requests, access changes, deletion or development schema changes occurred during this test stage.

Local validation before activation: 612 tests, typecheck, server compilation and frontend build passed. With separate explicit approval, the same three metadata tables and schema marker were added to maple/development, the conversation scope was registered, the existing principal was pinned in the ignored owner binding, and the local preview was restarted. Existing operational record counts and AM grants were verified unchanged. No new key or principal was created. The production gate remains closed; no startup auto-provisioning exists.

A subsequent user-originated job-title update returned an extracted attribute that was absent from current state and profile. Its receipt remains unverified, with the exact input and complete response retained privately. UI wording now uses plain-language status messages without changing that guard or rewriting historical receipts. Twenty-six targeted tests, typecheck and both builds passed after the copy update. This did not involve another provider inference request.

Raw synthetic diagnostic responses and inputs are written only to the ignored .local/native-chat-diagnostics directory and are not returned by HTTP. They are retained for this investigation; production retention/cleanup policy remains unresolved. No request quotas or automatic retries were added.

The subsequent local CEC activation includes the scoped remembered-details UI polish:
separate detail/message areas, clear loading and empty states, and collapsed earlier
receipts. The combined build passed 628 offline tests, typecheck and both builds.
It retains the same native readback guard and remember/profile boundary. No new
AM inference was run for this UI/policy activation; authenticated browser testing
remains user-led.

## Official references

- [Multi-tenant example: delegated identity plus scope/lens](https://github.com/surrealdb/claude-agent-memory/blob/e4bc67b561e3f876eb19fb58cad697fd7b797917/examples/multi-tenant.ts)
- [Personal assistant: native sessions, remember and profile](https://surrealdb.com/docs/agent-memory/cookbooks/build/personal-ai-assistant)
- [Interactive extraction visibility](https://surrealdb.com/docs/agent-memory/reasoning/extraction-pipeline)
- [Profile computed on demand](https://surrealdb.com/docs/agent-memory/operations/profiles)
