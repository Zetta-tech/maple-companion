# First vertical slice

React + Vite serves a small employment workspace. Express verifies Clerk session JWTs with an explicit authorized-party origin. Every data route takes the owner from the verified Clerk `userId`; body fields cannot select an owner, Context, scope or fact ID. Google/email authentication choices remain in Clerk configuration.

The server-only binding registry maps a Clerk user to their own AM Context, that Context's own HTTPS host, and distinct reader/writer keys. All AM traffic is constrained to that binding's host, Context and expected route; redirects are rejected. There is no global AM endpoint. Public policy is a separate future boundary.

## Data and consent

AM stores committed employment information as a structured `employment_record` attribute on a server-bound person entity. The value is a versioned envelope containing the confirmed record, owner, operation, revision, previous fact ID and confirmation timestamp. This is the first fact type, not a separate local canonical profile. AM's computed `/profile` is not used as approved-only evidence.

SQLite is an operational journal: owner revision, latest receipt, pending proposal old/new values, operation status and notification receipts. It has no user-profile table. Finalized operations clear the old/new value columns; receipts retain IDs/hashes/provenance linkage. Logical clearing does not certify erasure from WAL files, backups or filesystem snapshots; retention/encryption/recovery remain deployment gates.

```mermaid
sequenceDiagram
    actor User
    participant UI as Employment form
    participant API as Clerk-verified API
    participant Journal as Operation journal
    participant AM as User's private AM Context
    User->>UI: Edit record
    UI->>API: Propose(record, base revision)
    API->>AM: Read exact current receipt, if present
    API->>Journal: Save pending old/new proposal
    API-->>UI: Exact proposal and revision
    User->>UI: Confirm displayed change
    UI->>API: Confirm(proposal ID, proposal revision)
    API->>Journal: Atomically claim current owner revision
    API->>AM: Structured triple write, stable operation key
    API->>AM: Read exact fact ID and verify digest/provenance
    alt Verified write
        API->>Journal: Receipt + revision + notification; clear values
        API-->>UI: Committed
    else Ambiguous response or local receipt failure
        API->>Journal: Uncertain; block new owner writes
        API-->>UI: Save unverified
        UI->>API: Check save status
        API->>AM: Read-only reconciliation; never resend
    end
```

The journal claim is transactional and has a unique partial index permitting only one applying/uncertain operation per owner. Successful AM writes and the local journal are **not atomic together**. A crash leaves a durable applying/uncertain operation. Read-only reconciliation can complete its receipt after restart. Absence is not proof a write never ran; an unresolved operation blocks newer saves and requires investigation. No unconditional automatic replay exists, including after AM's documented 24-hour receipt window.

Competing pending proposals are marked stale after one commits. Confirmation/rejection bodies accept only the exact proposal revision; editing a reviewed proposal means creating a new proposal. Notifications are owner-filtered and unique per committed operation or private assessment. A late write error rechecks durable state so an already reconciled commit is returned as committed.

Assessment records, results, caches and the notification centre are PRIVATE PER USER. Shared infrastructure does not mean shared outputs: every read/write/result/cache key binds to the authenticated owner and has cross-user negative tests. Only reviewed public policies may be shared. No shared assessment cache exists. Assessment deduplication includes owner, approved fact revision, exact policy digest and Toronto assessment date. Persisted results contain judgments/provenance, not a copy of personal facts. Reads reverify AM evidence and hide conclusions when the fact revision, rule, date or verification status is no longer current.

An adapter preflight failure that proves no POST was sent returns the proposal to pending with an explicit “not saved” response. Every error after possible transmission remains uncertain. Active recovery operations are listed before the result limit, so they cannot disappear behind newer proposals.

## Interpretation and assessment boundaries

The current entry point is an explicit form, with deterministic validation and exact review. There is no live classifier or chat ingestion. A future interpreter may suggest changes, but must call the same proposal policy; it cannot select owner IDs/Contexts or write AM directly. Unknown/no/not applicable remain distinct. Current jobs have no end date; elapsed completed years use the assessment date and are not qualifying experience.

When adding an interpreter, classification and storage failures must remain separate. The agreed classifier fallback is exactly: “We are facing technical difficulties, please update your information directly here” with a link to the relevant form only after storage health succeeds. Storage failure must explicitly avoid claiming saved status. Do not implement a fake successful classifier/storage fallback.

The narrow requirement-check interface consumes only receipt-approved facts plus manually reviewed official policy versions and returns met/not met/needs information with effective dates/source citations. Its runtime registry is empty until real source material is reviewed. FSW minimum requirements, FSW selection score and CRS remain separate future outputs. Conversation context may personalize explanations, never establish qualification. No government-account writes or invitation guarantee.

## Current limits

Single employment record; manually approved user bindings; local persistent journal; narrow criterion checks without any promoted policies; no background scheduler, discovery ingestion, deletion/export workflow, or delivery integration. No signup auto-provisioning or live validation yet. The app binds to loopback. Before hosting: persistent storage/backups, encryption and retention, actual Clerk CSP hosts, proxy configuration, lifecycle/deletion policy and service isolation must be validated. Tests establish local invariants, not production readiness.
