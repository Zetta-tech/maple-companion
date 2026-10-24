# Four synthetic native-preview observations

On 2026-10-24, run `hours-modality-20261024-B` executed the four user-requested
messages below once each. Every request used the same separate background:
`the currently recorded work total is 38 hours per week`, labelled synthetic,
followed by the unchanged message. No desired interpretation was injected.

| Exact input | AM field/value | Maple native-adapter/source decision |
| --- | --- | --- |
| I now work 37 hours. | `work_hours`: `37 hours per week` | `NATIVE_CANDIDATE`; would propose 37 with inferred-unit disclosure |
| I now work 40 hours. | `work_hours`: `40 hours` | `NATIVE_VALUE_UNSUPPORTED`; weekly period not established by this output/key |
| I can now work for 37 hours | `working_hours`: `37 hours per week` | `NATIVE_CANDIDATE`; current checks would propose, exposing lost capacity modality |
| I can now work for 40 hours | `employment_record`: `available to work 40 hours per week` | `NATIVE_VALUE_UNSUPPORTED`; availability is not the supported current-work assertion |

This table records the behavior before the clarification fix. These `NATIVE_*`
reasons are **Maple adapter decisions**, not provider error codes.
All four AM calls completed successfully with one entity and attribute apiece and
empty uncertainty/correction arrays. The number pairs differed in generated units
and wording. Four single observations cannot establish that a number causes the
variation, nor retrospectively reconstruct the earlier unrecorded held responses.

The capacity-37 case is a demonstrated limitation: the model output lost the
availability qualifier and the current checks would offer a proposal. This is not
adequate evidence of actual current employment hours. Exact confirmation remains
required, production chat remains disabled, and this diagnostic does not change
the provider's interpretation or add whole-sentence input gates to hide that finding.

The follow-up now routes all four captured cases to a specific period/intent
question before any proposal. This is tested by replaying their sanitized outputs,
not by claiming new live-model observations. Actual weekly work must be explicitly
selected before review; availability/different-period answers leave facts unchanged.
Confirmation is still a separate action. No further provider call is needed to
answer. The post-preview capacity signal is conservative and does not establish
general understanding of every possible modal expression.

No proposal or confirmation function ran. The existing user pending 38 -> 37
proposal was verified before the run and included in unchanged local-state
digests throughout. Before/after each preview, the approved receipt remained
revision 5 / 38 hours and the untruncated graph digest was unchanged. Each returned
session's turn listing returned 200, zero turns and no further page. This observes
empty session metadata; it does not establish zero provider retention.

Exactly **4 preview POSTs and 20 read-only GETs** ran, with no retries or deletes.
No token/cost figures were returned. The ignored developer-only report retains
the fixed fictional inputs, minimal field/value observations, sessions, reason
codes, request counts and state digests; no credentials or full provider response
bodies are stored. Runtime diagnostic evidence has the separate bounded retention
described in [CHAT_PREVIEW.md](CHAT_PREVIEW.md).
