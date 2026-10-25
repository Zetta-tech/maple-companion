# Isolated Guide setup

The Guide uses native AM `/chat`, which persists the exchange and extracted
memory. Its Context and key must be separate from ordinary remembered information.
This is still one authorized Clerk user; it is not Phase II multi-user isolation.

## User-performed console steps

1. Review and select the Agent Memory Lite organization package. The public page
   lists $30/month; the authenticated catalog lists two Contexts, 20 GB and one
   million monthly tokens. Confirm currency, tax, credits and any overage terms in
   checkout. The application does not enforce a provider billing cap.
2. Keep the existing Context. Create a second Context named `maple-guide-demo` in
   AWS US West (Oregon), `aws-usw2`, once the new entitlement is active.
3. Create its dedicated server key in the console. Do not send the key in chat.
   A full-access key remains a development-only exception; its variable name does
   not restrict permissions. Do not reuse the ordinary Context's key.
4. Enter that new key in both `AM_DEMO_READ_KEY` and `AM_DEMO_WRITE_KEY` in the
   **original checkout's ignored `.env`**:
   `C:/Users/aakas/Downloads/Codex/Build North Maple Companion/maple-companion/.env`.
   Preserve all existing values. Never use a `VITE_` prefix for these secrets.

The new Context ID and HTTPS endpoint are nonsecret setup identifiers. Its actual
principal is obtained by an authorized read-only `/me` check, not guessed. Scope
registration and writing the active binding require the applicable setup approval.

## Server-only binding

Set `MAPLE_DEMO_AM_BINDINGS_FILE=.local/am-demo-bindings.json` in the original
checkout's `.env`. The referenced ignored file contains **identifiers and key
variable names only**, using the existing authorized Clerk owner:

```json
[
  {
    "ownerId": "<existing authorized Clerk user ID>",
    "endpoint": "<new Context HTTPS origin, without /api or /rpc>",
    "context": "<new Context ID>",
    "readKeyEnv": "AM_DEMO_READ_KEY",
    "writeKeyEnv": "AM_DEMO_WRITE_KEY",
    "nativePrincipalId": "<principal ID verified by /me, without principal: prefix>",
    "nativeScope": "maple/conversation"
  }
]
```

Register `maple/approved` and `maple/conversation` in this **new** Context before
the first save/chat. No existing Context scope or grant needs changing. These
scope names organize the demo; the separate Context/key supplies the boundary.

The local launcher sets `MAPLE_GUIDE_SOURCES_FILE` to the reviewed
`policy-sources/guide-2026-10-25.json` in the active worktree. No environment toggle
enables Guide in production. Missing setup disables Guide without switching to
ordinary memory. Reusing its Context, key or a foreign Clerk owner is rejected.

## Bounded activation verification

1. Verify the new target and principal, registered scopes, and ordinary-context
   before-state read-only. Do not print keys, tokens or headers.
2. Build and restart only the owned local preview. Keep ordinary bindings and
   profile data intact. Sign-in is through the user's existing Clerk session.
3. Review and explicitly confirm one fictional demo profile. The server writes
   its exact `demo_profile` triple, then verifies its receipt in the new Context.
4. Run one ordinary C20 question. Fetch the reviewed official sources, execute
   native `/chat` once, retain its complete response privately and check the
   response contract before displaying the generated explanation.
5. Reload and inspect the same saved journey. Verify AM profile receipt and native
   session separately from Surreal journey persistence. Do not regenerate for a
   reload. Record any provider usage returned; no automatic retries.
6. Process the real EE announcement against the same confirmed fictional profile
   and date. This is a disclosed replay, and November 3 is future policy. A complete
   points estimate requires all reviewed CRS evidence; otherwise show a hold or
   the explicitly scoped component result.
7. Recheck ordinary memory and operational records. No cleanup/deletion is part
   of this sequence.

Sources: [AM pricing](https://surrealdb.com/agent-memory),
[chat persistence](https://surrealdb.com/docs/agent-memory/sessions/chat-sessions),
[structured triple semantics](https://surrealdb.com/docs/agent-memory/ingest/authoritative/bulk-import).
`reflect(persist:false)` was examined as a no-write alternative but is not the
selected implementation. It creates no native chat history and reads the key's
whole read region, so it is not a replacement for an isolated native chat demo.
