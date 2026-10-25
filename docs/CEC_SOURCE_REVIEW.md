# CEC recorded-work interval: source review, 2026-10-25

The review candidate is `policy-drafts/cec-work-experience.candidate.json`, version
`2026-10-25.single-interval.v1`. It is **draft and inactive**. Its exact content digest is
`2a4a9f8790ab98edd3a4e743d319f3f02e021510d668a4ceda4076aa530ace21`.
The source/hash manifest and preparation steps are in
`policy-drafts/cec-source-review.json`. The checked-in candidate stays draft; a
separate local reviewed copy was explicitly approved and activated as described below.

## Source-to-implementation findings

| Supported condition | Evidence and treatment |
| --- | --- |
| One year or equivalent part-time work within three years before application | [IRPR 87.1(2)(a)](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/section-87.1.html); evaluated as if applying today in Toronto. |
| 12 months, 1,560 hours, maximum 30 hours per week | [IRCC CEC guidance](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/canadian-experience-class.html), including part-time and combined-job examples. Overtime cannot accelerate twelve months. This implementation accepts one consistent interval, not overlapping jobs. |
| Paid work; physical presence in Canada; authorized temporary-resident work; Canadian employer for remote work | Current IRCC guidance plus IRPR 87.1(3). Unknown answers hold; conflicts and mixed conditions require review. |
| NOC TEER 0–3 and performed duties | IRPR 87.1(2)(a)–(c). Job title alone is insufficient. Review found the intake omitted explicit confirmation of all essential duties; this is now a separate optional evidence field, with absence returning needs information. |
| Full-time study, unauthorized work and ordinary self-employment excluded | IRPR 87.1(3), with the current IRCC physician exception deliberately outside this calculation. No physician exception is assumed. |
| Incomplete or complex history | A Maple implementation limit, not a claim that CEC requires continuous work. Gaps, multiple intervals, concurrent jobs and variable conditions return needs information. |

The exact IRCC HTML is embedded in the candidate and its UTF-8 SHA-256 is verified.
Raw copies of all four reviewed public sources are retained under the ignored
`.local/cec-policy-review-20261025/` directory. The Gazette response contains bytes
inconsistent with its declared UTF-8 encoding; its original bytes and raw hash are
preserved without silent replacement. Its commencement wording was also read from
the official page through the web reader. It is supplementary date evidence, not
the candidate's primary source body.

## Applicability date and limits

[SOR/2022-220, sections 7 and 10](https://gazette.gc.ca/rp-pr/p2/2022/2022-11-09/html/sor-dors220-eng.html)
changed CEC to NOC 2021/TEER and commenced on **2022-11-16**. That is the candidate's
proposed `effectiveFrom` for this TEER-based version. It is not CEC's inception date,
not when every requirement began, and not the IRCC page's 2026-10-16 modification
date. The reviewed consolidated regulation reports current-to 2026-09-30; current
IRCC guidance was checked on 2026-10-25. Historical application replay is not validated.

The sources do not prescribe this program's day-level counting algorithm. The
single-interval calculation counts complete weeks conservatively and holds a
threshold depending on a partial week. Potentially material February 29 anniversary
or lookback cases now return needs information instead of treating a March 1
convention as a legal finding. Ongoing intervals exclude the assessment day; closed
intervals include the recorded actual last day. No fabricated end dates are saved.

The result concerns these supported conditions for the recorded interval only.
It does not establish full CEC eligibility, clear every possible occupational
restriction, assess language/admissibility/intended residence, calculate CRS, or
predict an invitation. NOC validity and duties remain explicitly reviewed evidence.
Unverified native conversation facts cannot substitute for reviewed inputs.

## Approved local activation

The repository's [manual promotion procedure](POLICIES.md#records-and-approval)
requires an operator to approve the exact digest, record reviewer/time and place
the reviewed version in the operator-controlled allowlist. The user explicitly
approved this version for the single-user localhost trial on 2026-10-25.

A separate ignored bundle records that approval and the exact digest; the source
candidate is unchanged. The reviewed copy was recorded at 04:19:39 UTC and the
owned localhost process restarted successfully at 04:22 UTC with that bundle.
This is **only the single-user local trial, within the stated scope and date/counting
limits**, not a production release or professional legal certification.

Combined validation passed 628 offline tests, typecheck, server compilation and
frontend build. Missing evidence still returns needs information. No credentials,
grants, database schema, saved facts or memory messages changed in this activation.
The user must still review/save interval evidence before a personal assessment and
private notification can be produced; that authenticated browser path remains a
user-led check.
