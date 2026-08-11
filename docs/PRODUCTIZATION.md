# Productization record

Last updated: 2026-08-01

> This record describes the completed first productization milestone. Current competitive research, real-world use cases, and acceptance criteria are maintained in [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md).

## Current repository assessment

This repository began as a small React and Express prototype for displaying public GitHub repository metadata. The checked-in implementation does not match the much larger control-plane dashboard described in `dashboard_spec.md`, and it has no implemented dependency graph, deployment management, WebSocket stream, persistence, authentication, or historical metrics.

The original three-commit history shows a prototype, a license change, and a generic README rewrite. The repository was clean on `main` at `71bf80c3af866d0e91f144477e844dd325357dc7` before productization work began. No pre-existing user changes were present.

### What worked at baseline

- The Express process could bind to port 5000.
- `GET /api/health` returned JSON.
- The React source described a grid of repository cards.

### What did not work or was misleading

- The production build could not find `index.html`.
- The running server returned 404 for `/` because no client build existed at the path Express served.
- The GitHub client sent the literal string `public` as a credential when no token was configured. All 13 upstream calls failed with `Bad credentials` while `/api/health` still reported `healthy`.
- Every connected browser triggered 13 concurrent GitHub requests every 30 seconds: 1,560 upstream requests per hour per viewer before retries. GitHub documents a 60-request/hour unauthenticated limit.
- Repository `status: healthy` meant only that one metadata request succeeded; it did not measure build, deployment, test, or service health.
- The fixed footer claimed exact lines of code and 13 production-ready repositories without a data source.
- There was no lockfile, test suite, linter, type checker, CI workflow, environment example, error contract, cache, timeout, request deduplication, or graceful shutdown.
- The README documented Python, pytest, files, CI, examples, an MIT license, and production readiness that did not exist.
- The original BSL parameters identified the licensed work as `Helix Licensing System`, not this repository. That release-blocking mismatch was resolved by the owner-directed Samsarix rebrand and adoption of Apache License 2.0.

## Chosen product

**Samsarix Portfolio Board** is a small, read-only, self-hostable activity dashboard for one GitHub account. It answers a narrow question well: “Which repositories in this portfolio are active, quiet, or archived, and where should I look next?”

It is intentionally not a developer portal, deployment control plane, incident monitor, code-quality scanner, or replacement for any broader Samsarix or legacy Helix repository. GitHub remains the source of truth. The application adds a fast, focused portfolio view with honest labels, search/filtering, failure recovery, bounded API usage, and a simple deployment shape.

### Target user and primary use case

The target user is a solo maintainer or small open-source team that owns multiple repositories under one GitHub account and wants a glanceable public or internal portfolio view without adopting a database-backed service catalog.

Primary journey:

1. Copy `.env.example` to `.env` and set `GITHUB_OWNER`; optionally add a read-only GitHub token.
2. Install and build the application.
3. Start one Node process.
4. Open the board, see a truthful summary and repository activity states, filter/search the portfolio, follow a repository link, and recover clearly from GitHub or network failures.

### Independent reason to exist

Backstage is a metadata-driven software catalog intended to manage and discover many types of software components at organizational scale. This repository can be independently useful by staying far smaller: one account, GitHub as the source of truth, no database, no write actions, and no private Samsarix or legacy Helix infrastructure. GitHub's own security insights are plan- and permission-dependent and focus on security posture rather than a lightweight public activity portfolio.

Current research used for the decision:

