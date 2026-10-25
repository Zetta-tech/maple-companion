# Main-only deployment workflow

GitHub continues running the existing CI workflow on pull requests and pushes to `main`: locked dependency install without lifecycle scripts, hygiene, typecheck, tests, build, hosted packaging and production dependency audit.

The Vercel Git rule disables every branch with `**` and explicitly enables `main`. Vercel documents that a matching true rule enables the branch. This includes slash-named feature branches in the disabled set. Vercel runs `npm run build:vercel` and its server bundler, not a second full test suite. Build compute still applies.

The existing `maple-companion` Vercel project must be connected to `Zetta-tech/maple-companion`, with `main` selected as the Production branch and preview deployments disabled. This change does not create that Git connection, change GitHub branch protection, add auto-merge, or authorize direct pushes. The expected process remains: PR checks pass, a person reviews and merges, then Vercel builds the new main commit.

The configuration is branch-based, not an enforcement mechanism for approved PR merges. GitHub's branch-protection read returned a private-repository plan limitation during setup; no protection was changed or upgrade purchased. A direct push to `main` would also match the Vercel rule, so the reviewed-PR process remains operational policy unless separately enforced in GitHub.

This PR does not include the independent UI follow-up or alter application authentication, secrets, data, domains, or the newsletter project. It needs review/merge before the repository-level automatic deployment setting takes effect.

Reference: [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).
