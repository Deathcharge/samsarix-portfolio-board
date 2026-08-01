import assert from 'node:assert/strict'
import test from 'node:test'
import { createGitHubClient, GitHubError } from '../server/github-client.js'

function headers(values = {}) {
  const normalized = new Map(
    Object.entries(values).map(([name, value]) => [name.toLocaleLowerCase(), String(value)]),
  )
  return { get: (name) => normalized.get(name.toLocaleLowerCase()) ?? null }
}

function response({ status = 200, body = [], responseHeaders = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers(responseHeaders),
    async json() {
      return body
    },
  }
}

function repository(overrides = {}) {
  return {
    name: 'active-repo',
    full_name: 'octocat/active-repo',
    description: 'A useful repository',
    html_url: 'https://github.com/octocat/active-repo',
    language: 'JavaScript',
    topics: ['portfolio'],
    license: { spdx_id: 'Apache-2.0' },
    stargazers_count: 12,
    forks_count: 3,
    open_issues_count: 4,
    pushed_at: '2026-07-20T12:00:00Z',
    updated_at: '2026-07-21T12:00:00Z',
    archived: false,
    ...overrides,
  }
}

test('GitHub client uses one unauthenticated list request and returns honest activity', async () => {
  let captured
  const client = createGitHubClient({
    owner: 'octocat',
    token: null,
    timeoutMs: 2000,
    activityWindowDays: 90,
    now: () => new Date('2026-07-28T12:00:00Z'),
    fetchImpl: async (url, options) => {
      captured = { url, options }
      return response({
        body: [
          repository(),
          repository({
            name: 'quiet-repo',
            full_name: 'octocat/quiet-repo',
            html_url: 'https://github.com/octocat/quiet-repo',
            pushed_at: '2025-01-01T12:00:00Z',
            stargazers_count: 2,
          }),
          repository({
            name: 'archived-repo',
            full_name: 'octocat/archived-repo',
            html_url: 'https://github.com/octocat/archived-repo',
            archived: true,
          }),
        ],
        responseHeaders: {
          'x-ratelimit-limit': 60,
          'x-ratelimit-remaining': 58,
          'x-ratelimit-reset': 1785258000,
        },
      })
    },
  })

  const dashboard = await client.listRepositories()

  assert.equal(captured.url.pathname, '/users/octocat/repos')
  assert.equal(captured.url.searchParams.get('per_page'), '100')
  assert.equal(captured.options.headers.Authorization, undefined)
  assert.deepEqual(dashboard.repositories.map((item) => item.activity), [
    'active',
    'quiet',
    'archived',
  ])
  assert.deepEqual(dashboard.summary, {
    total: 3,
    active: 1,
    quiet: 1,
    archived: 1,
    stars: 26,
    forks: 9,
    needsAttention: 0,
    noKnownGaps: 3,
    communityReady: 0,
    failedChecks: 0,
  })
  assert.equal(dashboard.accountType, 'user')
  assert.equal(dashboard.communityProfiles.enabled, false)
  assert.equal(dashboard.repositories[0].standards.status, 'baseline-ready')
  assert.equal(dashboard.rateLimit.remaining, 58)
})

test('GitHub client paginates organization repositories within the configured ceiling', async () => {
  const captured = []
  const client = createGitHubClient({
    owner: 'octo-org',
    accountType: 'organization',
    maxRepositories: 150,
    timeoutMs: 2000,
    activityWindowDays: 90,
    now: () => new Date('2026-07-28T12:00:00Z'),
    fetchImpl: async (url) => {
      captured.push(url)
      const page = Number(url.searchParams.get('page'))
      const count = page === 1 ? 100 : 50
      return response({
        body: Array.from({ length: count }, (_, index) =>
          repository({
            name: `repo-${page}-${index}`,
            full_name: `octo-org/repo-${page}-${index}`,
          }),
        ),
      })
    },
  })

  const dashboard = await client.listRepositories()

  assert.equal(captured.length, 2)
  assert.equal(captured[0].pathname, '/orgs/octo-org/repos')
  assert.equal(captured[0].searchParams.get('type'), 'public')
  assert.equal(captured[1].searchParams.get('per_page'), '50')
  assert.equal(dashboard.repositories.length, 150)
  assert.equal(dashboard.repositoryLimitReached, true)
})

