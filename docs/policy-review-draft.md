# Inactive review draft: Canadian high-wage work component

This is a source review and proposed test plan, not a legal-rule release or an
assessment of any person. No runtime policy, approval digest, shared AM Context,
personal fact or calculator is created by this document.

```yaml
draftId: canadian-high-wage-work-21221-21223
version: draft-2026-10-24.1
sourceSetVersion: observed-2026-10-24
sourceCheckedAt: 2026-10-24T19:58:20Z
announcementPublicationDate: 2026-10-16
announcedEffectiveFrom: 2026-11-03
effectiveTo: null # Not established; not an assertion of perpetual validity.
reviewStatus: draft
reviewed: false
activated: false
reviewerId: null
reviewedAt: null
governingInstrumentVerified: false
sourceBodySha256: null # Exact source snapshots/hashes still needed before promotion.
approvedDigests: []
```

The October 16 announcement identifies November 3 as the effective date. Before
then this is future guidance. Reaching that date does **not** activate an unreviewed
Maple draft. The full latest Ministerial Instructions have not been verified:
the earlier `current.html` lookup returned 404 and remains unresolved. Official
guidance is available; completeness of the governing instrument is not established.
[Announcement][announcement]

## Source register

Links were read on October 24, 2026. A displayed page date is retained separately
from a publication date; it is not an immutable source version or approval.

| Source | Displayed date | Role |
| --- | --- | --- |
| [October announcement][announcement] | 2026-10-16 | Publication/effectivity and component hierarchy |
| [2026 changes][changes] | 2026-10-16 | Work component and alternative-offer comparison |
| [Occupation list][occupations] | 2026-10-16 | Future NOC tier membership; underlying data 2023–2025 |
| [CRS work FAQ][faq] | Modified 2026-09-28 | CRS lookback, authorization and exclusions |
| [CEC guidance][cec] | 2026-10-16 | Separate program window; hours and location examples |
| [CRS criteria][crs] | 2026-10-16 | Score context and future-change notice |

## Candidate interpretation for review

NOC **21221** (Business systems specialists) and **21223** (Database analysts and
data administrators) both appear in the **1.5× to less than 2×** tier. The list
classifies occupations, not the individual's salary. AI job-title matching alone
cannot establish a NOC: this draft requires confirmed duties, supporting evidence
and user review. [Occupation list][occupations], [NOC duties guidance][cec]

The component selects **70, 40 or 20**, never their sum. The 70 tier requires the
highest-band experience; otherwise qualifying combined experience at 1.5× or
higher supports 40; otherwise the 1.3× threshold supports 20. Scope here is the
40-point candidate component for the two target NOCs, not an entire CRS calculator.
That component does not promise a 40-point increase in total CRS, eligibility or
an invitation. [Announcement][announcement], [CRS context][crs]

Freeze a 12-month/1,560-counted-hour equivalent for the test plan, capped at
30 hours per week across overlapping work. Do not accelerate completion with
overtime. Equivalent part-time and discontinuous periods may count. The cap and
equivalence examples are documented; exact partial-week/calendar boundary
arithmetic still needs review before code. [Changes][changes], [Hours examples][cec]

CRS experience uses a **ten-year** lookback, authorized TEER 0–3 work and equivalent
full-time duration. Full-time-study work and ordinary self-employment are excluded;
the physician exception is outside this draft. CEC has its own **three-year**
window. Its explicit remote-work guidance requires physical presence in Canada
and a Canadian employer; retain these conditions in the frozen cases and verify
their governing CRS basis before promotion. [CRS FAQ][faq], [CEC guidance][cec]

Compare the combined work-length and high-wage-work option against an independently
established qualifying-job-offer option; select the higher, never add both. Offer
eligibility is outside this draft. A supplied 100-point offer fixture is independent
of the two target NOCs: their listed offer tier is 70, not 100. [Changes][changes]

## Frozen hypothetical expectations, not active legal calculations

Every row assumes synthetic evidence, the applicable future rule version and all
unstated prerequisites proven. `needs_information` means missing or conflicting
evidence, never inferred facts. These are proposed tests, not executed assertions.

| Case | Expected boundary |
| --- | --- |
| Confirmed duties support 21221/21223 versus title alone | Candidate tier can be checked versus `needs_information`; no automatic NOC approval. |
| 12 months × 30 hours/week; 24 months × 15 | Counted equivalent may satisfy the duration boundary. |
| 11 months with overtime | Incomplete; do not round up or accelerate. |
| Sequential qualifying 6 + 6 months, with a gap | May combine; continuity is not a CRS requirement. |
| Two concurrent jobs covering the same 6 months | Not 12 months; combined weekly credit stays capped. |
| Remote work while physically abroad | Exclude from this Canadian-work fixture. |
| Full-time-study work; ordinary self-employment | Exclude; do not apply the physician exception implicitly. |
| Qualifying work four years before assessment | Within CRS lookback; outside CEC's separate window. |
| Missing hours, unconfirmed duties or conflicting dates/authorization | `needs_information`; no positive component conclusion. |
| November 2 versus November 3, 2026 | Future versus effective-date reached; both remain inactive while `reviewed=false`. |
| Independently proven 70/40/20 thresholds overlap | Choose the highest satisfied component, not 130. |
| Work-length 40 + high-wage component 40; independently proven offer option 100 | Compare 80 with 100 → 100, never 180. No total-CRS or offer-eligibility inference. |

The work cases draw from the [CRS FAQ][faq] and [CEC hours/location examples][cec];
future-component and comparison cases draw from the [announcement][announcement]
and [changes guidance][changes]. Missing-evidence handling is Maple's proposed
deterministic safety behavior, not an additional government eligibility rule.

## Review questions before implementation or promotion

- Locate the complete governing instructions and reconcile every condition with
  these guidance pages, including the CRS basis for remote-work location/employer
  checks. Keep unresolved conflicts on hold.
- Capture exact dated source bodies/hashes, the operative NOC-list version and
  reviewer approval; confirm the legally applicable effective instant. Toronto
  dates are Maple's current assessment convention, not proof of that legal instant.
- Specify auditable week/period aggregation, gaps, overlap allocation across tiers,
  partial weeks, lookback edges, leave and leap-day treatment. Current single-job
  fields and `number_gte`/`answer_equals` operators cannot express this rule.
- Define evidence for duties/NOC, physical location, employer, work authorization,
  study status and self-employment. Keep approved facts in AM and corrections behind
  exact confirmation. Do not invent a canonical profile copy or default unknowns.
- Review independent job-offer evidence and score comparison separately. Never
  modify a government account or equate a component result with program eligibility.

No rule bundle is generated, loaded or promoted. Implementation and activation
remain separate reviewed changes under the [existing policy procedure](POLICIES.md).

[announcement]: https://www.canada.ca/en/immigration-refugees-citizenship/news/2026/10/changes-to-express-entry-for-high-wage-occupations.html
[changes]: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html
[occupations]: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/high-wage.html
[faq]: https://www.ircc.canada.ca/english/helpcentre/answer.asp?qnum=1132&top=29
[cec]: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/canadian-experience-class.html
[crs]: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html
