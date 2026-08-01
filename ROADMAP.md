# Samsarix Portfolio Board roadmap

The first release established a truthful, reliable activity board. The next product milestone turns that board into a lightweight portfolio operations cockpit for solo maintainers and small teams.

## Product position

Samsarix Portfolio Board helps a maintainer answer two questions without adopting a database-backed developer portal:

1. Which repositories need attention now?
2. What concrete, verifiable change would improve each one?

GitHub remains the source of truth. Checks must be explainable, read-only, and derived from documented GitHub fields. The product will not invent build, security, uptime, or production-health claims.

See [docs/PRODUCT_STRATEGY.md](docs/PRODUCT_STRATEGY.md) for the research, use cases, and acceptance criteria behind this direction.

## Milestone 1 — Portfolio operations (implemented in 1.1)

- [x] Support GitHub user and organization accounts with bounded pagination.
- [x] Add transparent repository standards and a needs-attention queue.
- [x] Optionally enrich repositories with GitHub community-profile metrics when an operator supplies a token.
- [x] Show the exact checks that pass, fail, or are unavailable; avoid opaque weighted scores.
- [x] Add URL-backed filters and portable CSV/JSON reports.
- [x] Preserve activity browsing, stale-data recovery, and the no-write product boundary.

## Milestone 2 — Self-hosting and operations (implemented in 1.1)

- [x] Ship a non-root container image definition and Compose example.
- [x] Add a deployment health check and documented resource/network boundaries.
- [x] Record version and source-revision information in the runtime contract.
- [x] Verify the primary maintenance journey in a real browser at desktop and mobile sizes.

## Milestone 3 — Validated expansion

Only pursue these after real usage demonstrates demand:

- Scheduled snapshots and trend history.
- GitHub App authentication for private repositories and shared hosted deployments.
- Organization custom-property views for ownership and lifecycle.
- Configurable standards-as-code.
- Notifications or write actions, with separate authorization and audit design.

## Explicit non-goals

- A deployment control plane, incident monitor, or CI system.
- A replacement for GitHub security products or OpenSSF Scorecard.
- A general enterprise service catalog comparable to Backstage, Port, Cortex, or OpsLevel.
- Private-repository access without viewer authentication and authorization.
- Portfolio-wide mutations using an operator's personal token.

## Completion evidence

A milestone is complete only when its behavior is documented, deterministic tests pass, the production build and dependency audit pass, the primary browser journey is verified at desktop and mobile sizes, and the exact reviewed commit is merged. README claims must not exceed that evidence.
