# Source attribution and reuse

Source inspection was read-only. No `.env`, credentials, private datasets, newsletter subscribers, production databases or avatar assets were copied. The original repository and backup were not modified.

- [Backup manifest at eefd1c7](https://github.com/Zetta-tech/build-north-backup-maple-platform/blob/eefd1c70feefaf521c80fce80c5734fe4f431d75/package.json): informed the minimal React/Vite + Express + Clerk + AM stack. Current published package versions were checked; the lockfile pins the installed versions.
- [Backup auth](https://github.com/Zetta-tech/build-north-backup-maple-platform/blob/eefd1c70feefaf521c80fce80c5734fe4f431d75/server/auth.ts): informed explicit origin checking and Clerk session-token ownership. Implementation here has no demo cookies/auth path.
- [Backup AM adapter](https://github.com/Zetta-tech/build-north-backup-maple-platform/blob/eefd1c70feefaf521c80fce80c5734fe4f431d75/server/adapters/memory.ts): informed transport origin guards and finite idempotency-window caution. Its SQLite canonical profile + AM contextual copy/shared Context model was deliberately not adopted.
- [Newsletter OINP repository at 17d26bc](https://github.com/Zetta-tech/maple-newsletter/blob/17d26bc02f62f3af8b912962d46889276ffbd906/web/src/lib/oinp-ops/repository.ts): inspected source body/hash/parser version, official publication/effective time, source versions, rule conflicts and promotion inputs. No rules or source bodies were copied into this slice.
- [Clerk middleware reference](https://clerk.com/docs/reference/express/clerk-middleware): use actual middleware plus `getAuth({acceptsToken:'session_token'})`; explicitly constrain authorized parties.
- [AM current contract references](AM_CONTRACT.md): native triples, structural reads, provenance, supersession and finite response receipts.

## Next reviewed-policy slice

Adapt the existing newsletter discovery approach when adding Tavily: helper articles discover/explain, but official reviewed requirements govern. Store official body/version/provenance, content hash, parser version, observed/published/effective dates, and validation results. Track current/future/superseded states. Conflicting or failed validation stays on hold. Initial promotion is a manually reviewed allowlist; do not promote unreviewed extraction automatically. No additional service credentials are needed for the current employment-update path.

Full policy promotion procedure, exact initial supported requirements and reviewed sources remain to be selected. This code makes no unsupported immigration claim while those are pending.
