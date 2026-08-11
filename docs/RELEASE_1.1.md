# Version 1.1 release evidence

Date: 2026-08-01

## Outcome

Version 1.1 turns Samsarix Portfolio Board into a lightweight portfolio operations cockpit while preserving its read-only, zero-database boundary.

Implemented outcomes:

- GitHub user and organization discovery with a validated ceiling of 300 repositories.
- Explainable core checks for description, topics, and detected license.
- Optional, token-gated GitHub community-profile checks for README, contributing guidance, conduct policy, and issue/pull-request templates.
- A separate one-hour successful-profile cache, bounded concurrency, and partial-enrichment failure handling.
- Attention counts, filtering, sorting, and exact pass/fail/unavailable evidence in the UI.
- Shareable URL-backed explorer state and filtered CSV/JSON exports.
- CSV formula neutralization for remote repository metadata.
- Version and optional source-revision identity in the health response.
- A multi-stage, non-root runtime container and a loopback-bound, read-only Compose service.
- CI coverage for Node 22, Node 24, and container construction.

## Live portfolio validation

Read-only GitHub queries against `Deathcharge` returned 30 public repositories. All 30 had a description, topics, and a detected license. GitHub community-profile evidence found 25 below 100%, including 30 without an issue template, 23 without a pull-request template, and 13 without a code of conduct. This validated contributor readiness as a useful workflow beyond basic metadata cleanup.

## Verification evidence

Environment: Windows, Node `v24.12.0`, npm `11.6.2`.

The following table records the original 2026-08-01 release-candidate verification and is retained as historical evidence. The current publication results are recorded in the public release update below.

| Check | Result |
| --- | --- |
| `npm ci` | Historical 2026-08-01 run passed from the then-current 1.1.0 lockfile; 222 packages audited and 0 vulnerabilities reported. |
| `npm run check` | Passed the complete lint, test, build, and production-audit chain. |
| `npm test` | Passed all 21 deterministic tests. |
| `npm run lint` | Passed with zero warnings. |
| `npm run build` | Passed; Vite built the production client. |
| `npm run audit:prod` | Passed with 0 known vulnerabilities. |
| YAML parse | `compose.yaml` and `.github/workflows/ci.yml` parsed successfully with PyYAML. |
| Runtime smoke | Health returned `ok`, version `1.1.0`, the injected revision, and cache state; dashboard returned 30 public user-account repositories. |
| Desktop browser | Live 30-repository portfolio, standards evidence, filter controls, and shareable URL state rendered successfully. |
| Mobile browser | At 390×844, the filtered queue rendered without horizontal overflow; toolbar, standards checks, metrics, and GitHub link remained readable. |
| Browser console | 0 errors and 0 warnings. |
| CSV safety | Deterministic test proves leading spreadsheet formula characters are neutralized. |
| `git diff --check` | Passed. |

The local machine does not have Docker installed. The Dockerfile and Compose configuration were reviewed and their surrounding YAML validated, but an image could not be built locally. The pull request's container CI job is the intended construction check.

## Security review status

The targeted controls above are covered by code inspection and deterministic tests: fixed outbound GitHub origins, server-only token handling, public-only repository modes, input validation, bounded pagination and concurrency, timeout and cache controls, React text escaping, safe GitHub links, CSV formula neutralization, structured errors, security headers, and an unprivileged read-only container shape.

A formal Codex Security diff-scan was attempted for the `origin/main..HEAD` range. Its workbench initialization command failed before returning a workspace or scan ID, so no formal scan artifact exists and this record does not claim one. The failure is a tooling limitation, not a passed security result.

## Public release update

The 2026-08-11 publication pass added the changelog, citation metadata, conduct policy, support policy, supported-version table, and public repository badges. A read-only scan of all 17 reachable commit states found no GitHub, OpenAI, AWS, Slack, or Stripe credential signatures; no private-key headers or credentialed URLs; and no committed secret-bearing environment file. The only environment file in reachable history is the intentionally blank `.env.example` template.

Two development-tool advisories disclosed after the original verification were resolved by updating `brace-expansion` to 5.0.9 and `nanoid` to 3.3.18 in the lockfile. The lock was regenerated with a current npm release so its optional peer graph installs consistently on Linux and Windows. Public CodeQL analysis also identified unbounded requests to the SPA fallback's fixed file response; a per-IP limiter now runs before every API, static, and SPA fallback route and returns explicit 429 responses. The final clean `npm ci` audited 223 packages with zero known vulnerabilities, and `npm run check` passed lint, all 22 tests, the production build, and the production dependency audit. GitHub Actions status for the public release remains available from the README badge and the repository's Actions page.

## Remaining product boundaries

- Private repositories still require a future viewer-authenticated GitHub App design.
- Multiple instances still require a shared cache to avoid multiplying API use.
- TLS, public access control, proxy configuration, and firewall policy remain deployment responsibilities.
- Historical snapshots, alerts, repository writes, custom organization properties, and configurable standards-as-code remain future work requiring validated demand.
