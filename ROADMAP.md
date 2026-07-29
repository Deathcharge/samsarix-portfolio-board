# Samsarix Portfolio Board roadmap

This roadmap separates four gates: merge, release, publication, and flagship adoption. Passing one does not imply the next.

## Product boundary

Portfolio role: **internal infrastructure**. Use this to improve the portfolio through immutable, reviewed automation or internal deployments. It must not become a hidden runtime dependency for customer-facing products.
Planned repository identity: `Deathcharge/samsarix-portfolio-board` (ready).

Current disposition: Merge the productization branch after exact-head verification and rollback-ref creation; release and adoption remain separate decisions.

## Stabilize the productized default

- Keep the default branch buildable from a clean checkout and preserve exact-head CI evidence.
- Keep Samsarix LLC branding, package identity, license metadata, and compatibility aliases internally consistent.
- Preserve the pre-productization default under a rollback ref before merging; do not delete legacy history.
- Review priority: review PR 1 plus decide repository visibility license and one protected deployment path.

## Release candidate

- Adopt it in one repository through an immutable revision.
- Document permissions, rollback, failure isolation, and ownership.
- Measure maintenance saved before expanding portfolio-wide.

## Samsarix adoption

- Define a public API, event, schema, artifact, or deployment contract before connecting to Samsarix Unified.
- Add a consumer-owned contract fixture covering authentication, privacy, limits, errors, and version compatibility.
- Make one implementation canonical; remove or freeze duplicate behavior only after parity and rollback are proven.
- Record an owner, support level, compatibility window, and measurable adoption signal.

## Completion evidence

A milestone is complete only when its exact commit, commands and results, artifact digest, consumer or deployment, and rollback path are recorded in a pull request or release record. README claims must not exceed that evidence.
