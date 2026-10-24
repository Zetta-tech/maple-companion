# Verification checkpoint — 2026-10-24

Final `npm run check` passed: TypeScript check, **209 tests across seven files**, and server/Vite production build.

- Employment: 31 tests, including current-job dates, invalid calendar dates, unknown/no/not-applicable, NOC review and completed years.
- AM: 54 actual-SDK mocked-transport tests, including concurrent owners with distinct hosted origins/credentials, owner/Context/scope/provenance/hash validation, conflict rejection, bounded pagination/responses, preflight, stable operation keys and read-only reconciliation.
- Workflow: 31 tests, including exact confirmation, cross-owner denial, simultaneous/stale operations, uncertain outcomes, restart recovery beyond 24 hours, logical value clearing, notification deduplication, visible recovery operations and late-error/reconciliation races.
- Configuration: 19 tests, including optional public JWT key parsing, persistent-journal enforcement, per-user hosts, no legacy global-host fallback, missing config, unsafe endpoints, duplicate hosts/Contexts/keys and secret-safe errors.
- HTTP: 10 tests through actual Clerk middleware with locally generated RSA-signed test JWTs. Valid sessions pass; missing, malformed, forged, expired, future and wrong-origin tokens fail. Cross-user assessment/notification denial, origin enforcement and private/no-store responses covered.
- Policy: 35 tests for official-source/body/version verification, explicit digest approval, immutability, future/superseded/conflicting rules and deterministic supported criteria. Only clearly synthetic test content is used.
- Assessments: 29 tests for private access and deduplication, approved AM evidence, no canonical-fact copy, stale/unverified results, input injection, transaction races and Toronto-midnight rollover.

The first HTTP test run was blocked by sandbox loopback access (`EACCES`); the authorized elevated local run passed. This was not a live provider test. No credentials were provisioned or installed and no paid APIs were called.

Codex in-app browser opened the real local build at `http://localhost:3000` and displayed the explicit missing-configuration state. No Chrome or dot UI was used. Authenticated form visual QA, mobile UI, real Google/email sign-in, AM hosted grant/isolation/supersession/background behavior and end-to-end save remain unrun pending approved setup. The page was not bypassed with a fake runtime session.

Repository verified private and correct; original tree had only README and no changes. Feature branch: `feat/authenticated-memory-slice`. Fresh read-only pre-push checks found zero repository webhooks, zero workflows, zero deployment history, and zero connected Vercel projects visible to the connected account. No deployment, merge, auto-merge, visibility change or submission is authorized. The private draft PR and commit are reported in the task handoff.

Missing hosted configuration and unverified AM control-plane/grant semantics remain live-validation blockers. No real policy has been promoted; no credential or persistent-access configuration was changed. The user's local `.env` is ignored and was not opened or overwritten during setup. Production readiness is not claimed.

At the user's subsequent explicit request, local Clerk entries were checked inside validation code with only presence/format booleans emitted. The publishable/secret formats and test/live prefixes matched; the optional JWT entry was not a parseable public PEM. No values were printed, no provider was contacted and `.env` was not edited. Runtime now reports malformed optional JWT configuration clearly. Blank JWT configuration is treated as absent.

Production dependency audit (`npm audit --omit=dev --audit-level=high`) reported zero known vulnerabilities at this checkpoint. This is an advisory database check, not a complete security assessment.

Correction: the hosted quickstart explicitly assigns one host to each Context. The original singular `AM_ENDPOINT` assumption was wrong. Runtime now requires `endpoint` per server-only user binding and rejects shared/missing hosts. Hosted principal-bound keys and explicit AM grant verbs are documented; exact provisioning UI/control-plane and enforcement have not been exercised. The SDK's flat grant constants conflict with current documentation and are not used for provisioning. See [corrected setup](SETUP.md).

Capacity checkpoint: the user's Create Context screen shows Free, 0 of 1 Context used. The first live trial is limited to one fictional-data user and one private Context. Existing configuration tests accept a single binding and deny unmapped users. Hosted two-user isolation and a separate shared-policy Context remain unrun/blocked by available capacity; no upgrade or shared-user-scope fallback is authorized. See [live validation plan](LIVE_VALIDATION.md).
