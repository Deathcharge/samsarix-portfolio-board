const githubApiBase = 'https://api.github.com'

export class GitHubError extends Error {
  constructor(message, { code = 'GITHUB_UNAVAILABLE', status = 502, retryAfterSeconds = null } = {}) {
    super(message)
    this.name = 'GitHubError'
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function numericHeader(headers, name) {
  const rawValue = headers.get(name)
  if (rawValue == null || rawValue === '') {
    return null
  }

  const value = Number(rawValue)
  return Number.isFinite(value) ? value : null
}

function rateLimitFrom(headers) {
  const resetSeconds = numericHeader(headers, 'x-ratelimit-reset')
  return {
    limit: numericHeader(headers, 'x-ratelimit-limit'),
    remaining: numericHeader(headers, 'x-ratelimit-remaining'),
    resetAt: resetSeconds ? new Date(resetSeconds * 1000).toISOString() : null,
  }
}

function retryDelay(response) {
  const explicitDelay = numericHeader(response.headers, 'retry-after')
  if (explicitDelay != null) {
    return Math.max(1, Math.min(explicitDelay, 3600))
  }

  const resetSeconds = numericHeader(response.headers, 'x-ratelimit-reset')
  if (resetSeconds != null) {
    return Math.max(1, Math.min(Math.ceil(resetSeconds - Date.now() / 1000), 3600))
  }

  return null
}

function normalizeUrl(owner, name, candidate) {
  if (typeof candidate === 'string' && candidate.startsWith('https://github.com/')) {
    return candidate
  }

  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
}

function normalizeRepository(repository, owner, activityWindowDays, now) {
  if (!repository || typeof repository.name !== 'string') {
    return null
  }

  const pushedAt = typeof repository.pushed_at === 'string' ? repository.pushed_at : null
  const pushedAtMs = pushedAt ? Date.parse(pushedAt) : Number.NaN
  const activeAfter = now.getTime() - activityWindowDays * 24 * 60 * 60 * 1000
  const activity = repository.archived
    ? 'archived'
    : Number.isFinite(pushedAtMs) && pushedAtMs >= activeAfter
      ? 'active'
      : 'quiet'

  return {
    name: repository.name,
    fullName: typeof repository.full_name === 'string' ? repository.full_name : `${owner}/${repository.name}`,
    description:
      typeof repository.description === 'string' ? repository.description.trim().slice(0, 500) : null,
    url: normalizeUrl(owner, repository.name, repository.html_url),
    language: typeof repository.language === 'string' ? repository.language : null,
    topics: Array.isArray(repository.topics)
      ? repository.topics.filter((topic) => typeof topic === 'string').slice(0, 8)
      : [],
    stars: Number.isFinite(repository.stargazers_count) ? repository.stargazers_count : 0,
    forks: Number.isFinite(repository.forks_count) ? repository.forks_count : 0,
    openIssues: Number.isFinite(repository.open_issues_count) ? repository.open_issues_count : 0,
    pushedAt,
    updatedAt: typeof repository.updated_at === 'string' ? repository.updated_at : null,
    activity,
  }
}

function summarize(repositories) {
  return repositories.reduce(
    (summary, repository) => {
      summary.total += 1
      summary[repository.activity] += 1
      summary.stars += repository.stars
      summary.forks += repository.forks
      return summary
    },
    { total: 0, active: 0, quiet: 0, archived: 0, stars: 0, forks: 0 },
  )
}

function upstreamError(response) {
  const remaining = numericHeader(response.headers, 'x-ratelimit-remaining')
  if (response.status === 403 || response.status === 429 || remaining === 0) {
    return new GitHubError('GitHub rate limited this dashboard. Try again after the reset window.', {
      code: 'GITHUB_RATE_LIMITED',
      status: 503,
      retryAfterSeconds: retryDelay(response),
    })
  }

  if (response.status === 401) {
    return new GitHubError('GitHub rejected the configured token. Check its value and permissions.', {
      code: 'GITHUB_AUTH_FAILED',
      status: 502,
    })
  }

  if (response.status === 404) {
    return new GitHubError('The configured GitHub account could not be found.', {
      code: 'GITHUB_OWNER_NOT_FOUND',
      status: 502,
    })
  }

  return new GitHubError('GitHub is temporarily unavailable to this dashboard.', {
    code: 'GITHUB_UNAVAILABLE',
    status: 502,
  })
}

export function createGitHubClient({
  owner,
  token,
  repositoryNames = [],
  timeoutMs,
  activityWindowDays,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation is required.')
  }

  const requestedRepositories = new Set(repositoryNames.map((name) => name.toLocaleLowerCase()))

  return {
    async listRepositories() {
      const endpoint = new URL(`/users/${encodeURIComponent(owner)}/repos`, githubApiBase)
      endpoint.searchParams.set('per_page', '100')
      endpoint.searchParams.set('sort', 'pushed')
      endpoint.searchParams.set('direction', 'desc')
      endpoint.searchParams.set('type', 'owner')

      const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'samsarix-portfolio-board/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      let response
      try {
        response = await fetchImpl(endpoint, {
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          throw new GitHubError('GitHub did not respond before the request timeout.', {
            code: 'GITHUB_TIMEOUT',
            status: 504,
          })
        }

        throw new GitHubError('GitHub could not be reached from the dashboard server.')
      }

      if (!response.ok) {
        throw upstreamError(response)
      }

      let body
      try {
        body = await response.json()
      } catch {
        throw new GitHubError('GitHub returned a response the dashboard could not read.', {
          code: 'GITHUB_INVALID_RESPONSE',
        })
      }

      if (!Array.isArray(body)) {
        throw new GitHubError('GitHub returned an unexpected repository response.', {
          code: 'GITHUB_INVALID_RESPONSE',
        })
      }

      const currentTime = now()
      const repositories = body
        .map((repository) => normalizeRepository(repository, owner, activityWindowDays, currentTime))
        .filter(Boolean)
        .filter(
          (repository) =>
            requestedRepositories.size === 0 ||
            requestedRepositories.has(repository.name.toLocaleLowerCase()),
        )

      return {
        owner,
        activityWindowDays,
        fetchedAt: currentTime.toISOString(),
        repositories,
        summary: summarize(repositories),
        rateLimit: rateLimitFrom(response.headers),
      }
    },
  }
}
