# Operational SurrealDB development cutover

Status: async adapter and caller changes are running in the local preview against
`maple/development`. Six real-engine integration tests passed in the separate test
database. The authorized migration preserved 36 operational records and all seven
receipt strings. The original SQLite journal and verified backup remain intact.
AM facts were not changed. Source changes remain local and unpublished.
The CEC slice is paused at the storage boundary; no new SQLite-specific feature was added.

## Storage inventory

| Data | Current location | Target |
| --- | --- | --- |
| Confirmed personal employment facts | Receipt-verified per-user AM Context | Same AM Context; do not duplicate a canonical profile |
| Owner head/revision and AM receipt | SurrealDB `maple_heads` | Private operational SurrealDB |
| Pending, applying, uncertain and settled proposals | SurrealDB `maple_operations` | Private operational SurrealDB |
| Saved-change notifications | SurrealDB `maple_notifications` | Private operational SurrealDB |
| Private assessments and their notifications | SurrealDB `maple_assessments`, `maple_assessment_notifications` | Private operational SurrealDB |
| Preview operation/retention metadata | SurrealDB `maple_chat_previews` | Private operational SurrealDB |
| PR7 diagnostics and clarification candidates/answers | SurrealDB `maple_chat_diagnostics`, `maple_chat_clarifications` | Existing retention and confirmation rules preserved |
| Reviewed public policies | Operator-selected JSON file + approved digest allowlist | Keep review gate; shared policy storage can move separately |

Canonical facts remain in AM. Pending proposal bodies are temporary operational
metadata, cleared on settlement/expiry, not another profile. Shared infrastructure
does not make private results, caches or notifications public.

## User-provisioned connection

Use a **general database instance**, not the Agent Memory Context endpoint.
The agreed namespace is `maple`; create databases `development` and `test`.
Production will use `production` with separate credentials and an explicit later
cutover. One development instance may host the two databases; no paid upgrade or
new production deployment has been approved.

Actual configuration names implemented in `server/operational-db.ts`:

| Purpose | Server-only environment variables |
| --- | --- |
| Development | `MAPLE_DB_ENDPOINT`, `MAPLE_DB_NAMESPACE`, `MAPLE_DB_DATABASE`, `MAPLE_DB_USERNAME`, `MAPLE_DB_PASSWORD` |
| Integration tests | `MAPLE_TEST_DB_ENDPOINT`, `MAPLE_TEST_DB_NAMESPACE`, `MAPLE_TEST_DB_DATABASE`, `MAPLE_TEST_DB_USERNAME`, `MAPLE_TEST_DB_PASSWORD` |

The namespace/database values are `maple/development` and `maple/test`.
Use the supplied **WSS /rpc URL** for the journal adapter's interactive transactions.
The generic connector/probe also supports HTTP, but the journal has no HTTP fallback.
Test target names are checked
before connecting; tests never borrow development configuration. Separate
database-level users are recommended. A database-level EDITOR can access every
table in that database and bypass table-level permissions: it is **not** tenant
isolation. Backend ownership checks remain necessary for every read and mutation.
Account/user creation and credential configuration require approval; this change
does not perform them. Keep passwords in ignored local environment files, never chat.
The existing `.env` and AM variables have not been read out, copied or modified.

Keep user-entered configuration in the original checkout:
`C:/Users/aakas/Downloads/Codex/Build North Maple Companion/maple-companion/.env`
for development, and `.env.test` beside it for integration credentials.
Do not overwrite either file with the example. While code is isolated, commands
must explicitly point Node's `--env-file` option at those files; do not duplicate
credentials into a temporary worktree. Both database-scoped logins and the actual
SurrealDB 3.3.2 version have been verified using read-only queries. The test
credential was also denied access to development.

In Studio, open the instance's query view and use the namespace/database
selectors to create `maple`, then `development` and `test` under it.
After selecting the correct scope, the owner can manually create separate
database users using DEFINE USER ON DATABASE with the EDITOR role. This code
does not execute credential creation or change any existing users.

## Implemented locally

- `server/journal-store.ts` and all workflow/HTTP/chat/assessment callers now await
  storage operations. Preview session callbacks await bookkeeping too.
- `server/surreal-journal.ts` uses real parameterized SDK operations and explicit
  WebSocket transactions. Every mutation writes a common per-owner guard record;
  competing transactions must conflict before both can commit. No automatic retry.
- Claim checks owner, status, revision and expiry using database time at the claim
  statement. Completion and assessment notifications are deduplicated transactionally.
- A DB failure after AM success keeps the claim blocked/uncertain. It cannot become
  an unsent-save claim. Assessment saves crossing Toronto midnight return stale.
