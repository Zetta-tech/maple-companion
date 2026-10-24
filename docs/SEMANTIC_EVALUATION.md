# Native AM semantic evaluation checkpoint

2026-10-24, based on merged commit `9889cc2`. This is evaluation preparation,
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
budget. No quota was raised and no semantic-evaluation request was sent. This is
the application's trial budget, not a reported provider quota error.

The four prepared test cases use a clear synthetic prefix and fictional job data:

| Case | Fictional message | Local transport | Live semantic result |
| --- | --- | --- | --- |
| Paraphrase/typo | I currenly put in 37 hours each week at my fictional job. | Passed | Not run: daily budget |
| Missing period | I now work 37 hours. | Passed | Not run: daily budget |
| Negation | I do not work 37 hours per week. Do not change my current hours. | Passed | Not run: daily budget |
| Hypothetical | If I worked 37 hours per week next month, what would change? This is hypothetical. | Passed | Not run: daily budget |

The 56 focused tests cover these four full-input transport assertions plus the
existing preview shape, bounded response, no-retry/full-fallback, owner isolation,
uncertain response, candidate-normalization and expiry checks. They use the real
SDK with test-only responses. They do **not** establish live interpretation quality.

## Evaluation contract before changing routing

Natural wording should reach the interpreter before Maple's field validation.
The intended result must separate candidate value, period, current factual
correction intent, negation/hypothetical/question status, supporting input and
uncertainty. A number or an extracted fact alone does not establish these.

Observed native preview responses so far expose attributes and uncertainty arrays,
but a sufficient intent/units contract has not been demonstrated. Missing or
ambiguous semantics must remain a clarification. If native preview cannot supply
the needed distinction, explicitly establish current-factual intent and weekly
period with the user before creating a proposal; do not silently invent metadata
or expand a message regex whitelist. Exact review and separate confirmation still
govern writes. Owner, Context, revision and allowed field remain server-controlled.

When budget permits an authorized evaluation, compare approved state and receipts
before/after, record actual candidates and uncertainty (including failures), track
returned session side effects, and stop on unexpected persistence. Never use full
ingest as a fallback. The four cases are a small diagnostic, not production QA.
Provider retention remains unresolved and production chat remains disabled.
JEV comparison requires its own future configured access and evaluation.
