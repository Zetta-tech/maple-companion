# Verification checkpoint — 2026-10-24

Latest `npm run check` passed: TypeScript check, **239 tests across eight files**, and server/Vite production build. The first PR checkpoint had 209 tests; sign-in setup added four, the explicit single-user development mode added eleven, and the review corrections added fifteen.

- Employment: 31 tests, including current-job dates, invalid calendar dates, unknown/no/not-applicable, NOC review and completed years.
- AM: 54 actual-SDK mocked-transport tests, including concurrent owners with distinct hosted origins/credentials, owner/Context/scope/provenance/hash validation, conflict rejection, bounded pagination/responses, preflight, stable operation keys and read-only reconciliation.
- Workflow: 35 tests, including exact confirmation, cross-owner denial, simultaneous/stale operations, uncertain outcomes, restart recovery beyond 24 hours, logical value clearing, notification deduplication, visible recovery operations and late-error/reconciliation races. Toronto date validation rejects future start/end dates after UTC midnight and revalidates legacy pending/committed records.
- Configuration: 30 tests, including independent sign-in readiness, optional public JWT key parsing, persistent-journal enforcement, per-user hosts, no legacy global-host fallback, missing config, unsafe endpoints, duplicate hosts/Contexts/keys and secret-safe errors. Development mode additionally requires explicit opt-in, development environment, loopback HTTP origin, Clerk test keys and exactly one binding; the default still rejects a reused full-access key.
- HTTP: 15 tests through actual Clerk middleware with locally generated RSA-signed test JWTs. Valid sessions pass; missing, malformed, forged, expired, future and wrong-origin tokens fail. Cross-user assessment/notification denial, origin enforcement and private/no-store responses covered. Setup permits only verified self-identification while private data access remains blocked; injected owner identifiers are ignored. Every workspace route denies unmapped users in both modes before a storage call, including an owner whose binding was removed after saving records; records are retained.
- Policy: 35 tests for official-source/body/version verification, explicit digest approval, immutability, future/superseded/conflicting rules and deterministic supported criteria. Only clearly synthetic test content is used.
- Assessments: 30 tests for private access and deduplication, approved AM evidence, no canonical-fact copy, stale/unverified results, input injection, transaction races and Toronto-midnight rollover. Evidence is explicitly validated against the assessment date.
- Business date/UI freshness: nine tests for UTC/Toronto rollover, DST days, leap/year boundaries, rendered result expiry, timer revalidation and visibility/focus/page restoration. Old requests cannot replace newer panel loads. These are timer and rendered-component checks, not a claim of completed interactive browser QA.

The first HTTP test run was blocked by sandbox loopback access (`EACCES`); the authorized elevated local run passed. Automated tests use synthetic credentials and local transports, not live providers. The later user-authorized read-only connection checkpoint is recorded below.

Codex in-app browser opened the real local build at `http://localhost:3000` and initially displayed the explicit missing-configuration state, then the configured Clerk sign-in UI after user setup. No Chrome or dot UI was used. Authenticated form visual QA, mobile UI, independently verified real Google/email sign-in, AM hosted grant/isolation/supersession/background behavior and complete browser-to-provider flow remain unrun. The page was not bypassed with a fake runtime session. The later real backend save trial is recorded below.

Repository verified private and correct; original tree had only README and no changes. Feature branch: `feat/authenticated-memory-slice`. Fresh read-only pre-push checks found zero repository webhooks, zero workflows, zero deployment history, and zero connected Vercel projects visible to the connected account. No deployment, merge, auto-merge, visibility change or submission is authorized. The private draft PR and commit are reported in the task handoff.

At the initial bootstrap, missing hosted configuration and unverified AM control-plane/grant semantics were live-validation blockers. No real policy has been promoted. The user's local `.env` remains ignored and has never been overwritten by the agent; subsequent explicitly authorized internal presence/format checks are recorded below. Production readiness is not claimed.

At the user's subsequent explicit request, local Clerk entries were checked inside validation code with only presence/format booleans emitted. The publishable/secret formats and test/live prefixes matched; the optional JWT entry was not a parseable public PEM. No values were printed, no provider was contacted and `.env` was not edited. Runtime now reports malformed optional JWT configuration clearly. Blank JWT configuration is treated as absent.

Production dependency audit (`npm audit --omit=dev --audit-level=high`) reported zero known vulnerabilities at this checkpoint. This is an advisory database check, not a complete security assessment.

Correction: the hosted quickstart explicitly assigns one host to each Context. The original singular `AM_ENDPOINT` assumption was wrong. Runtime now requires `endpoint` per server-only user binding and rejects shared/missing hosts. Hosted principal-bound keys and explicit AM grant verbs are documented; exact provisioning UI/control-plane and enforcement have not been exercised. The SDK's flat grant constants conflict with current documentation and are not used for provisioning. See [corrected setup](SETUP.md).

Capacity checkpoint: the user's Create Context screen shows Free, 0 of 1 Context used. The first live trial is limited to one fictional-data user and one private Context. Existing configuration tests accept a single binding and deny unmapped users. Hosted two-user isolation and a separate shared-policy Context remain unrun/blocked by available capacity; no upgrade or shared-user-scope fallback is authorized. See [live validation plan](LIVE_VALIDATION.md).

