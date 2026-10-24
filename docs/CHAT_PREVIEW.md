# Chat correction contract checkpoint

Status: **live chat disabled; provider side effect requires a decision**.
This is preparation for weekly-hours proposals, not a working conversational agent.
The employment form and its confirmed save path remain available.

## Hosted probe, 2026-10-24

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

The probe used **one model/extraction request and seven bounded GETs**. Further
preview probes were stopped (one of the maximum three used). No further fixture
write, Context, credential, grant, upgrade or external model provider was used.
The API does not provide a general session inventory or a single-session read;
internal telemetry, response-cache retention and later provider activity were not
fully observable. Do not turn these observations into a zero-retention guarantee.

## Prepared code and boundaries

- `am-preview.ts` forces the actual SDK to send exactly one preview request to the
  server-bound Context/host, with a bounded response, no redirects and no retries.
  Its now-stricter response validation rejects a nonempty session ID, turn/chunk
  identifiers and corrections. That rejection cannot undo a server side effect;
  therefore **the adapter is not instantiated by runtime**.
- `ChatProposals` takes a pluggable interpreter, rechecks approved AM evidence and
  revision, and permits only a single explicit weekly-hours correction. The
  interpreter can suggest a value, never an owner, scope, revision or approval.
  Negation, hypotheticals, conflicting numbers, other fields and unsupported
  phrasing ask for clarification without invoking it. This deliberately limited
  language gate is documented, not presented as general language understanding.
- The deterministic gate and interpreter must agree. Only `hoursPerWeek` changes;
  all other fields come from the current receipt-verified employment record. The
  existing workflow creates an exact pending proposal. Only the existing separate
  confirmation route can commit it. No raw chat is stored by this coordinator.
- Interpreter failure gets the specified form fallback only after a fresh healthy
  storage read. Storage failure explicitly reports that no change was saved.
- `/api/chat/proposals` remains behind Clerk, origin checks, owner rate limiting
  and binding enforcement. With the actual `index.ts` composition it always
  returns `CHAT_NOT_AVAILABLE`. The UI has no enabled chat control. Test doubles
  exist only in tests; they are not runtime fallback behavior.

## Decision before completing the live path

Choose whether an AM preview session with no observed transcript/facts is acceptable
as separately governed conversation metadata, including its retention/cleanup
policy, or whether extraction must use a genuinely separate non-persisting surface.
The current observations do not establish the latter for hosted AM. Any alternative
provider needs its own approved configuration; JEV remains an open comparison, not
an automatic replacement. No such configuration is included here.

If the session side effect is accepted, a subsequent reviewed change must explicitly
handle that contract, connect a native interpreter to the proposal service, validate
its output using the remaining bounded probes, and add the actual UI review flow.
Do not remove the disabled gate merely because the unit tests pass. Do not feed
normal full extraction into approved memory before user confirmation.

## Primary references checked

- [AM REST API](https://surrealdb.com/docs/agent-memory/reference/rest-api): preview
  mode, Context-host paths, session turn listing and lack of a session read route.
- [Storing memories](https://surrealdb.com/docs/agent-memory/ingest/experiential/remember):
  ingest modes and the ordinary extraction path.
- [Extraction pipeline](https://surrealdb.com/docs/agent-memory/reasoning/extraction-pipeline):
  ordinary extraction and retained conversational input; not a promise of preview retention.
- Installed SDK `dist/memory.mjs` and `dist/memory.d.ts`: exact request construction,
  retries, `FactsResponseJson`, `ExtractionResultJson`, session and state surfaces.