- `database/operational-v1.surql` prepares explicit schema setup without credentials,
  grants, deletion or AM operations. Startup never applies it; adapter opening
  requires its version marker.
- `server/legacy-migration.ts` reads a consistent read-only snapshot and prepares
  a deterministic manifest/record mapping. It preserves receipt JSON bytes, revision,
  pending state and notification identity. The authorized source copy was sent only
  to the configured development database, not the test database or source control.

Runtime constructs the real SurrealDB adapter, checks its schema marker and verifies
the retained legacy source against its migration marker. It never opens SQLite as
a fallback. SQLite is retained only for backup/source verification and legacy tests.

## Acceptance and cutover evidence

1. Completed: user confirmed setup; both database logins, scope and actual engine
   version verified. No credential values were reported or changed.
2. Completed in test only: nine app tables, 58 fields, 11 indexes and one version
   marker. No schema changes are made by opening the adapter or starting the app.
3. Completed: five journal tests passed with real independent connections, covering
   competing claims, ownership, expiry, replay, notification deduplication and
   uncertain recovery. The separate rollback probe passed after quoting its
   reserved `value` column in SELECT; its first committed fixture was retained.
4. Completed after explicit authorization: verified WAL-aware backup; initially
   empty development target; ten additive tables and two schema markers; cancelled
   36-record rehearsal; atomic copy plus migration marker; fresh complete readback.
   All source fields and receipt strings matched. No cleanup or deletion occurred.
5. Real-engine ownership/replay/staleness/uncertain-outcome tests passed on the
   isolated test database. Offline validation tests remain separate evidence and
   do not substitute for those actual adapter tests.
6. Local cutover completed after verification. Readiness identifies SurrealDB,
   authentication configuration is loaded and frontend status is 200. No browser
   user save or AM write was performed as part of cutover.

AM writes and operational transactions span two services: neither database COMMIT
nor CANCEL makes them atomic together. Keep pending operations, receipts and
reconciliation for an uncertain AM or database commit.

## Transaction testing

`npm run test:db` is a separate real-engine command. Missing test configuration
fails, rather than silently skipping or using SQLite. It includes transaction probes
and the actual journal adapter, two connections, claims/replay/expiry, assessment
privacy/staleness and deduplicated notifications. AM alone is a labelled test double.
It leaves clearly synthetic records per run, identified by the run UUID;
there is no automatic DELETE, DROP, or database reset.

A single HTTP request can send a complete BEGIN/COMMIT or BEGIN/CANCEL batch.
Separate HTTP requests do not share that transaction. A CANCEL on a test connection
cannot roll back application writes made through another connection. It also
cannot undo an AM request or an external notification. Conditional rollback uses
THROW; CANCEL inside an IF/block is not a transaction guard. EXPLAIN is not a
preview-of-changes contract; EXPLAIN FULL executes.
Interactive transactions in the journal adapter require WebSockets.

## Verified documentation

- [Official JavaScript SDK](https://surrealdb.com/docs/reference/javascript) - pinned `surrealdb@2.1.1`; verified deployed engine 3.3.2.
- [Connection/authentication options](https://surrealdb.com/docs/reference/javascript/concepts/connecting-to-surrealdb).
- [Database users and built-in roles](https://surrealdb.com/docs/reference/query-language/statements/define/user).
- [Transactions and conditional rollback](https://surrealdb.com/docs/reference/query-language/language-primitives/transactions).
- [RPC transport boundaries](https://surrealdb.com/docs/reference/rest-api/rpc-protocol).

## Latest authorized test evidence

Six real-engine tests passed across the initial five journal passes and the
targeted rollback-probe rerun. An additional 18 offline config/async/migration
contract tests and typecheck passed. No live AM service was used; AM is a labelled
test double in the journal tests, while all operational storage uses real SurrealDB.

Before migration, read-only inspection verified development had **zero tables**.
Test retains 5 heads, 8 operations, 4 saved notifications, 1 assessment,
1 assessment notification, 1 preview, 1 clarification, 0 diagnostics, 2 transaction
probes and 1 schema marker: **23 synthetic records plus the marker**. Operation
states are 4 committed, 2 stale, 1 applying and 1 pending; the latter two are
intentional concurrency fixtures, unrelated to the live user's journal.

Nothing was deleted. Development migration and preview cutover are complete;
publication remains pending. The original journal and verified backup are retained.
See `MIGRATION_PLAN.md` for the source counts, completed verification and recovery
boundaries. A new user-originated browser save against this storage backend has
not yet been exercised. Policy review/activation and the CEC slice remain next work.