First sign-in setup checkpoint: the user fixed the multiline PEM quoting; local auth configuration parses successfully. The real local app opened in Codex's in-app browser at `http://localhost:3000`, showing the configured Clerk development application's sign-in UI. The user performs sign-in themselves. No account was created by the agent. At that checkpoint no AM binding or service request existed. The supplied host/Context format was checked through the real SDK with a replaced local transport; it constructs the expected `/api/v1/{context}/attributes` path.

CI increment: `.github/workflows/ci.yml` runs the existing checks, a tracked-file credential-pattern/path check and production dependency audit on PRs to main and pushes to main. It uses full-SHA pins for official checkout/setup-node actions, only `contents: read`, no persistent checkout credentials, no package cache, no service secrets and no deployment. Hosted execution results are reported separately in the PR/task, not assumed from local tests. Repository Actions are enabled. Ruleset and main-branch protection reads returned GitHub 403 indicating the current private-repository plan does not support that feature; no rules, plan, permissions or repository visibility were changed.

CI references checked: [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use), [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0). Both pinned actions use the Node 24 action runtime.

Single-user development checkpoint: the user explicitly chose the existing
full-access AM key for fictional-data testing and manually populated the two
existing read/write environment names. Internal checks confirmed both loaded and
matched without printing values. The exact one-owner/one-Context mapping was then
written to the ignored binding file, with environment names only. `.env` was not
edited. The app runs on loopback with ephemeral process-level development opt-in;
production/default configuration does not inherit that opt-in.

The initial approved read-only hosted check returned HTTP 200 from `/me`, confirming a
principal-bound key with broad Context access, including read/write and management
verbs. Scope listing also returned 200 and initially showed `maple/approved` missing. The
local health endpoint reports configured development mode while explicitly keeping
`liveIntegrationsVerified: false`. The latest inspected Codex tab still showed
sign-in, so the user's reported signup/account ID is not yet independently
confirmed through a live authenticated app session. Remote supersession and hosted
cross-user isolation remain unrun.

After explicit user approval, `maple/approved` was registered once (HTTP 201) and
verified by a read (HTTP 200). The approved synthetic fixture then used the real
Workflow, persistent journal and AM SDK transport: proposing made zero remote
requests; exact confirmation made one fact POST (HTTP 200); receipt-bound readback
matched every submitted field; a fresh-process reload verified revision 1 and a
null ongoing-job end date. Reconfirming the committed proposal made zero additional
requests. Exactly one saved notification exists. This run made one scope POST,
one fact POST and six reads in total, with no extraction/chat model calls.

The one retained employment record is visibly labelled `SYNTHETIC TEST ONLY - Maple
Fixture 001`, with fictional test duties. It is not the account holder's immigration
evidence. The ignored local report records its operation ID for cleanup review;
no credentials or account mapping are committed. Do not use this Context/account
for real assessments until the fixture is retired through a separately approved
cleanup or transition. No permanent deletion was performed. No other Context,
principal, key, grant, plan or hosted data migration was created or changed.

The live run invoked the same backend proposal/confirmation functions directly
under the user's synthetic-test authorization. It did not bypass the browser with
a fake session or claim to verify the live Clerk JWT-to-form path. Production
readiness, least-privilege credential enforcement and multi-user hosted isolation
remain unproven.

Subsequent synthetic supersession checkpoint: the same retained fixture was changed
from 30 to 32 hours through a second exact proposal and explicit confirmation. The
remote history retained both records with the actual supersedes/supersededBy chain,
the prior record's closed validity and matching local receipts/provenance. Repeated
confirmation added no remote write or notification.

User-led UI checkpoint: the user then reviewed 32 -> 34, confirmed the save and
reported 34 surviving refresh, logout, cleared cookies and fresh sign-in. This is
explicitly user-reported browser validation, not an agent-created login session.
A separate read-only AM check at 2026-10-24T20:05:45Z corroborated current revision 3,
34 hours, null ongoing end date, three remote history records linked to their
receipts, an unchanged local head and three saved notifications. No new write was
performed by that check. The earlier signup/supersession limitations above are
historical checkpoints; hosted multi-user and least-privilege tests remain unrun.

Chat extraction checkpoint: one authorized tagged synthetic AM preview returned no
observed graph or turn changes but did create a persistent, empty session. Further
probes stopped; no deletion was performed and the approved revision 3 record was
unchanged. Live chat remains disabled. The prepared proposal-only coordinator is
tested with an explicitly test-only interpreter; those tests do not validate live
model semantics. See [the contract result and remaining decision](CHAT_PREVIEW.md).

At this chat-boundary checkpoint, `npm run check` passed: typechecking, **301 tests
across 10 files**, and the production build. HTTP tests use the actual Clerk
middleware with locally generated synthetic JWTs; memory and interpreter doubles
are test-only. New negative tests cover no automatic saves, ambiguous/negated/
hypothetical messages, malformed model output, owner injection, unmapped owners,
stale revisions before/after interpretation, replay/uncertain writes, disabled
runtime chat, and distinct classifier/storage failures. No enabled chat UI or
live-model correction-to-confirmation path is claimed by these checks.
