# Reviewed policy interface and private checks

No real policy content ships in the runtime. The default registry is empty and
returns `POLICY_UNAVAILABLE` for assessment requests. Synthetic records exist only
under `tests/` and are never imported by application code or fetched from their
fixture URLs. This increment does not claim a complete immigration assessment.

## Records and approval

`shared/policy.ts` defines a strict versioned record: stable policy ID, version,
program/title, inclusive `effectiveFrom`, exclusive optional `effectiveTo`, official
source URL, exact source body, body SHA-256, retrieval time and review metadata.
Initial source hosts are HTTPS `canada.ca` and `ontario.ca` (including subdomains).
An allowed hostname alone is not evidence that an extracted rule is correct.

Each version may be draft, held, reviewed or superseded. A reviewed record must
have reviewer and review time, and its `policyDigest` must appear in an explicit
operator-owned approval allowlist. The digest binds the exact source content and
metadata, effective dates and ordered criteria; it excludes review metadata so a
reviewer can approve the content hash without altering it. Merely setting status
to reviewed is insufficient. Changing content needs a new approval digest.

There is no public/AI promotion endpoint and no automatic reviewer. Initial manual
procedure: inspect the official source and effective dates, check each supported
criterion against it, record reviewer/time, approve that exact digest, and resolve
overlap/held conflicts before placing the public bundle in trusted configuration.
This documents the conservative initial mechanism; a broader editorial promotion
workflow still requires product review. No real bundle has been approved.

The optional `MAPLE_REVIEWED_POLICIES_FILE` reads a JSON object containing
`versions` (policy records) and `approvedDigests` (approved content hashes). The file
is operator-controlled and read once at startup. Its absence means no policies;
invalid supplied content fails closed. Do not include user information or secrets.
This local reviewed-policy interface does not configure a shared AM policy Context.

## Supported checks

Two deterministic operators are currently supported: `answer_equals` for paid work
or work authorization, and `number_gte` for hours per week. All expected answers and
thresholds must come from an explicitly reviewed policy record; none is hardcoded
as immigration law. Unknown, missing and not-applicable answers return
`needs_information`, never an invented negative or positive. Unsupported operators
are rejected. Completed calendar duration is not treated as qualifying experience.

Overlapping reviewed versions, held conflicts, altered body hashes, unapproved
digests, invalid dates, future and superseded versions are unavailable. The UI
lists only active approved summaries and includes official-source/effective-date
metadata. These are criterion checks, not complete program eligibility, FSW
selection score, CRS, or an invitation prediction.

## Private assessment and notification boundary

`POST /api/assessments` accepts only `{policyId}`. Owner, facts, revision, date and
result cannot be supplied by the browser/model. The server verifies Clerk identity,
reads approved AM evidence and selects the reviewed policy for the server's Toronto
date. A date rollover during the remote read rejects the run rather than returning
yesterday's result as current.

The local journal stores derived statuses and source/evidence references, not
canonical personal values. Deduplication is private to owner + fact revision +
policy digest + assessment date. A single SQLite transaction rechecks revision and
pending-write state, inserts the result, and creates one private notification.
No shared user-result cache exists.

`GET /api/assessments`, `GET /api/assessments/:id` and notification reads filter by
the verified owner. Foreign/absent IDs both return 404. Before returning current
judgments the service rereads AM; changed facts/policy/date mark history stale,
while unverifiable storage marks it unverified. Both states withhold the old
judgments and retain metadata for refresh. Pending chat/form proposals never
establish approved evidence. No assessment executes a memory write.

Live Clerk/AM grant, tenant-isolation, consent and background-processing validation
remain prerequisites for use with real personal information. No service setup,
credential configuration or legal-rule promotion happened in this increment.
