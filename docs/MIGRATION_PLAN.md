# Verified development journal migration

Status: authorized development migration and local preview cutover completed
2026-10-25. The WAL-aware backup, cancelled hosted rehearsal, committed copy and
fresh readback all passed. The retained source and backup are unchanged.
Local readiness reports `operationalStore: surrealdb`; the frontend returns 200.
The migration code is preserved for review; it is never executed by app startup.

## Read-only source inspection

Source is the original checkout's `.local/operations.sqlite`, including its WAL.
The source path resolves inside the named workspace's ignored `.local` directory.

| Table | Records |
| --- | ---: |
| heads | 1 |
| operations | 9 |
| notifications | 6 |
| assessments | 0 |
| assessment_notifications | 0 |
| chat_previews | 12 |
| chat_diagnostics | 5 |
| chat_clarifications | 3 |
| Total | 36 |

One approved owner; revision 6; six committed and three rejected operations.
The head receipt matches the latest committed operation exactly. Seven receipt
strings (head plus six commits) pass format checks. There are no pending personal
payloads and no active previews. Owner/link/column invariants pass.

These counts were rechecked after pausing the owned preview. The original source,
WAL-aware backup, in-transaction copy and fresh post-commit readback matched in
every source field and all seven receipt strings. A changed source stops the
operation instead of silently changing the reviewed plan.

## Reviewable implementation

- `migration-validation.ts`: exact columns, approved owners, unique IDs/revisions,
  source head/receipt agreement, private links and settled-payload checks.
- `migration-backup.ts`: SQLite's WAL-aware backup API, a fresh non-overwriting
  directory under `.local/migration-backups/`, source/backup fingerprint comparison
  and resolved path checks. It retains failed backups for inspection.
- `migration-executor.ts`: explicit rehearsal or commit mode; scope and schema
  version checks; empty-target requirement; parameterized CREATE operations;
  all records and a migration marker in one transaction; complete source-shaped
  readback before commit and another readback in a fresh transaction afterward.
- `migration-v1.surql`: one additive app-owned audit table and a schema marker,
  separate from the existing operational schema. No users, grants or credentials.
- Identical retries with the same marker and byte-identical target are read-only.
  A changed target, foreign owner, mismatching source or uncertain outcome stops.
- Receipts and stored JSON are copied as their original strings. No parsing
  defaults or re-encoding are applied before comparison. AM remains canonical.

The executor ran against hosted SurrealDB 3.3.2 with the existing database-scoped
development credentials. The full rehearsal was cancelled and a fresh transaction
verified no operational rows or migration marker remained. The subsequent commit
and independent readback both passed. The earlier six real-engine journal tests
remain separate evidence; AM was not called by this migration.

## Completed approval bundle

1. Briefly pause only the owned Maple localhost preview so journal writes stop.
2. Recheck source counts, owners, revision, receipt bytes and full fingerprint.
   Retain a verified SQLite backup including WAL state in a new ignored directory.
3. On the already configured **maple/development** destination, verify the target
   remains empty and apply only `operational-v1.surql` plus `migration-v1.surql`.
   This adds ten app-owned tables in total, two schema markers and the relevant
   fields/indexes; no existing tables/data are overwritten.
4. Rehearse the complete 36-record copy and verification inside a transaction,
   then CANCEL. Verify the operational tables and migration marker remain empty.
5. Copy in a fresh transaction, compare every source field (including all seven
   receipt strings), create the audit marker, commit, and verify from a fresh
   transaction. No AM request or approved-fact rewrite occurs.
6. Only after verified success, load the SurrealDB runtime composition and restart
   the same localhost preview. Check readiness and owner-bound readback before
   letting user edits resume. The runtime now requires SurrealDB; it checks the
   retained legacy source against the migration marker and has no SQLite fallback.

No test record deletion, account/security change, new credential, external
publication, production deployment or PR publication is part of this bundle.

The owned old preview was stopped at 01:10:18 UTC. Readiness and frontend success
were verified at 01:11:33 UTC (about 75 seconds of verified interruption).
The backup is retained under the original workspace's ignored
`.local/migration-backups/journal-3IFfEi/operations.sqlite`. Its separate ignored
migration review manifest records paths and source digest, without credentials.
Existing AM facts were not rewritten; current operational head remains revision 6.
Owner-bound SDK reads confirmed nine operations (six committed, three rejected),
six notifications and zero unresolved proposals. Typecheck, build and 531 local
tests passed; 19 HTTP tests needed an approved loopback-enabled rerun after the
sandbox denied their localhost sockets. Tracked-file hygiene checks also passed.
These checks do not claim a new user-originated browser save on the new backend.

## Recovery and limits

- Before commit: cancel the transaction; retain original journal and backup. The
  old app can resume against the untouched SQLite source if target inspection
  confirms no commit occurred.
- Lost commit response: report uncertainty and inspect marker plus full target
  snapshot read-only. Do not repeat the copy or declare rollback from an error.
- Successful commit but failed verification: keep the preview paused until a
  fresh readback resolves the discrepancy; never overwrite or clear the target.
- Keep the original journal and verified backup after cutover. Once new writes
  occur in SurrealDB, the old SQLite copy is stale: switching back is not a safe
  automatic rollback and requires reconciliation.
- The pause interrupts local requests. Keeping the UI open during it does not
  authorize replaying those requests. Existing pending/uncertain state is preserved.
- AM and the operational DB remain separate services; migration is not an atomic
  AM transaction and does not change their existing confirmation/reconciliation
  requirements. Full-access AM trial-key hardening remains a separate launch item.
