# Changelog

Notable changes to Samsarix Portfolio Board are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-08-11

First public release.

### Added

- GitHub user and organization discovery for as many as 300 public repositories.
- Explainable portfolio checks for descriptions, topics, detected licenses, and optional community-profile files.
- Attention filtering, sorting, shareable URL state, and filtered CSV and JSON exports.
- Separate bounded caches for portfolio data and optional community-profile enrichment.
- Multi-stage container image, hardened Compose service, runtime version identity, and Node 22/24 CI coverage.

### Security

- Kept GitHub credentials server-side and optional, restricted discovery to public repository endpoint modes, and fixed outbound requests to GitHub's API origin.
- Added configuration bounds, timeouts, request deduplication, safe link handling, security headers, structured errors, and CSV formula neutralization.
- Added a configurable per-IP request limit before API and filesystem-backed routes, with conservative proxy trust by default.
- Updated transitive development dependencies to resolve the advisories known at release time.

### Documentation

- Adopted the Apache License 2.0 with Samsarix LLC attribution and a separate trademark policy.
- Added contribution, support, security-reporting, conduct, citation, product strategy, and release-evidence guidance.

[1.1.0]: https://github.com/Deathcharge/samsarix-portfolio-board/releases/tag/v1.1.0
