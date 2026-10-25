# Retired hours-chat experiment

The live implementation uses native AM conversation/profile and the isolated Guide
workflow. It does not route messages through the old weekly-hours interpreter.

Removed: `HoursChat`, the six-label/alias mapper, hours-only proposal coordinator,
preview transport, extraction diagnostics builder, clarification composer and their
orphaned CSS. `/api/chat/status`, `/api/chat/proposals` and
`/api/chat/clarifications/:id` now return authenticated API 404s. They cannot trigger
a provider request. Their constructor option and journal request-creation methods
are gone. No package was exclusively used by this path; the current AM integration
still requires `@surrealdb/memory`.

Retained deliberately:

- Journal schemas and migration readers preserve existing operations, receipts,
  preview metadata, diagnostics and clarification rows. No table/row is dropped.
- `hours-evidence.ts` only identifies quantity-linked weekly units for **stored**
  proposal provenance. It never interprets new chat. `HoursReviewNote` displays
  those historical records accurately, including user-entered clarification.
- Existing proposal ownership, atomic expiry, settlement and content-redaction
  rules remain. A proposal imported from an old version cannot bypass its deadline
  by waiting on an asynchronous memory read. Direct form proposals are unaffected.
- SQLite is retained for read-only migration/backup tooling and offline tests; the
  active operational store is SurrealDB. There is no SQLite runtime fallback.
- `CHAT_PREVIEW.md` records the abandoned trial and provider observations as history.

Tests exercise API removal, no memory access through retired endpoints, stored-record
reload/provenance, cross-owner denial, expiry across a deferred read, explicit discard,
one-write replay and receipt-byte-compatible migration. The obsolete interpreter
tests are deleted rather than reported as coverage of native AM. The real-engine
journal test imports a historical storage fixture directly; no interpreter remains
in that integration test. Hosted tests are separate from the default offline suite.

The verified localhost process remains on its frozen `3a412d4` build while this
cleanup is tested and reviewed. Source/PR head advances independently. No server
restart, memory request, database migration or data cleanup accompanies this change.
