# Agent Memory boundary — first slice

Status: SDK wiring and transport-level tests only. No hosted Context, credential,
grant, or live security claim is implied. Checked against the installed
`@surrealdb/memory@1.0.0-alpha.11` on 2026-10-24.

The server binds each authenticated owner to a separate private AM Context, that
Context's own HTTPS endpoint, and separate read/write credentials. Hosted AM has
one host per Context; the previous global `AM_ENDPOINT` setting was removed.
This adapter does not provision accounts,
Contexts, keys, principals, or grants. Those actions need explicit approval.
Credentials, Context selection, and approved scope are never model or HTTP input.

## Confirmed employment

An exact confirmed employment envelope is serialized into one native AM attribute
(`person/maple-<sha256-owner>`, `employment_record`) through `infer: triples` in
`maple/approved`. This is a deliberately small native structured fact; it is not a
separate application profile. The application retains an operation receipt with
fact ID and digest, plus workflow revision/ownership metadata. It reads the value
from AM. The envelope links to the prior fact ID; AM's returned supersession link
must agree before the value is accepted.

Reads page `/attributes` with exact entity/key filters. They validate the receipt
ID, digest, envelope owner, schema, approved scope, `source.kind=upsert`, identity
category, current validity, and supersession chain. Multiple live values, malformed
pages, missing/changed evidence, cursor loops, or a walk over 20 pages fail closed.
No profile, semantic search, top-k result, generated summary, or conversational
fact can substitute for receipt-approved evidence. A derived contender for the
same key blocks the read for reconciliation rather than silently choosing one.

## Write outcomes and replay

The SDK's automatic idempotency key uses a 30-second bucket. The adapter replaces
that header at its supported `fetchImpl` boundary with a stable digest of host, Context,
owner, and operation ID. A different body for the same operation must retain the
same key so the server can reject it. Retries are disabled. Redirects are refused.
Successful writes require a valid one-attribute extraction response and exact
readback before returning a receipt. Failure after attempting a write is always
reported as `write_uncertain`, with upstream diagnostics removed.

`reconcile` performs only structural reads. It returns a receipt only when the
exact operation envelope/digest is present. Returning `null` does **not** prove
that the write never ran and must never trigger an automatic resend. AM documents
server response receipts for 24 hours; this is not permanent idempotency. The
adapter has no CAS primitive or distributed transaction with the workflow journal.
The service must serialize an owner's commits and preserve uncertain operations.

## Consent blockers before conversational memory

AM supports literal storage with `infer: none`, but `chunkId` has no generic
`chunks.get` interface. Its `sessionId`/`turnId` can be recovered through the
paginated session transcript. This implementation uses native structured attributes
instead. Default extraction writes immediately; it must not receive unapproved
consequential chat. `/profile` covers the key's full read region and is not an
approved-only evidence endpoint. `llm_extraction_enabled` is documented as having
no effect. Background consolidation behavior remains a live validation blocker.
Keep chat ingestion disabled for this slice.

Before live use, prove correct Context/key grants; denial across two users;
conversation-key denial on approved writes; exact round trips; returned entity/ID
normalization and supersession fields; malicious/derived fact rejection; timeouts
after commit; read-only reconciliation; and replay beyond the receipt lifetime.
These tests must use approved isolated Contexts and approved connectivity. Also
verify the hosting service's background passes cannot turn raw context into
receipt-approved evidence. No automatic provisioning endpoint is assumed.

## Primary sources

- [Hosted quickstart](https://surrealdb.com/docs/agent-memory/quickstarts/hosted):
  each Context has its own host; register scoped paths before use.
- [Cloud roles and planes](https://surrealdb.com/docs/agent-memory/quickstarts/surrealdb-cloud)
  and [key policy](https://surrealdb.com/docs/agent-memory/reference/configuration#key-policy):
  hosted admins manage principals/scopes/grants via admin proxies, and every key
  is principal-bound. This is AM authorization, not generic database-user RBAC.
- [Agent guide](https://surrealdb.com/docs/agent-memory/reference/agents#scope-and-grants):
  use `memory:read`, `memory:write`, `grant:manage` and the other explicit verbs.
  Do not use the SDK's stale flat `Verb.read`/`Verb.write`/`Verb.manage` constants
  for provisioning. Hosted grant setup remains unrun and must be checked with `/me`
  and negative tests before use. See [setup details](SETUP.md).

- [REST contract](https://surrealdb.com/docs/agent-memory/reference/rest-api):
  `/facts`, `/attributes`, scope wire shape, 24-hour idempotency, and grant routes.
- [SDK client](https://raw.githubusercontent.com/surrealdb/surrealdb.js/main/packages/memory/src/client.ts)
  and [types](https://raw.githubusercontent.com/surrealdb/surrealdb.js/main/packages/memory/src/types/generated.ts):
  `remember`, typed triples, extraction IDs, structural detail fields.
- [Idempotency implementation](https://raw.githubusercontent.com/surrealdb/surrealdb.js/main/packages/memory/src/idempotency.ts):
  SDK time-bucket behavior.
- [Contexts and scope](https://surrealdb.com/docs/agent-memory/mental-model/contexts-and-scope),
  [profiles](https://surrealdb.com/docs/agent-memory/operations/profiles),
  [reconciliation](https://surrealdb.com/docs/agent-memory/reasoning/reconciliation-and-supersession),
  [configuration](https://surrealdb.com/docs/agent-memory/reference/configuration),
  and [Cloud setup](https://surrealdb.com/docs/agent-memory/quickstarts/surrealdb-cloud).
