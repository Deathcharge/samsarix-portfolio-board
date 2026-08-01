# Samsarix Portfolio Board

A focused, read-only operations dashboard for a maintainer's GitHub repository portfolio.

Samsarix Portfolio Board shows which repositories under one GitHub user or organization account are active, quiet, or archived. Its API also derives transparent portfolio-standard checks from GitHub metadata and can add GitHub's community-profile evidence when a read-only token is configured. It uses GitHub as the source of truth, keeps no database, and does not depend on any other Samsarix or legacy Helix repository.

> **Maturity:** version 1.1 is a locally verified release candidate. The product is intentionally smaller than the historical control-plane concept in `dashboard_spec.md`.

## Who it is for

This project is for a solo maintainer or small open-source team that wants a glanceable portfolio view without operating a full developer portal.

The activity labels are deliberately narrow:

- **Active:** GitHub reports a push within the configured activity window.
- **Quiet:** no push falls within that window.
- **Archived:** GitHub marks the repository as archived.

These labels are not claims about builds, tests, deployments, security, uptime, or production readiness.

## Fastest setup

Prerequisites:

- Node.js 22.13 or newer
- npm 10 or newer
- Network access from the server to `api.github.com`

```bash
git clone https://github.com/Deathcharge/samsarix-portfolio-board.git
cd samsarix-portfolio-board
npm ci
cp .env.example .env
npm run build
npm start
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Open [http://127.0.0.1:5000](http://127.0.0.1:5000). The default configuration shows public repositories for `Deathcharge` and works without a token.

## Configuration

The server reads `.env` automatically when that file exists. Environment variables supplied by the host remain supported.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Address the production server binds to. Use `0.0.0.0` only for an intended network deployment. |
| `PORT` | `5000` | HTTP port from 1 through 65535. |
| `GITHUB_OWNER` | `Deathcharge` | GitHub user or organization account whose public repositories are displayed. |
| `GITHUB_ACCOUNT_TYPE` | `user` | Account endpoint to use: `user` or `organization`. |
| `GITHUB_MAX_REPOSITORIES` | `100` | Pagination ceiling from 1 through 300 repositories. |
| `GITHUB_REPOS` | all returned | Optional comma-separated repository-name filter, applied after bounded discovery. |
| `GITHUB_TOKEN` | none | Optional read-only token used to raise the public-data rate limit and enable community-profile enrichment by default. |
| `GITHUB_COMMUNITY_PROFILE` | token present | Enable GitHub README, contributing, conduct, and template checks. `true` requires a token. |
| `GITHUB_COMMUNITY_PROFILE_TTL_SECONDS` | `3600` | Successful per-repository community-profile cache duration, from 900 through 86400 seconds. |
| `GITHUB_COMMUNITY_CONCURRENCY` | `4` | Maximum simultaneous community-profile requests, from 1 through 10. |
| `ACTIVITY_WINDOW_DAYS` | `90` | Number of days after a push during which a repository is labelled active. |
| `CACHE_TTL_SECONDS` | `300` | Duration of the successful in-memory GitHub response cache. |
| `STALE_MAX_AGE_SECONDS` | `86400` | Maximum age of a snapshot that may be served when GitHub is unavailable. |
| `GITHUB_TIMEOUT_MS` | `8000` | Hard timeout for the GitHub request. |

All values are validated at startup. Invalid configuration stops the process with an actionable error instead of silently selecting an unsafe value.

### Optional GitHub token

Public evaluation is token-free. GitHub currently documents a primary limit of 60 unauthenticated REST requests per hour and 5,000 for ordinary authenticated requests. Repository-list pages use the five-minute dashboard cache. The more expensive community-profile requests default off without a token and use a separate one-hour cache when enabled. Concurrent refreshes are deduplicated, enrichment concurrency is bounded, and a temporary enrichment failure becomes unavailable evidence rather than a fabricated pass or a missing repository.

For a fine-grained personal access token, grant no write permissions and only the minimum repository access GitHub requires for the token. Never prefix or quote the value in `.env`:

```dotenv
GITHUB_TOKEN=github_pat_replace_with_your_value
```

The token stays in the Node process. It is not returned by the API, embedded in the client build, or intentionally logged.

## Development

Run the Express API and Vite client together:

```bash
npm run dev
```

- Vite client: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- Express API: [http://127.0.0.1:5000](http://127.0.0.1:5000)

The Vite development server proxies `/api` to Express. No CORS configuration is required because the browser uses a same-origin path.

### Quality commands

```bash
npm run lint
npm test
npm run build
npm run audit:prod
```

Run the same checks as one command with `npm run check`.

The project is JavaScript rather than TypeScript, so there is no separate type-check command. ESLint checks the Node and browser code, the Node test runner exercises deterministic unit and API integration tests, and Vite validates the JSX production bundle.

Tests use fake GitHub responses and do not consume API quota or require credentials.

## Production run

Build before starting the single production process:

```bash
npm ci
npm run build
HOST=0.0.0.0 PORT=5000 npm start
```

On PowerShell:

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '5000'
npm start
```

The Node process serves both the API and the built React application. Place it behind your platform's TLS termination or reverse proxy for a public deployment. The repository does not create cloud resources, domains, certificates, or production credentials.

### Container run

The included multi-stage image builds the client, prunes development dependencies, runs the application as the unprivileged `node` user, and includes a health check. Compose additionally drops Linux capabilities, prevents privilege escalation, uses a read-only filesystem, and binds the published port to loopback by default.

