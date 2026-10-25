# Main-only release pipeline

PR checks run in GitHub Actions. Vercel builds and deploys only `main` after this
configuration is merged and the existing project is connected to the repository.
It does not run the test suite again.

| Stage | Work |
| --- | --- |
| Pull request | GitHub: hygiene, locked install, typecheck, tests, build, compiled-entry/static packaging verification, dependency audit |
| Merge to main | GitHub repeats its main checks; Vercel installs and builds/packages the production app |
| Other branch push | Vercel automatic deployment disabled, including names containing `/` |

Vercel install remains `npm ci --ignore-scripts`. Build remains
`npm run build:vercel` (TypeScript compilation, Vite build and asset packaging).
No test command, paid build tier, extra service, deploy token, or new CI deployment
job is introduced. Build and runtime usage still consume the existing plan's
allowance; this is not a promise of zero compute.

## Required project connection

Verified on 2026-10-25: `maple-companion` exists in `zetta-techs-projects`, but it
does not appear in Vercel's linked Git project inventory. The Codex browser's
existing Git settings tab is signed out. The repository rule alone cannot finish
the connection.

After signing in, use the existing project's **Settings → Git**:

1. Connect **Zetta-tech/maple-companion** to **maple-companion**, not the newsletter
   project and not a newly created project.
2. Confirm **main** as the Production branch and keep preview deployments disabled.
3. Leave the Ignored Build Step automatic; `git.deploymentEnabled` prevents other
   branches from triggering builds. An ignore command would run after a deployment
   is created and would still consume deployment/concurrency quota.
4. Inspect any GitHub permission request before accepting it. Repository access
   expansion requires explicit approval; connecting an already authorized
   repository is different from granting broader access.
5. After a reviewed merge, verify exactly one deployment for the resulting main
   SHA, production alias, HTML/asset loading, readiness and sign-in. Inspect any
   in-flight deployment before considering a manual retry.

Do not merge this PR or trigger a deployment as part of preparation. No OAuth
grant, Git connection, project setting, or branch protection is changed by this PR.

## Limits

`{"**":false,"main":true}` covers nested branches. Vercel uses minimatch rules,
and a matching `true` rule wins, so `main` is enabled while other names remain off.
The rule also matches a direct push to main; it does not itself require a reviewed
PR or wait for GitHub checks. Existing review/merge discipline remains required.
No stronger branch-protection or post-merge CI gate is claimed.

Sources: [Git branch configuration](https://vercel.com/docs/project-configuration/git-configuration),
[Ignored Build Step behavior](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step).
