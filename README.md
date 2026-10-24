# maple-companion
Your personal Immigration Companion

The first implementation is a private employment-update slice: real Clerk authentication, an exact review/confirm workflow, and a real SurrealDB Agent Memory adapter. It is **not production-ready**. Hosted credentials, isolation/grant verification, and live integration tests are pending approval. There is no demo mode or fake-data fallback.

## Local checks

Requires Node 24 and npm.

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Open `http://localhost:3000` after `npm run build`. Without approved configuration the page reports sign-in unavailable and API calls fail closed. For frontend hot reload, run `npm run dev:web` separately and configure the approved `APP_ORIGIN` as `http://localhost:5173`.

The server binds only to loopback. No deployment automation is installed. Do not copy real credentials into this repository or chat.

## Implementation and next steps

- [Integration checklist and exact configuration names](docs/INTEGRATIONS.md)
- [Minimal Clerk and hosted AM setup](docs/SETUP.md)
- [Reviewed policies and private assessments](docs/POLICIES.md)
- [Consent, tenant isolation, and workflow architecture](docs/ARCHITECTURE.md)
- [Verified AM interfaces and live-validation blockers](docs/AM_CONTRACT.md)
- [Source attribution and policy integration plan](docs/SOURCES.md)
- [Verification record](docs/VERIFICATION.md)

Only one employment record is supported in this first slice. Reviewed criterion checks can produce private met/not met/needs-information results with official-source and version metadata. The production policy registry starts empty; no immigration rule has been invented or promoted. This does not calculate complete program eligibility, FSW selection scores or CRS. The private notification centre records confirmed saves and completed checks. Policy ingestion and live-memory validation remain gated.
