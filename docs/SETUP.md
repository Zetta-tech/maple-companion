# Minimal local setup — corrected hosted AM routing

The earlier single `AM_ENDPOINT` instruction was incorrect for hosted AM and has
been removed from runtime configuration. Each user binding now owns its Context's
HTTPS endpoint, Context ID, reader key reference and writer key reference. Missing
host, duplicate host, insecure URL and cross-user receipt mismatch fail closed.

## Clerk

Use a development Clerk instance first. Enable Google and email; email one-time
code is recommended but remains a choice for the user. The React/Vite app uses
Clerk `<SignIn routing="hash">` at `/`, with Express authentication on `/api`.
There is no hand-built OAuth callback route. Use the redirect URI shown by Clerk
when configuring Google; don't invent `/callback`.

For the built local app use `APP_ORIGIN=http://localhost:3000`. For Vite hot reload,
use `http://localhost:5173` instead; it proxies `/api` to Express port 3000. Clerk's
publishable and secret keys must belong to the same instance/environment. A later
production instance needs its approved HTTPS app domain, Google settings and live
validation before deployment. [Clerk Express reference](https://clerk.com/docs/reference/express/clerk-middleware)

## Hosted Agent Memory

The user's current Create Context screen shows **Agent Memory Free, 0 of 1
Context used**. Start with one private Context and one verified Clerk test user,
using fictional employment data only. This is a single-user integration trial,
not a completed hosted isolation test. No plan upgrade is authorized. A second
user must stay unprovisioned until a second private Context is available; do not
put users into different scopes of the same Context. The public-policy Context
is not required or wired in this slice. See the [live validation plan](LIVE_VALIDATION.md).

1. In SurrealDB Studio, use Agent Memory / Contexts for the first private pilot
   Context. Context names are labels, not IDs.
   Record each Context's **own host**, Context ID and region. Use the endpoint from
   that Context's settings/API keys view, never `api.surrealdb.com` as the data host.
   [Hosted quickstart](https://surrealdb.com/docs/agent-memory/quickstarts/hosted)
2. Register `maple/approved` inside each Context before the application writes.
   Registration requires `scope:create` and belongs to setup, not the app's writer.
3. Have a Cloud owner/admin configure two principals (or equivalently constrained
   principal-bound keys after verification): approved reader with
   `memory:read=maple/approved`; approved writer with
   `memory:write=maple/approved`. These exact-node grants match the app's single
   approved scope. Do not grant root/wildcard access or `grant:manage` to runtime
   credentials. Creating two keys with different labels alone does not narrow
   their access. [AM scopes and grants](https://surrealdb.com/docs/agent-memory/mental-model/contexts-and-scope#permissions-and-delegation)
4. Hosted Cloud documentation explicitly supports admin proxies for principals,
   scopes and grants, and principal-bound Context API keys. This is documented AM
   behavior, not assumed generic SurrealDB login behavior. However, the exact
   console controls/control-plane payload for this user's deployment have **not**
   been exercised. Do not infer successful restriction from the key name or UI
   label. If the UI exposes only broad keys, stop before installing them as the
   application's approved reader/writer. [Cloud roles and interfaces](https://surrealdb.com/docs/agent-memory/quickstarts/surrealdb-cloud)
5. After approved configuration, inspect each key's `GET /api/v1/{context}/me`
   result and run read/write/cross-user denial tests. Never print key values. Key
   grants cannot exceed the principal's; self-service key minting may be disabled
   by Context policy. No generic database root username/password belongs here.
   [AM key policy](https://surrealdb.com/docs/agent-memory/reference/configuration#key-policy)

The current SDK's flat grant constants conflict with current AM documentation:
use documented `memory:read` / `memory:write`, not `read` / `write` / `manage`.
Provisioning is deliberately not implemented using those constants.
[Current AM agent guide](https://surrealdb.com/docs/agent-memory/reference/agents#scope-and-grants),
[SDK domain constants](https://raw.githubusercontent.com/surrealdb/surrealdb.js/main/packages/memory/src/types/domain.ts)

## Local files

Create `.env` in the repository root only through an approved local secure flow.
It is ignored by Git. Replace blank values locally; do not paste secrets into chat.

```dotenv
APP_ORIGIN=http://localhost:3000
PORT=3000
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_KEY=
MAPLE_AM_BINDINGS_FILE=.local/am-bindings.json
MAPLE_JOURNAL_PATH=.local/operations.sqlite
AM_USER_001_READ_KEY=
AM_USER_001_WRITE_KEY=
```

`CLERK_JWT_KEY` is optional. Use the Clerk public verification key if selecting
networkless JWT verification. No `VITE_*`, `NEXT_PUBLIC_*` or global `AM_ENDPOINT`
variable is needed.

Create the ignored `.local/am-bindings.json`, substituting the first user's
actual Clerk ID and that user's actual Context host and ID:

```json
[
  {
    "ownerId": "user_REPLACE_A",
    "endpoint": "https://REPLACE_WITH_CONTEXT_A_HOST",
    "context": "REPLACE_WITH_CONTEXT_A_ID",
    "readKeyEnv": "AM_USER_001_READ_KEY",
    "writeKeyEnv": "AM_USER_001_WRITE_KEY"
  }
]
```

All example strings above are placeholders. Binding records contain environment
variable **names**, never key values. Missing users are denied; no automatic
fallback Context exists.

The example `.env.example` also lists optional `AM_USER_002_READ_KEY` and
`AM_USER_002_WRITE_KEY`. Leave them blank and omit the second binding while only
one Context is available. Later, an independently provisioned second Context
requires its own host, Context ID, principals and key references.

| Field | Classification |
| --- | --- |
| `CLERK_PUBLISHABLE_KEY` | Public browser configuration |
| `CLERK_JWT_KEY` | Public verification material; optional |
| `CLERK_SECRET_KEY`, all `AM_*_KEY` values | Secrets; server only |
| AM `endpoint`, `context`, environment-variable names | Non-secret infrastructure identifiers; keep in server configuration |
| Clerk `ownerId` binding | Private account mapping, not a credential; server only |
| Origin, port, local paths | Non-secret configuration |

Shared reviewed-policy Context preparation is **not wired** into this slice. No
policy Context ID, host, key or scope is consumed. Do not put it into the private
user registry. Personal facts, assessments and notifications remain private per
user; only reviewed public policies will later be shared.

Users may perform console setup themselves. Agent creation of Contexts/keys,
grants, OAuth/security changes and installation of real credentials needs separate
action-time approval. No provisioning/configuration action has been attempted.
