# Full fictional CRS comparison — 2026-10-25

Implemented locally and tested offline. A profile without the optional complete CRS evidence retains the earlier Canadian-work component view. A complete, explicitly confirmed fictional profile gets age, education, four-ability language, spouse, work, transferability and additional-point calculations with visible subtotals. This is a points estimate within the supported subset, not program eligibility, document authentication or an officer-certified score.

## Reviewed primary references

- [IRCC CRS criteria](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html)
- [IRCC announced changes](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html)
- [IRCC high-wage occupation lists](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/high-wage.html)
- [IRCC language evidence](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html)
- [IRCC educational credential assessment](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/education-assessment.html)

The source bundle retains full public text, retrieval time and content hashes. `server/crs-sources.ts` binds the calculator to those five reviewed versions; missing, changed or unavailable sources hold a total. The capture script creates unreviewed candidates, never automatic rule promotions.

## Calculation and supported evidence

Version: `2026-11-03.fictional-reviewed-evidence.v2`.

- Accompanying noncitizen/non-PR spouse uses the with-spouse tables. A single, nonaccompanying or Canadian citizen/PR spouse case uses without-spouse tables and no spouse-factor points.
- Language uses reviewed CLB/NCLC for each ability, accepted tests less than two years old, and the minimum ability for transferability. Foreign credentials require a reviewed immigration ECA less than five years old.
- One consistent Canadian interval, one foreign interval/NOC and one spouse Canadian interval are supported. Hours are capped at 30 per week; completed calendar years and sufficient hours are both required. The Canadian end date is optional for ongoing work. Gaps, overlaps, disputed arrival history, boundary/complex histories and special exceptions hold a total for review.
- Eligibility attestations are explicit, dated, manually reviewed fictional evidence. They do not automatically validate documents, a NOC from a title, qualifying study, a trade certificate, nomination, sibling or an offer.
- Missing factors are not zero. Optional bonuses require an explicit no/none answer when absent. The complete-evidence section is added only by a user action and saved only through the exact-profile confirmation path.
- Canadian work additionally requires an explicit Canadian-employer answer. Old profiles retain an absent field and unchanged receipt hashes; the UI and calculator treat absence as unknown, never yes. Applicant work, arrival, test and ECA dates before the applicant's birth date hold a total. This does not impose an adult-age prerequisite or compare a spouse's dates with the applicant's birth date.
- A qualifying-offer claim requires the Canadian employment-offer answer to agree. A contradictory no or unknown holds a total; a Canadian offer can still legitimately be nonqualifying for CRS. Earlier calculator-version results remain inspectable as historical and are not reused as current results.
- Education/foreign-work transferability pairs cap at 50 each; all transferability caps at 100. Additional points cap at 600. French minimum NCLC 7 gives 25 extra points, or 50 when every English ability is CLB 5 or better.
- Current offer points are zero. The announced replacement is `current total - Canadian duration + max(duration + high-wage bonus, offer)`. Transferability continues to use actual qualifying experience. The tiers are occupation-median tiers, not the applicant's personal salary; alternatives do not stack. All 186 listed occupation codes are pinned to the reviewed source.

Both sides use identical profile facts and the same assessment date. On October 25, November 3 remains a future effective date. The public criteria retain the old overall maximum while the announcement changes allocation; the governing instrument was not available to settle the new upper-cap edge. A projection above 1,200 is withheld, not silently clamped or treated as an authorized 1,270 maximum. Sub-1,200 results remain **announced-policy projections**.

## Independent numeric fixtures and actual offline flow

| Explicit fictional fixture | Current | Announced | Delta |
| --- | ---: | ---: | ---: |
| Married Alex, master's, CLB9, two Canadian years, three foreign years, reviewed spouse factors | 521 | 561 | 40 |
| Single bachelor, CLB9, one Canadian year, three foreign years | 482 | 522 | 40 |
| Same single profile, two Canadian years | 507 | 547 | 40 |
| Single one-year profile, unlisted skilled Canadian occupation, qualifying tier-1.5 offer | 482 | 512 | 30 |
| Married Alex with a qualifying 100-point offer alternative | 521 | 575 | 54 |
| Explicitly offered Avery UI fixture | 528 | 568 | 40 |

The Alex and single vectors were supplied by a separate official-table review; their components are asserted independently in `tests/crs.test.ts`. No fixture is the real operator's biography. Tests also cover unknown/expired evidence, contradictions, caps, minimum-language thresholds, source versions, old receipt hashes, actual SDK serialization with test transport, owner denial, exact confirmation, saved breakdown, date/version staleness and replay deduplication.

Codex IAB exercised the real component/coordinator at `http://127.0.0.1:5196/`: add optional invented evidence, review every factor, inspect the exact proposal, confirm, replay, see 528 → 568, repeat and reload. The fixture visibly substitutes AM, source transport and operational storage. Its trace is private and ignored; this proves UI/coordinator behavior, not hosted service persistence or inference.

## Live boundary and remaining work

No new service, credential, principal, grant or hosted schema is required beyond the already pending three-table demo migration. The original localhost app and ordinary employment record were not changed by this increment. Demo activation, real database tests and actual AM profile/readback/chat remain blocked on the previously documented migration and shared-context decisions. No provider calls or hosted writes were made for this increment. See `DEMO_ACCEPTANCE_REVIEW.md`.
