# Demo acceptance review — October 25, 2026

## Actual evidence by layer

| Layer | Verification | Limit |
| --- | --- | --- |
| Authentication | Existing Clerk server verification and one-owner bindings; negative tests | Current Codex IAB session is signed out; no live browser auth bypass |
| Profile | Real dedicated AM triple write, exact receipt/digest readback, revision 1 | Explicit fictional profile; no documents adjudicated |
| C20 sources | Two actual IRCC page fetches matched reviewed body hashes | Reviewed C20 coverage, not exhaustive pathway discovery |
| C20 generation | One actual native AM `/chat` call using unchanged natural question, profile, conditions and source bodies | Generated explanation is not certified legal advice |
| Reply validation | Complete JSON/code-fence wrapper, exact source/status checks and known-dangerous-claim checks | No claim that regex catches every semantic error |
| Native retention | Exact returned session read shows user and assistant turns; no pagination | One bounded example, not retention or recall reliability certification |
| Journey persistence | Two completed events reloaded through a fresh real Surreal connection | Derived output storage is distinct from canonical AM profile storage |
| EE replay | Five real source fetches, complete fictional 528 → 568, same profile/date, November 3 projection, repeated request reused original event | Announced future policy; no invitation or legal-score guarantee |
| Isolation | Dedicated Context/key verified; ordinary current attributes match before-state | Ordinary mixed Context still needs reviewed cleanup; multiuser production is deferred |

The live C20 response arrived inside a Markdown JSON fence. The first parser
withheld it. A second check falsely flagged the disclaimer “cannot be guaranteed.”
Regression fixes accept only one complete JSON fence and distinguish the limited
negative guarantee wording, while still holding positive claims and mixed positive/
negative cases. Existing raw evidence was revalidated and only its derived journey
display was conditionally updated. The original record remains in the private audit;
no new inference, profile mutation or deletion was used for recovery.

## Offline UI and negative coverage

The separate fixture at `http://127.0.0.1:5196/` used the actual component and
coordinator with prominently disclosed test adapters. Earlier Codex IAB checks
covered exact profile review/save, C20 display, changed employer with no reciprocity,
historical explanation inspection, policy replay, full-score evidence, fresh load
and deduplication. Light/dark and mobile/desktop views were inspected. Those tests
are distinct from the live backend acceptance above and cannot replace real sign-in.

Regressions cover missing reciprocity, employer-name independence, date/arrival
contradiction, impossible chronology, missing Canadian employer, conflicting offer,
owner denial, missing Context binding, replay/idempotency, uncertain outcomes,
source mismatch, excessive question length, malformed/contradictory native replies,
code fences, disclaimers and dangerous positive claims. Current aggregate:
**774 tests / 38 files**, typecheck and build passed.

## Remaining acceptance

1. Complete real Clerk sign-in in Codex IAB, inspect both existing saved results,
   then refresh/reload and repeat the already saved EE replay. No extra C20 model
   call is needed for persistence verification.
2. Confirm the actual localhost UI shows concise sources/reasons, the generated
   explanation disclosure, full score breakdown and future-policy labels.
3. Keep the current draft unmerged until user review. No live deployment is authorized.

The former hosted-schema permission block was resolved by the user's specific
approval; test and development schemas are applied. Dedicated Context setup is
also complete. The current browser sign-in prerequisite is not another database,
subscription or credential setup request.
