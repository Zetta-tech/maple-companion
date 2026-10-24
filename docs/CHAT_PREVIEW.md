# Chat correction contract checkpoint

Status: **native weekly-hours prototype enabled only in the explicit single-user
synthetic development trial; production chat remains disabled**. This is a narrow
correction flow, not a general conversational agent. The employment form and its
confirmed save path remain available.

## Initial hosted probe, 2026-10-24

Under the user's bounded synthetic-test authorization, one tagged fictional
statement was sent through the actual `@surrealdb/memory` 1.0.0-alpha.11 SDK to
`POST /api/v1/{boundContext}/facts`, with `infer: "preview"` and the existing
`maple/approved` scope. The server selected the Context and scope; candidate
entities from the model were never used to select an owner, operation or revision
or to write approved facts. There was no normal-ingest fallback or retry.

The response reported `mode: "preview"`, `preview: true`, a nonempty `sessionId`,
one candidate entity and one candidate attribute. Top-level turn/chunk IDs were
absent; the extraction's `turnId` and candidate record IDs were empty.

Before/after `/state?limit=100` reads had no truncation and identical row IDs and
digests: one current employment attribute and one person entity, with zero new
facts, relations, actions, instructions or uncertainties visible there. Independent
receipt-bound reads still verified the existing synthetic employment at revision 3,
34 hours per week; the local head was unchanged. Preview output was never put in
an approved receipt or the operation journal.

**A session did persist.** The returned session's turn listing returned HTTP 200,
zero turns and `hasMore: false`; a subsequent read again returned 200. A randomly
generated nonexistent session control returned 404. Thus the observed dry run did
not have zero persistent side effects, even though no turns or graph facts were
observed. The exact retained session ID is in the ignored local probe report and
the task checkpoint. No deletion was attempted.

The initial probe used **one model/extraction request and seven bounded GETs**.
Further probes were stopped until the explicit authorization described below.
No confirmed-fixture write, Context, credential, grant, upgrade or external model provider was used.
The API does not provide a general session inventory or a single-session read;
internal telemetry, response-cache retention and later provider activity were not
fully observable. Do not turn these observations into a zero-retention guarantee.

## Development-only continuation

The user authorized tolerating empty preview-session metadata in this existing
synthetic trial. This does not establish a retention policy for real production
data. Two additional real AM previews were run, each with the literal correction
`I now work 36 hours per week.` wrapped in a synthetic-development label.

1. The first returned `working_hours: "36 hours per week"` in category `context`.
   The initial field allowlist held it for clarification. Its actual response
   informed a tested addition that requires explicit weekly units for that key.
2. The second returned `employment_record: "works 36 hours per week"` in category
   `identity`. It normalized to 36 and created a **pending** proposal from the
   approved 34 hours, retaining the original wording for review. No confirmation
   or approved-fact write was made.

Both sessions returned zero turns, with no additional page. Before/after graph
snapshots were untruncated and unchanged; approved receipt reads and the local head
still showed revision 3 at 34 hours with three saved notifications. Candidate
entity names/categories varied; model identity and category never route a write
or establish approval. No further probes were performed.

Total: **three extraction/preview requests** across all checkpoints, three observed
empty sessions, no new confirmed employment record. The two continuation probes
used seven and eight bounded GETs respectively. The response did not report price
or token usage; actual cost is unknown. Test-only reports remain ignored locally.
The first observed session was imported into owner-bound operational bookkeeping
without making a new provider call or retaining its original input there.

## Runtime boundaries

- `am-preview.ts` forces the actual SDK to send exactly one preview request to the
  server-bound Context/host, with a bounded response, no redirects and no retries.
  Returned sessions are recorded as owner-bound operational metadata. Nonempty
  turn/chunk/candidate-record IDs or a non-preview response stop further chat
  attempts for that owner. Unknown transport outcomes also stop further attempts;
  startup recovery does not replay them. No automatic AM deletion occurs.
- `ChatProposals` takes a pluggable interpreter, rechecks approved AM evidence and
  revision, and permits only a single explicit weekly-hours correction. The
  interpreter can suggest a value, never an owner, scope, revision or approval.
  Negation, hypotheticals, conflicting numbers, other fields and unsupported
  phrasing ask for clarification without invoking it. This deliberately limited
  language gate is documented, not presented as general language understanding.
