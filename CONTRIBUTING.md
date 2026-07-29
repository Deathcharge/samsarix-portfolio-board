# Contributing

Thanks for helping improve Samsarix Portfolio Board.

## Before opening a change

- Open an issue for substantial product or API changes so the scope can be agreed first.
- Never commit tokens, private repository metadata, customer information, or generated dependency/build directories.
- Keep the application read-only and preserve the distinction between repository activity and build, security, deployment, or uptime health.

## Development checks

Use Node.js 22.13 or newer, then run:

```bash
npm ci
npm run lint
npm test
npm run build
npm run audit:prod
```

Tests must remain deterministic and must not consume GitHub API quota or require credentials.

## Contribution terms

Unless you explicitly state otherwise, a contribution intentionally submitted for inclusion in this project is provided under the Apache License 2.0, as described in section 5 of that license. By submitting a contribution, you confirm that you have the right to do so and that Samsarix LLC may distribute it under the project's license.

For contribution or licensing questions, contact [contact@samsarix.com](mailto:contact@samsarix.com).