- [GitHub REST API best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2026-03-10): avoid frequent polling and concurrent requests; use authentication, caching, and conditional requests.
- [GitHub REST API rate limits](https://docs.github.com/enterprise-cloud@latest/rest/using-the-rest-api/rate-limits-for-the-rest-api): 60 unauthenticated requests/hour and 5,000 authenticated requests/hour for ordinary user authentication.
- [GitHub repository endpoints](https://docs.github.com/en/rest/repos/repos?apiVersion=2026-03-10): public repository metadata can be read without authentication; metadata-only access is sufficient for fine-grained tokens.
- [Backstage Software Catalog](https://backstage.io/docs/features/software-catalog/): a broader metadata catalog whose scope would be unjustified here.

## Key product and architecture decisions

- Preserve the existing React, Vite, Express, and Node architecture; repair it incrementally.
- Replace the heavy Octokit bundle and unused Axios, WebSocket, CORS, dotenv, Tailwind, and chart dependencies with the platform `fetch` API and a minimal dependency set.
- Use a single GitHub list request per cache refresh instead of one request per repository.
- Do not send an `Authorization` header when `GITHUB_TOKEN` is absent.
- Keep the GitHub base URL constant and treat owner, repository filters, timeouts, activity window, cache TTL, and port as validated operator configuration.
- Cache successful responses in memory, deduplicate concurrent refreshes, serve stale data after transient upstream failure, and place hard time bounds on network calls.
- Keep the browser same-origin and read-only; remove the arbitrary repository metrics route and permissive CORS.
- Call the calculated state **activity**, not health. `active`, `quiet`, and `archived` are derived from GitHub's `pushed_at` and `archived` fields and are not claims about build or production health.
- Retain no user data and add no telemetry. The optional GitHub token remains server-side and must never be logged or returned.
- Use deterministic fakes for automated tests; tests must not consume GitHub quota.

## Assumptions

- Node 20.19+ or a supported newer LTS/current release is acceptable for this small application.
- The first credible release targets one GitHub **user account** and at most the first 100 repositories ordered by recent push. Organization-specific discovery and pagination beyond 100 are deferred until real demand exists.
- In-memory cache loss on restart is acceptable for a single-process, read-only MVP.
- Public unauthenticated operation is useful, and an optional token can raise the public-data rate limit. Private repository discovery remains out of scope until the product has viewer authentication and authorization.
- Samsarix LLC is the stated project owner. Apache License 2.0, a retained `NOTICE`, and an explicit trademark policy provide a clear open-source grant, durable attribution requirements, patent terms, and a separate brand boundary.

## Baseline command results

Environment: Windows, Node `v24.12.0`, npm `11.6.2`.

| Command | Baseline result |
| --- | --- |
| `npm install` | Passed after 14 minutes; added 277 packages and created the first `package-lock.json`. Reported 18 vulnerabilities: 16 moderate and 2 high. |
| `npm run build` | Failed: Vite could not resolve entry module `index.html`. |
| `npm run lint` | Failed: script did not exist. |
| `npm run typecheck` | Failed: script did not exist. |
| `npm test` | Failed: script did not exist. |
| `npm audit --json` | Failed its audit threshold with 18 vulnerabilities. Direct high-severity chains were rooted in old `octokit` and Vite dependencies. |
| `npm start` | Process started on port 5000. `/api/health` returned 200, `/api/repos` returned 200 with 13 `Bad credentials` entries, and `/` returned 404. |

## Findings and priorities

### P0 — release blockers

- [x] Make installation deterministic with a maintained lockfile and supported Node engine.
- [x] Make the documented production build and single-process start path work.
- [x] Make the primary dashboard journey work without fabricated credentials, metrics, or health claims.
- [x] Remove or upgrade vulnerable direct dependency lines and reach a clean production dependency audit.
- [x] Add deterministic tests and CI for the core journey.
- [x] Replace false setup, test, CI, maturity, and license claims in the README.

### P1 — serious usefulness, reliability, security, or maintenance issues

- [x] Bound GitHub requests with cache TTL, timeout, concurrency deduplication, and rate-limit-aware errors.
- [x] Validate configuration and fail early with actionable messages.
- [x] Add empty, loading, success, stale, offline/error, retry, and accessibility states.
- [x] Remove the arbitrary repository lookup surface, permissive CORS, and raw upstream error leakage.
- [x] Add explicit app liveness and upstream-data status semantics.
- [x] Add graceful shutdown and useful, non-sensitive logs.
- [x] Add linting, formatting conventions, security headers, and release metadata.

### P2 — valuable after the first credible release

- Organization-specific discovery and pagination beyond 100 repositories.
- Optional persistence of historical snapshots and trends, only after validating demand.
- GitHub App authentication for shared hosted deployments.
- Repository-supplied metadata for ownership, lifecycle, and custom links.
- Deployment-specific observability and E2E browser checks in CI.

## Implementation checklist

- [x] Repair the project layout and production asset path.
- [x] Implement validated configuration and a bounded GitHub repository client.
- [x] Implement cache, concurrent request deduplication, stale fallback, and structured API errors.
- [x] Build the responsive and accessible portfolio UI with search, filters, refresh, empty, and failure states.
- [x] Add focused unit and integration tests for the server and primary API journey.
- [x] Add linting, clean scripts, package metadata, CI, environment example, and security guidance.
- [x] Rewrite README and mark the speculative historical specification clearly.
- [x] Run final clean install, lint, tests, build, production smoke tests, audit, and adversarial review.

## Release acceptance criteria

- A new user can follow the README from clone to a working dashboard without private Samsarix or legacy Helix services.
- Public repository data loads without a token; invalid tokens fail safely and visibly.
- The browser renders loading, empty, success, stale-data, and hard-failure states.
- GitHub requests are timeout-bounded, cache-bounded, deduplicated, and do not poll every viewer every 30 seconds.
- The UI contains no fabricated repository counts, statuses, metrics, or production claims.
- Lint, tests, build, production smoke test, and production dependency audit pass.
- CI runs the meaningful checks on supported Node versions.
- Documentation matches the implemented configuration and behavior.
- No locally actionable P0 issue remains.

## Known risks and trust boundaries

- GitHub and the network are external availability boundaries; cached data may be stale and must be labeled.
- Repository names, descriptions, topics, and URLs are remote data. React text escaping and strict URL handling prevent them from becoming executable markup or arbitrary links.
- `GITHUB_TOKEN` is a server-side secret. It must use the least privileges practical, never reach browser responses, and never appear in logs.
- A public deployment can be requested by arbitrary viewers. The cache and in-flight deduplication prevent viewer count from multiplying GitHub API calls.
- In-memory state is process-local. Multi-instance deployments can multiply refresh traffic; a shared cache or GitHub App should be considered before scaling horizontally.
- GitHub API usage has no direct per-request charge today, but rate limits are a reliability budget. With a five-minute cache, one instance makes at most about 12 list requests/hour during sustained use, versus the baseline's 1,560 requests/hour per viewer.

## Distribution and sustainability

The simplest distribution is source plus a lockfile: `npm ci`, `npm run build`, and `npm start` on any Node host. A container or hosted demo is optional owner-authorized work, not a release requirement.

The credible first model is free self-hosting under Apache License 2.0. The accompanying `NOTICE` preserves Samsarix attribution in redistributed derivatives, and Apache's trademark clause leaves the Samsarix brand outside the software grant. Monetization is premature without validated demand. If maintainers later want a managed service, likely paid value would be private-repository access, shared history, alerts, and organization policy views; those features would require a GitHub App, durable storage, tenant isolation, privacy terms, and cost validation before sale.

### Licensing decision

Apache License 2.0 is the selected release license because it is a standard open-source license with explicit copyright and patent grants, redistribution conditions, modification notices, and retention of relevant copyright, trademark, and attribution notices. A Samsarix `NOTICE` and `TRADEMARKS.md` make the desired credit and brand boundary concrete without imposing a custom license.

AGPL-3.0 would be the stronger alternative if Samsarix later decides that every modified hosted version must offer its corresponding source to network users. That choice would add material compliance and adoption tradeoffs and should be made as a deliberate future-version or dual-licensing decision with counsel, not mixed into this release.

## Completed work

- Protected and inventoried the clean worktree and recent history.
- Reviewed all 11 baseline repository files.
- Ran install, build, script, audit, and live endpoint baselines.
- Chose and documented the narrow independent product definition.
- Completed bounded current research using official GitHub, Octokit, and Backstage sources.
- Rebuilt the production path around one cached GitHub list request, validated configuration, hard timeouts, concurrent refresh deduplication, bounded stale fallback, and safe structured errors.
- Replaced fabricated health and metric claims with transparent activity labels derived only from GitHub `pushed_at` and `archived` fields.
- Built the complete responsive dashboard journey: summary, search, activity filters, sorting, repository links, loading, empty, filtered-empty, stale, offline, hard-error, retry, and manual-refresh states.
- Reduced the runtime dependency surface, upgraded maintained direct dependencies, generated a lockfile, and reached zero known production dependency vulnerabilities.
- Added deterministic unit and integration coverage, ESLint, CI, environment documentation, security headers, graceful shutdown, and truthful release metadata.
- Exercised the production UI in a real browser at desktop and mobile sizes, including filter recovery and an induced offline-refresh failure while preserving the prior snapshot.
- Completed a repository-wide threat model and security scan. Three plausible candidates—private-data exposure, upstream request amplification, and unsafe repository links—were rejected with code and test evidence; no reportable finding remained.
- Rebranded the implemented product and runtime metadata from Helix to Samsarix while preserving the original Helix specification as a clearly labelled historical artifact.
- Replaced the mismatched BSL text with Apache License 2.0, Samsarix LLC copyright and attribution notices, a trademark policy, contribution terms, and a private security-reporting policy using the verified company contact addresses.

## Final verification

Final verification used Node `v24.12.0` and npm `11.6.2` on Windows.

| Check | Result |
| --- | --- |
| `npm ci` | Passed from the lockfile; 222 packages audited and 0 vulnerabilities reported. |
| `npm run lint` | Passed with no lint findings. |
| `npm test` | Passed all 16 deterministic tests. |
| `npm run build` | Passed; Vite produced the production client in `client/dist`. |
| `npm run audit:prod` | Passed with 0 known production dependency vulnerabilities. |
| Production smoke | `/` returned 200 with the dashboard; two `/api/dashboard` calls returned 30 repositories with `refreshed` then `fresh` cache states; `/api/health` returned `ok`; no token was exposed. |
| Browser journey | Passed at desktop and 390×844 mobile sizes; search, filters, clear-filter recovery, responsive layout, offline stale-snapshot warning, retry, and recovery were verified. Initial console had 0 errors and 0 warnings. |
| Adversarial review | Passed configuration, secret-flow, request-budget, remote-content, URL-safety, error-leakage, and dependency checks with no reportable security finding. |
| `git diff --check` | Passed with no whitespace errors. |

One optional dev-only WASI support package is reported as extraneous by npm on this Windows install. It is not a direct or production dependency, does not affect the clean audit, build, tests, or runtime, and is recorded as an npm optional-dependency graph quirk rather than a release blocker.

## Release disposition

The implementation is a **release candidate**: the documented install, build, start, primary journey, tests, CI, dependency audit, production smoke test, browser validation, security review, branding, and release licensing all pass or are resolved, and no locally actionable P0 or P1 issue remains.

The source repository remains private until the owner deliberately changes its GitHub visibility. Hosting, a public domain, TLS, deployment credentials, a repository rename, and a first version tag are distribution decisions rather than application defects. The Apache license and Samsarix ownership metadata remove the prior license-identity blocker, but counsel should confirm chain of title and trademark strategy before a high-stakes commercial launch.

## Deferred and owner-blocked work

- **Owner/credentials:** Supply a least-privilege GitHub token only if higher public-data rate limits are needed. Public evaluation remains token-optional; private repositories are deliberately not queried.
- **Repository:** The GitHub repository is named `samsarix-portfolio-board`; public release metadata and community health files are maintained with the source.
- **Infrastructure:** A hosted demo, production TLS termination, deployment credentials, and operator access controls remain separate deployment decisions. The source release does not require them.
