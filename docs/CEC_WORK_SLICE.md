# CEC work interval - single-user local trial

This is one requirement check, not CEC eligibility, FSW selection points, CRS or
an invitation prediction. Its intake and evaluator code are included in the local
preview build. After explicit user approval, version
`2026-10-25.single-interval.v1` was activated through a separate local reviewed bundle
on 2026-10-25. The default registry remains empty without that configured bundle.
Automated tests use synthetic evidence; operational test records were written only
to the separate test database. Activation sent no AM messages and changed no facts.

## Reviewed guidance and local approval

The [official CEC page](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/canadian-experience-class.html)
describes paid TEER 0–3 work in Canada, authorization under temporary resident
status, matching NOC duties, and a three-year application lookback. Its examples
use 12 months/1,560 hours with a combined weekly cap of 30, including equivalent
part-time work. Full-time study and ordinary self-employment are excluded; the
physician exception needs separate review. Remote work requires physical presence
in Canada and a Canadian employer. The page modification date is 2026-10-16; it
does not establish when a rule legally took effect.

[IRCC's student-work guidance](https://www.ircc.canada.ca/english/helpcentre/answer.asp?qnum=394&top=29)
confirms the CEC exclusion. [Statistics Canada's NOC structure](https://www.statcan.gc.ca/en/subjects/standard/noc/2021/introductionV1)
identifies TEER as the second digit. A plausible code or job title does not verify
occupation or duties; the user must review the NOC 2021 description.

The original planning draft remains `policy-drafts/cec-work-experience.json`.
The source review now supplies a concrete candidate in
`policy-drafts/cec-work-experience.candidate.json`, with exact source body/hash and
the NOC 2021 amendment's 2022-11-16 commencement date. See
[the source review and exact approval decision](CEC_SOURCE_REVIEW.md). Both source
drafts remain unchanged; the separately configured local copy contains the approved
digest and reviewer/time. The page-modification date is not used as effectiveFrom.
No HTTP/model automatic promotion exists.

## Small implementation boundary

- Optional `employment.cecWork` stores one explicitly reviewed interval in the
  same receipt-backed AM envelope after the normal exact proposal/confirmation.
  Old envelopes do not gain defaults, fields or altered receipt hashes.
- The interval records dates, hours and conditions explicitly, including all
  essential NOC duties separately from lead-statement/main-duty matching. A missing
  essential-duties answer stays absent in old receipts and needs information.
  Current hours do
  not stand in for historical hours. Conflicting general answers or an ongoing
  schedule inconsistent with current hours are held for clarification.
- Only complete single-interval history with consistent conditions is supported.
  Gaps, multiple periods, concurrent jobs and physician exceptions need review.
  Unknown and not-applicable answers remain distinct and cannot create a positive.
- The basis is applying today on the server's Toronto date. Closed intervals
  include the actual last day; ongoing intervals exclude the application day and
  never persist an invented end date. Time is clipped to the three-year window.
- Twelve calendar months and 1,560 capped hours must both be established. Whole
  weeks provide the conservative lower bound; if a partial week could determine
  the threshold, request its actual hours instead of asserting met/not met.
  Potentially material leap-day anniversaries/lookback clipping need date review.
  These are conservative implementation limits, not a claimed official day-level
  adjudication formula.
- Results contain scoped statuses/reason codes and existing source/evidence
  provenance, not another canonical profile. Existing SurrealDB private assessment
  storage, owner checks, staleness rules and notification deduplication are reused.

The opt-in database integration test passed against maple/test on 2026-10-25.
It uses real SurrealDB operational storage and a labelled AM test adapter. It
checks missing evidence, confirmation-only inputs, private results, notification
deduplication and stale conclusions. Synthetic records were retained. This does
not replace live AM validation or user review. No production rule or synthetic
test policy is runtime-loaded. The native-memory integration additionally withholds
assessment conclusions when later conversation changes need input review.