- The deterministic gate and interpreter must agree. Only `hoursPerWeek` changes;
  all other fields come from the current receipt-verified employment record. The
  existing workflow creates an exact pending proposal. Only the existing separate
  confirmation route can commit it. Pending wording is local operational metadata,
  never authoritative AM evidence. Semantic uncertainties, corrections, extra
  candidates or unsupported output ask for clarification. Normalization itself
  does not understand meaning; it validates the native model's narrow candidate.
- Interpreter failure gets the specified form fallback only after a fresh healthy
  storage read. Storage failure explicitly reports that no change was saved.
- `/api/chat/proposals` remains behind Clerk, origin checks, owner rate limiting
  and binding enforcement. Only `single-user-development` composition constructs
  the real interpreter. Normal/restricted composition returns `CHAT_NOT_AVAILABLE`
  and hides the control, even if an interpreter is accidentally supplied to the
  app factory. The configuration loader already requires development, loopback,
  Clerk test keys and exactly one owner/Context for this mode.
- Both an explicit `syntheticTest: true` acknowledgement and an existing employer
  beginning `SYNTHETIC TEST ONLY - ` are required in the runtime trial. The UI labels
  fictional data and exposes `Prepare proposal` separately from `Confirm and save`.
  Test doubles exist only in tests, never as runtime fallbacks.

## Local metadata retention and trial bounds

`chat_previews` stores owner, request ID, base revision, timestamps, provider
host/Context/session ID, status and linked proposal ID. The original utterance is
limited to 500 characters. It is cleared immediately for held/failed interpretations
or settled proposals. Pending proposals expire after 24 hours; expiry makes them
unconfirmable and clears pending wording/values. Already applying or uncertain
saves retain the operational values needed for reconciliation, as before.

Expiry runs on authenticated workspace access, workflow reads, startup and a
one-minute in-process sweep. While the app is stopped, disk cleanup waits until
restart. Logical SQL redaction is not a guarantee of forensic erasure from WAL,
backups or provider infrastructure. No metadata row or AM session is automatically
deleted. Returned session identifiers remain available for a separately approved
cleanup review; no response bodies or credentials are stored in this table.

The prototype allows one in-flight interpretation per owner, no new interpretation
while a change awaits review, five attempts per UTC day and fifty total metadata
records per owner. Held/failed attempts count. Reaching a limit stops chat and
leaves the form available. These are explicit trial bounds, not a scaling design.

## Remaining production decisions

Production still needs a reviewed provider retention/cleanup policy, broader
semantic-quality evaluation, least-privilege credentials and hosted multi-user
isolation/security validation. The documented exact-session DELETE removes its
transcript/passages, not extracted graph facts, and requires `memory:forget`; it
has not been exercised. No session TTL was established. Trace-retention controls
are separate and the current Context settings have not been inspected or changed.

JEV remains an open comparison, not an automatic replacement. Any alternative
provider requires separately approved configuration. Do not enable production
chat merely because the tests pass or treat ordinary full extraction as a fallback.

## Primary references checked

- [AM REST API](https://surrealdb.com/docs/agent-memory/reference/rest-api): preview
  mode, Context-host paths, session turn listing and lack of a session read route.
- [Storing memories](https://surrealdb.com/docs/agent-memory/ingest/experiential/remember):
  ingest modes and the ordinary extraction path.
- [Extraction pipeline](https://surrealdb.com/docs/agent-memory/reasoning/extraction-pipeline):
  ordinary extraction and retained conversational input; not a promise of preview retention.
- Installed SDK `dist/memory.mjs` and `dist/memory.d.ts`: exact request construction,
  retries, `FactsResponseJson`, `ExtractionResultJson`, session and state surfaces.
- [Session lifecycle](https://surrealdb.com/docs/agent-memory/sessions/creating-sessions):
  exact-session deletion and its limits.
- [Configuration](https://surrealdb.com/docs/agent-memory/reference/configuration):
  separate trace-retention settings.
