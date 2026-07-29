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
  })
  assert.equal(dashboard.rateLimit.remaining, 58)
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
