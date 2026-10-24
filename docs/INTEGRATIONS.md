# Integration checklist — 2026-10-24

Deadline context: October 25 at 23:59 America/Toronto (October 26 at 03:59 UTC). The first slice prioritizes authenticated, consented personal facts over extra services.

| Integration | Status | Exact next requirement |
| --- | --- | --- |
| New GitHub repository | Ready | Private `Zetta-tech/maple-companion`; original README preserved. Feature branch `feat/authenticated-memory-slice`. |
| Local Node/TypeScript/React/Express | Ready | Installed and pinned in the lockfile; Node 24. No extra application/database framework. |
| Clerk SDK/server verification | Implemented; live unverified | Existing development application selected by the user; React guide applies. No new application or CLI initialization needed. Real SDK signature, expiry and authorized-party verification are covered by locally signed test JWTs. |
| Clerk email method | Decision outstanding | Recommend email one-time code. Google + email was accepted, but OTP versus password was not explicitly selected. UI delegates method choice to Clerk settings. No auth-method setting has been changed. |
| Clerk configuration | User configuring locally; live unverified | Publishable/secret format and environment prefixes passed a secret-safe local check. Optional `CLERK_JWT_KEY` was malformed; user may leave blank or supply complete public PEM. No agent edits or provider validation occurred. OAuth/security changes still require approval. |
| AM data-plane adapter | Implemented; live unverified | Pinned `@surrealdb/memory` 1.0.0-alpha.11; native structured triple write + exact fact receipt readback. No `/profile` or semantic top-k for authoritative facts. |
| AM per-user isolation | Needs approval and live tests | One new private Context AND its own HTTPS host for each pilot Clerk user, separate approved-reader/approved-writer principals, exact grants on `maple/approved`. No shared user Context or global AM host. |
| AM current plan capacity | One-user pilot only | User's Create Context screen shows Free, 0 of 1 Context used. A second private user Context and shared-policy Context cannot both fit this allowance. No upgrade authorized; no shared-user-scope workaround. Unmapped users remain denied. |
| AM automatic provisioning | Blocked on verified control-plane contract | Data-plane SDK does not create Contexts/principals. Studio or Cloud API must provision them. Exact automated Context-creation/grant contract must be established before adding signup provisioning. No invented endpoint. Initial pilot may use manually approved mappings. |
| AM consent boundary | Implemented conservative boundary; live gate pending | Confirmed operation receipt must match exact live fact ID, digest, owner, scope, provenance and supersession. Raw conversational extraction and computed profiles cannot become assessment evidence. Test background-derived facts and grant denial before enabling conversation memory. |
| Workflow journal | Implemented locally | `MAPLE_JOURNAL_PATH` on persistent private disk. SQLite holds pending operations/receipts/revisions/notification metadata, not a canonical profile. Hosted disk, access controls, encryption, retention/backup and recovery need review before deployment. |
| AI proposal interpreter / JEV | Deferred from first slice | No API key or paid model call needed for the explicit form path. Add an interpreter port later; AM-only versus extra JEV classification remains an experiment. Ambiguity asks for clarification. |
| Reviewed public policy | Version/source interface implemented; registry empty | Exact body hash, official-host allowlist, effective intervals, review metadata and explicit digest approval. Overlaps/held conflicts fail closed. No source discovery or real rule promotion has run. |
| Private assessments | Implemented for narrow reviewed criteria | Receipt-approved AM evidence only; owner-bound persistence and deduplication; source/version/date provenance; stale/unverified results withheld. No complete eligibility, FSW score or CRS calculation. |
| In-app notifications | Implemented for save and assessment receipts | Private, owner-filtered, durable and unique per event. No email/SMS delivery or subscription. |
| Deployment/submission | Not authorized | No deploy, public visibility change, merge, auto-merge or submission. Recheck triggers before any future push. |

## Configuration contract

Required names: `APP_ORIGIN`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `MAPLE_AM_BINDINGS_FILE`, `MAPLE_JOURNAL_PATH`. Optional names: `PORT` (default 3000), `CLERK_JWT_KEY` (public key, enables networkless verification). `AM_ENDPOINT` was removed: hosted AM gives each Context a separate host, now stored as `endpoint` on each binding. See [minimal setup](SETUP.md).

`MAPLE_JOURNAL_PATH` must identify persistent local storage; `:memory:` and SQLite URI modes are rejected in runtime configuration. `MAPLE_REVIEWED_POLICIES_FILE` optionally points to a trusted, manually approved public-policy bundle; when absent the registry is empty. It is not needed for Clerk/AM setup and has not been configured. See [policy contract](POLICIES.md).

Each binding's `endpoint` must be its actual Context's HTTPS origin with no path, query, userinfo or embedded credentials. `APP_ORIGIN` must be an exact origin; HTTP is accepted only for localhost/127.0.0.1. Clerk environments must match. No runtime simulator switch exists.

The ignored binding file is a server-only array with these fields:

```json
[
  {
    "ownerId": "user_REPLACE_WITH_VERIFIED_CLERK_ID",
    "endpoint": "https://REPLACE_WITH_THIS_CONTEXT_HOST",
    "context": "REPLACE_WITH_PRIVATE_CONTEXT_ID",
    "readKeyEnv": "AM_USER_001_READ_KEY",
    "writeKeyEnv": "AM_USER_001_WRITE_KEY"
  }
]
```

Those are placeholders, not configured accounts. Actual key values belong in an approved secret store/environment. Each entry names its own `AM_*_READ_KEY` and `AM_*_WRITE_KEY`. Duplicate owners/Contexts/host origins/reused keys fail configuration. The binding file is never accepted from an HTTP request. Unmapped signed-in users get `CONTEXT_NOT_PROVISIONED`, not a shared or fabricated workspace.

## Approval boundary and next live run

User is manually configuring the existing Clerk development application and first private AM Context. Any agent provisioning, grant/security change or credential installation remains pending action-time approval. Target: the new Maple companion services only. No such agent action has been attempted, denied or left uncertain. No real keys were requested or printed. Do not overwrite the user's local files.

Once approved configuration is in place, agree on fictional test data and any AM/model usage cost, then follow the [single-user live validation plan](LIVE_VALIDATION.md). Hosted two-user isolation remains blocked by Context capacity until a separately approved capacity/hosting choice provides two private Contexts. Local two-owner tests do not resolve that blocker. Keep chat memory and deployment gated, and do not claim production readiness.
