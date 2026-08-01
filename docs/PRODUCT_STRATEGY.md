# Product strategy: portfolio operations for small maintainers

Last updated: 2026-08-01

## Decision

Evolve Samsarix Portfolio Board from an activity viewer into a **read-only portfolio operations cockpit** for solo maintainers and small open-source teams.

The product should turn public GitHub metadata into a prioritized, explainable maintenance queue while staying deployable as one Node process with no database. It should help maintainers improve discoverability and contributor readiness across a portfolio without asking them to model an enterprise software catalog first.

## Evidence

### Live Samsarix portfolio audit

On 2026-08-01, a read-only audit of the 30 public repositories owned by `Deathcharge` found:

| Signal | Result |
| --- | ---: |
| Missing descriptions | 0 |
| Missing topics | 0 |
| Missing licenses | 0 |
| Missing homepages | 12 |
| GitHub community profile below 100% | 25 |
| Missing `CONTRIBUTING` | 1 |
| Missing code of conduct | 13 |
| Missing issue template | 30 |
| Missing pull-request template | 23 |

This matters because the portfolio is already unusually tidy at the repository-list level. A product that only flags missing descriptions, topics, and licenses would immediately show an all-clear while substantial contributor-facing work remains.

The richer findings use GitHub's documented community-profile endpoint. GitHub defines its percentage as the share of recommended community-health files present; Samsarix should display the underlying checks and treat the percentage as GitHub's metric, not as a proprietary quality or security score.

### Current alternatives

- [GitHub's repository API](https://docs.github.com/en/rest/repos/repos) exposes the public metadata and supports user and organization repository lists with pagination. It is the appropriate source of truth for a GitHub-focused product.
- [GitHub community profile metrics](https://docs.github.com/en/rest/metrics/community) expose description, documentation, license, README, contributing guidance, conduct policy, and issue/pull-request template presence. The endpoint costs one request per repository, so enrichment needs authentication, caching, bounded concurrency, and an honest unavailable state.
- [Backstage Software Catalog](https://backstage.io/docs/features/software-catalog/) manages ownership and metadata for many software entity types, using catalog descriptors stored with code. That is valuable at organizational scale but materially heavier than this product's target journey.
- [Port scorecards](https://docs.port.io/governance/standards-and-compliance/concepts-and-structure/), [Cortex Scorecards](https://docs.cortex.io/standardize/scorecards), and [OpsLevel Rubrics](https://docs.opslevel.com/docs/getting-started-with-rubrics) provide configurable standards, maturity levels, integrations, and organization-wide reporting. Samsarix should not imitate their breadth; it should make a useful default workflow available from GitHub alone.
- [OpenSSF Scorecard](https://openssf.org/scorecard/) evaluates open-source security posture. Samsarix can link to or integrate that evidence later, but must not present metadata completeness as a security score.
- [GitHub organization custom properties](https://docs.github.com/en/organizations/managing-organization-settings/managing-custom-properties-for-repositories-in-your-organization) provide structured governance metadata for organizations. They are a future authenticated organization feature, not a dependency for the small-maintainer workflow.

## Target users and jobs

### Primary: portfolio maintainer

> Before sharing, releasing, or revisiting my projects, show me which repositories need concrete maintenance and let me work through that queue.

Success means a maintainer can open the board, filter to repositories needing attention, understand every failed check, open the affected repository, and export the current report.

### Secondary: small open-source team

> Give us one read-only view of an organization or maintainer account so we can agree on baseline repository standards without deploying a full developer portal.

Success means the team can configure an organization account, fetch more than one page safely, share a filtered URL, and export the same deterministic evidence.

### Secondary: portfolio reviewer

> Help me distinguish active, discoverable, contributor-ready, quiet, and archived work without pretending those signals prove production or security health.

Success means labels disclose their inputs and unavailable enriched evidence never silently becomes a pass.

## Product principles

1. **Checks, not vibes.** Each result names the GitHub field or community file behind it.
2. **No opaque score.** Use pass/fail/unavailable checks and counts. If GitHub supplies a percentage, label its source.
3. **Read-only by default and by design.** Link maintainers to GitHub; do not mutate repositories.
4. **Useful without infrastructure.** One process, no database, public repositories, optional token.
5. **Rate limits are a product constraint.** Paginate within a configured ceiling; cache expensive enrichment much longer than list data; deduplicate refreshes; bound concurrency.
6. **Absence is not failure when evidence is unavailable.** Community checks must be `unavailable`, never passing, when enrichment is disabled or fails.
7. **Portable evidence.** A filtered URL and CSV/JSON exports make the dashboard useful in reviews and cleanup sessions.

## Milestone acceptance criteria

### Account coverage

- Operator can select a GitHub `user` or `organization` account.
- Repository discovery follows pagination up to a validated configurable maximum.
- Private repositories remain excluded and the API/UI state that boundary.

### Explainable standards

- Core checks cover description, topics, and detected license using repository-list data.
- Optional community checks cover README, contributing guidance, code of conduct, issue template, and pull-request template using GitHub's community-profile endpoint.
- Every repository exposes failed, passed, and unavailable check identifiers.
- Summary counts and filtering are derived from those same results.

### Useful workflow

- Maintainer can filter all/needs-attention/ready and sort by attention or activity.
- Search and filter state can be represented in the page URL.
- Maintainer can export the visible result set as CSV and JSON without server-side persistence.
- Empty, loading, partial-enrichment, stale, and hard-failure states remain explicit and accessible.

### Reliability and security

- A token remains optional, server-side, unlogged, and read-only.
- Community enrichment defaults on only when a token exists, can be disabled, uses a separate long TTL, and has bounded concurrency.
- One repository's enrichment failure does not discard the repository list or fabricate a pass.
- Tests use fakes and consume no live GitHub quota.
- Existing cache, timeout, URL-safety, security-header, and structured-error guarantees remain intact.

### Distribution

- Source install remains supported.
- Container definition runs as a non-root user, exposes a health check, and contains only production runtime dependencies plus the built client.
- Deployment documentation states that public TLS, authentication, shared caching, and horizontal scaling remain operator responsibilities.

## Measures of value

The initial release should measure product value through user-observable outcomes, not telemetry:

- Time from launch to identifying the first actionable repository gap.
- Number of repositories reviewed in one maintenance session.
- Number of failed checks resolved between exported snapshots.
- Whether maintainers return to the board before releases or portfolio reviews.

No analytics or tracking is required to ship this milestone.
