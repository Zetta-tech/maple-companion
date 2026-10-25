# Full CRS completion scope - 2026-10-25

The current result remains a **Canadian-work component projection**, not a total
CRS score. November 3, 2026 is the policy's effective date; an October 25 comparison
is a future projection using one fixed profile and assessment date.

## Reviewed primary references

- [IRCC CRS criteria](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html)
- [IRCC changes](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html)
- [IRCC high-wage occupations](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/high-wage.html)

The criteria reference supplies age, education, language, spouse, transferability
and additional-point tables. It also defines caps and when accompanying-spouse
scoring applies. These inputs are absent from the current demo profile. Missing
inputs must not be silently assigned zero or populated from the operator's life.

## Smallest credible complete fictional-profile increment

1. Add an optional, explicitly confirmed CRS evidence section to the AM demo
   envelope, with backward-compatible receipt validation. Record age as of the
   assessment date, reviewed education/equivalency, each language ability and test
   validity, spouse applicability and factors, eligible foreign work, Canadian
   education, sibling, nomination and trade-certificate facts. Explicit negative
   answers differ from unknown. A fully specified fictional fixture can be offered
   for review, but must not be silently attached to an existing profile.
2. Implement the published tables and caps as a pure calculator with a visible
   breakdown. Keep qualifying experience/evidence validation separate from points.
   Establish the qualifying-offer alternative independently; compare it with
   work-duration plus the occupation bonus rather than adding both alternatives.
3. Add the reviewed CRS source to retrieval/version validation. Save the exact
   evidence revision, source hashes, as-of date and before/after breakdown in the
   private journey. Withhold a total when any required evidence is unresolved.
4. Test boundary tables/caps, spouse applicability, incomplete/expired evidence,
   alternative offer dominance, identical before/after dates, old receipt
   compatibility, exact confirmation and fresh-load persistence.

Estimated implementation scope: roughly 6–9 code/test files, 250–400 lines of
scoring/evidence logic plus intake and regression tests; two focused implementation
and review passes (approximately 3–5 hours, not a delivery guarantee). It is larger
than a safe overnight patch to the existing component calculator. No new service
or AI interpreter is required, and no full-score implementation is claimed here.

The higher-value immediate fixes are complete: contradictory arrival/work history
now holds scoring, dated results retain their explanation, known-unsent requests
do not lock the composer, and ungrounded generated explanations are withheld.
The priority remains verifying the C20 workflow through real persistence after the
explicit migration and shared-AM-context decisions, rather than manufacturing a
total score from incomplete inputs.