test('GitHub client enriches explainable standards and caches successful community profiles', async () => {
  let listRequests = 0
  let profileRequests = 0
  const client = createGitHubClient({
    owner: 'octocat',
    token: 'token-value',
    communityProfilesEnabled: true,
    communityProfileTtlMs: 3600000,
    timeoutMs: 2000,
    activityWindowDays: 90,
    now: () => new Date('2026-07-28T12:00:00Z'),
    fetchImpl: async (url) => {
      if (url.pathname.endsWith('/community/profile')) {
        profileRequests += 1
        return response({
          body: {
            health_percentage: 57,
            files: { readme: { html_url: 'safe' } },
          },
        })
      }
      listRequests += 1
      return response({ body: [repository()] })
    },
  })

  const first = await client.listRepositories()
  const second = await client.listRepositories()
  const standards = first.repositories[0].standards

  assert.equal(listRequests, 2)
  assert.equal(profileRequests, 1)
  assert.equal(first.communityProfiles.available, 1)
  assert.equal(first.communityProfiles.unavailable, 0)
  assert.equal(standards.communityHealthPercentage, 57)
  assert.equal(standards.attentionCount, 4)
  assert.equal(standards.status, 'needs-attention')
  assert.deepEqual(
    standards.checks.filter((check) => check.state === 'fail').map((check) => check.id),
    ['contributing', 'codeOfConduct', 'issueTemplate', 'pullRequestTemplate'],
  )
  assert.equal(first.summary.needsAttention, 1)
  assert.equal(first.summary.failedChecks, 4)
  assert.deepEqual(second.repositories[0].standards, standards)
})

test('GitHub client keeps repositories usable when community enrichment fails', async () => {
  const client = createGitHubClient({
    owner: 'octocat',
    token: 'token-value',
    communityProfilesEnabled: true,
    timeoutMs: 2000,
    activityWindowDays: 90,
    fetchImpl: async (url) =>
      url.pathname.endsWith('/community/profile')
        ? response({ status: 500 })
        : response({ body: [repository()] }),
  })

  const dashboard = await client.listRepositories()

  assert.equal(dashboard.repositories.length, 1)
  assert.equal(dashboard.communityProfiles.available, 0)
  assert.equal(dashboard.communityProfiles.unavailable, 1)
  assert.equal(dashboard.repositories[0].standards.status, 'baseline-ready')
  assert.equal(
    dashboard.repositories[0].standards.checks.filter(
      (check) => check.state === 'unavailable',
    ).length,
    5,
  )
})

test('GitHub client keeps the token server-side and filters requested repositories', async () => {
  let authorization
  const client = createGitHubClient({
    owner: 'octocat',
    token: 'token-value',
    repositoryNames: ['KEEP-ME'],
    timeoutMs: 2000,
    activityWindowDays: 90,
    now: () => new Date('2026-07-28T12:00:00Z'),
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization
      return response({
        body: [repository({ name: 'keep-me' }), repository({ name: 'drop-me' })],
      })
    },
  })

  const dashboard = await client.listRepositories()

  assert.equal(authorization, 'Bearer token-value')
  assert.deepEqual(dashboard.repositories.map((item) => item.name), ['keep-me'])
  assert.deepEqual(dashboard.rateLimit, { limit: null, remaining: null, resetAt: null })
  assert.equal(JSON.stringify(dashboard).includes('token-value'), false)
})

test('GitHub client replaces a non-GitHub repository link with a safe GitHub URL', async () => {
  const client = createGitHubClient({
    owner: 'octocat',
    timeoutMs: 2000,
    activityWindowDays: 90,
    now: () => new Date('2026-07-28T12:00:00Z'),
    fetchImpl: async () =>
      response({
        body: [
          repository({
            name: 'safe-fallback',
            full_name: 'octocat/safe-fallback',
            html_url: 'https://github.com.evil.example/phishing',
          }),
        ],
      }),
  })

  const dashboard = await client.listRepositories()

  assert.equal(dashboard.repositories[0].url, 'https://github.com/octocat/safe-fallback')
})

test('GitHub client maps rate limits to a bounded public error', async () => {
  const client = createGitHubClient({
    owner: 'octocat',
    timeoutMs: 2000,
    activityWindowDays: 90,
    fetchImpl: async () =>
      response({
        status: 403,
        body: { message: 'internal upstream detail' },
        responseHeaders: { 'retry-after': 120, 'x-ratelimit-remaining': 0 },
      }),
  })

  await assert.rejects(client.listRepositories(), (error) => {
    assert.ok(error instanceof GitHubError)
    assert.equal(error.code, 'GITHUB_RATE_LIMITED')
    assert.equal(error.status, 503)
    assert.equal(error.retryAfterSeconds, 120)
    assert.equal(error.message.includes('internal upstream detail'), false)
    return true
  })
})