```bash
cp .env.example .env
docker compose up --build
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000). Set `SOURCE_REVISION` before building when you want the health response to identify an exact source revision:

```bash
SOURCE_REVISION=$(git rev-parse HEAD) docker compose build
docker compose up
```

On PowerShell, set `$env:SOURCE_REVISION = git rev-parse HEAD` before `docker compose build`. The container definition is covered by CI; a local Docker engine is not required for source-based installation.

Useful endpoints:

- `GET /api/health` — application version, optional source revision, liveness, and in-memory cache state; it does not claim GitHub is healthy.
- `GET /api/dashboard` — normalized repository activity and portfolio-standard snapshot, summary, enrichment coverage, cache state, repository ceiling, and GitHub rate-limit metadata.

The process handles `SIGINT` and `SIGTERM`, stops accepting new work, and closes idle connections. It exits startup early when configuration is invalid.

## Architecture

```text
Browser
  └─ React portfolio UI
      └─ GET /api/dashboard (same origin)
          └─ Express API
              ├─ validated environment configuration
              ├─ in-memory TTL cache + concurrent-request deduplication
              ├─ bounded, paginated GitHub repository-list requests
              └─ optional long-cached community-profile requests
```

Key files:

- `server/config.js` — environment parsing and validation
- `server/github-client.js` — fixed-destination GitHub adapter, pagination, standards, and community-profile cache
- `server/dashboard-service.js` — fresh cache, in-flight request sharing, and stale-on-error behavior
- `server/app.js` — API contract, security headers, production static files, and structured errors
- `client/src/App.jsx` — loading, success, stale, empty, filtered-empty, and hard-failure UI
- `test/` — configuration, API client, cache, endpoint, and UI utility coverage
- `docs/PRODUCTIZATION.md` — audit record, decisions, priorities, risks, and release criteria

## Security, privacy, reliability, and API budget

- The GitHub destination is fixed in server code; browser requests cannot select arbitrary outbound URLs or repositories.
- Operator-controlled account and repository names are validated before use.
- The server sends no cross-origin access header and exposes read-only endpoints only.
- Content Security Policy and common browser hardening headers are applied to all responses.
- React renders repository metadata as text. Repository links are accepted only from `https://github.com/` or reconstructed safely.
- Upstream response bodies and tokens are not exposed in public errors.
- GitHub requests have an 8-second default timeout, dashboard responses are cached for five minutes, successful community profiles are cached for one hour, and only one dashboard refresh can be active per process.
- No analytics, cookies, user accounts, or durable user data are included.
- In-memory cache state is lost on restart. Multiple application instances have independent caches and therefore multiply the GitHub request budget.
- The supplied Compose service binds to loopback. A public deployment still needs deliberate TLS, proxy, firewall, and access-control decisions.

See [GitHub's REST API best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) and [rate-limit documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) for current platform behavior.

## Limitations

- The account type must be configured explicitly as `user` or `organization`; automatic account-type detection is not included.
- Discovery stops at the configured ceiling of at most 300 repositories and reports when that ceiling is reached.
- The application intentionally uses public repository endpoint modes even when a token is configured; private repositories are never returned by this release.
- Community-profile evidence is unavailable without a token or when an individual profile request fails. The underlying repository remains visible.
- `open_issues_count` is labelled “Open issues & PRs” because GitHub includes pull requests in that field.
- Activity history and trend charts are not persisted.
- There are no repository write actions, alerts, deployment controls, authentication layer, or multi-tenant isolation.
- Horizontal scaling should use a shared cache or a GitHub App before it is offered as a high-traffic hosted service.

## Portfolio scope

The default account currently contains a real mix of Samsarix projects, legacy Helix projects, and independent utilities. The board intentionally reads their public GitHub metadata instead of importing their code or requiring local checkouts. Each repository remains independently installable, testable, licensed, and releasable.

Private repositories are deliberately excluded from this release even when a token is configured. Supporting them safely would require viewer authentication and authorization, not just a broader GitHub credential.

## Project status and contribution

The completed first-release audit is recorded in [docs/PRODUCTIZATION.md](docs/PRODUCTIZATION.md). The portfolio-operations strategy is in [docs/PRODUCT_STRATEGY.md](docs/PRODUCT_STRATEGY.md), the implementation path is in [ROADMAP.md](ROADMAP.md), and version 1.1 verification is recorded in [docs/RELEASE_1.1.md](docs/RELEASE_1.1.md). Before opening a pull request, read [CONTRIBUTING.md](CONTRIBUTING.md), run all four quality commands above, and describe any configuration or public API behavior changes.

Use [GitHub Issues](https://github.com/Deathcharge/samsarix-portfolio-board/issues) for reproducible non-sensitive bugs and feature proposals. Report vulnerabilities privately according to [SECURITY.md](SECURITY.md); do not post tokens, private repository names, or security-sensitive details in a public issue.

## License and ownership

Copyright © 2026 Samsarix LLC.

The software and documentation are licensed under the [Apache License 2.0](LICENSE). Redistributions must follow its notice and attribution requirements; see [NOTICE](NOTICE). The license does not grant rights to Samsarix names or branding beyond customary attribution—see [TRADEMARKS.md](TRADEMARKS.md).

- General inquiries: [contact@samsarix.com](mailto:contact@samsarix.com)
- Support and private security reports: [support@samsarix.com](mailto:support@samsarix.com)
