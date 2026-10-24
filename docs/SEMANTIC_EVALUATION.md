# Native AM semantic evaluation checkpoint

2026-10-24, based on merged commit `9889cc2`. This is a bounded synthetic diagnostic,
not a change to the running weekly-hours trial or permission for production use.

The user reported a successful supported chat correction to 38 hours. One
read-only AM request independently verified revision 5, its receipt, synthetic
fixture identity, settled chat metadata and one corresponding save notification
(five save notifications total). The earlier incomplete messages were stopped
by Maple's syntax gate before AM; they do not establish an AM language limitation.

## Budget and execution

The existing local trial permits five attempts per UTC day and 50 journaled
attempts in total. At 21:46 UTC, four attempts were in the owner's chat journal.
The separately recorded empty-session reproduction added one more live preview
that day. Counting that probe gives five known attempts and zero remaining daily
budget. The initial evaluation was held. This was the application's trial budget,
not a reported provider quota error.

The user-authorized continuation then supplied a separate allowance of exactly
four diagnostic previews. Run `semantic-20261024-A` recorded a durable counter
before each attempted POST and refused reruns. The normal app limit stayed
unchanged. All four calls completed without retries: **4 preview POSTs and 20
read-only GETs**, bounded to 24 total requests. There was no full extraction,
confirmation, profile write or deletion. No token usage or cost was returned.

Every request used this framing, followed by the unchanged message below:

```text
SYNTHETIC SEMANTIC EVALUATION ONLY. Fictional test person.
Saved context (background): the currently recorded work total is 38 hours per week.
User message (verbatim):
```

The background came from the approved synthetic fixture. It was not an instruction
to extract 37 or to assume weekly units; its influence on the missing-period case
must nevertheless be acknowledged. No original message was rewritten into the
existing app's accepted phrase template.

| Case | Fictional message | Actual AM preview output | Interpretation limit |
| --- | --- | --- | --- |
| Paraphrase/typo | I currenly put in 37 hours each week at my fictional job. | One `work_hours` attribute: `37 hours each week`, category `identity` | Understood this paraphrase despite the typo. No dedicated correction-intent field. |
| Missing period | I now work 37 hours. | One `employment_record` attribute: `37 hours per week`, category `context` | Added a weekly period, which was available in background context but absent from the message. Needs explicit unit clarification. |
| Negation | I do not work 37 hours per week. Do not change my current hours. | No attributes; one `maintain_current_hours` instruction: `Do not change the user's currently recorded work hours.` | Preserved the no-change instruction in this sample. Do not promote extracted instructions into approved facts. |
| Hypothetical | If I worked 37 hours per week next month, what would change? This is hypothetical. | Empty extraction arrays | Produced no proposed fact in this sample. An empty extraction is not a conversational answer. |

All four outputs had empty `uncertainties` and `corrections` arrays. Empty
uncertainties did not establish that the missing period was explicit or unambiguous.
The API returned differing keys/categories, which an application adapter must
validate; model entity identifiers must never control owner routing.

Each preview returned a distinct session ID. One read of each returned HTTP 200,
zero turns and no further page. Before and after **each** preview, untruncated graph
snapshots and the approved receipt/digest were unchanged at revision 5 / 38 hours.
Owner-bound journal, proposal, receipt, assessment and notification state also
remained unchanged. This observes session metadata side effects, not zero retention
or the absence of internal processing traces. The ignored local run report retains
the exact request text, outputs, sessions, counters and comparison evidence.

The 56 focused tests cover these four full-input transport assertions plus the
existing preview shape, bounded response, no-retry/full-fallback, owner isolation,
uncertain response, candidate-normalization and expiry checks. They use the real
SDK with test-only responses. They do **not** establish live interpretation quality;
the matrix above is the separate live evidence. Typecheck and tracked-file hygiene
also passed. No runtime code was changed for this diagnostic.

## Evaluation contract before changing routing

Natural wording should reach the interpreter before Maple's field validation.
The intended result must separate candidate value, period, current factual
correction intent, negation/hypothetical/question status, supporting input and
uncertainty. A number or an extracted fact alone does not establish these.

These observations show useful interpretation by native AM; they do not support a
claim that it cannot understand natural language. The API's observed extraction
shape is not a complete authorization or intent contract. The missing-period result
shows that a plausible inferred fact can arrive without an uncertainty marker.

Minimal next architecture: send natural input to AM preview first, map only a
supported candidate field, and validate numeric bounds and units without using an
exact-phrase input whitelist. Hold extracted instructions, unknown fields,
conflicting candidates and uncertainty. Clarify a period or current-factual intent
that the input/output does not establish; do not silently invent those semantics.
Exact review and separate user confirmation still govern approved writes. Owner,
Context, revision and allowed field remain server-controlled.

The four cases are a small diagnostic, not a quality guarantee. Further variation
or provider limitations must be measured rather than inferred from this sample.
Provider retention remains unresolved; production chat remains disabled. JEV
comparison requires its own future configured access and evaluation.
