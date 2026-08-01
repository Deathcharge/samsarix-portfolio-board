const githubApiBase = 'https://api.github.com'

const coreCheckDefinitions = [
  ['description', 'Description'],
  ['topics', 'Topics'],
  ['license', 'Detected license'],
]

const communityCheckDefinitions = [
  ['readme', 'README'],
  ['contributing', 'Contributing guide'],
  ['codeOfConduct', 'Code of conduct'],
  ['issueTemplate', 'Issue template'],
  ['pullRequestTemplate', 'Pull request template'],
]

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
  if (rawValue == null || rawValue === '') return null
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
  if (explicitDelay != null) return Math.max(1, Math.min(explicitDelay, 3600))
  const resetSeconds = numericHeader(response.headers, 'x-ratelimit-reset')
  if (resetSeconds != null) {
    return Math.max(1, Math.min(Math.ceil(resetSeconds - Date.now() / 1000), 3600))
  }
  return null
}

function normalizeUrl(owner, name, candidate) {
  if (typeof candidate === 'string' && candidate.startsWith('https://github.com/')) return candidate
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
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
  return new GitHubError('GitHub is temporarily unavailable to this dashboard.')
}

async function requestJson(fetchImpl, endpoint, headers, timeoutMs) {
  let response
  try {
    response = await fetchImpl(endpoint, { headers, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new GitHubError('GitHub did not respond before the request timeout.', {
        code: 'GITHUB_TIMEOUT',
        status: 504,
      })
    }
    throw new GitHubError('GitHub could not be reached from the dashboard server.')
  }

  if (!response.ok) throw upstreamError(response)
  try {
    return { body: await response.json(), response }
  } catch {
    throw new GitHubError('GitHub returned a response the dashboard could not read.', {
      code: 'GITHUB_INVALID_RESPONSE',
    })
  }
}

function coreEvidence(repository) {
  return {
    description: typeof repository.description === 'string' && repository.description.trim().length > 0,
    topics: Array.isArray(repository.topics) && repository.topics.length > 0,
    license: Boolean(repository.license),
  }
}

function normalizeCommunityProfile(profile) {
  const files = profile?.files || {}
  return {
    healthPercentage: Number.isFinite(profile?.health_percentage)
      ? profile.health_percentage
      : null,
    readme: Boolean(files.readme),
    contributing: Boolean(files.contributing),
    codeOfConduct: Boolean(files.code_of_conduct || files.code_of_conduct_file),
    issueTemplate: Boolean(files.issue_template),
    pullRequestTemplate: Boolean(files.pull_request_template),
  }
}

function standardsFor(repository, communityProfile) {
  const core = coreEvidence(repository)
  const checks = coreCheckDefinitions.map(([id, label]) => ({
    id,
    label,
    group: 'core',
    state: core[id] ? 'pass' : 'fail',
  }))
  for (const [id, label] of communityCheckDefinitions) {
    checks.push({
      id,
      label,
      group: 'community',
      state: communityProfile == null ? 'unavailable' : communityProfile[id] ? 'pass' : 'fail',
    })
  }

  const attentionCount = checks.filter((check) => check.state === 'fail').length
  const unavailableCount = checks.filter((check) => check.state === 'unavailable').length
  return {
    status:
      attentionCount > 0 ? 'needs-attention' : unavailableCount > 0 ? 'baseline-ready' : 'ready',
    attentionCount,
    passedCount: checks.filter((check) => check.state === 'pass').length,
    unavailableCount,
    communityHealthPercentage: communityProfile?.healthPercentage ?? null,
    checks,
  }
}

function normalizeRepository(repository, owner, activityWindowDays, now, communityProfile) {
  if (!repository || typeof repository.name !== 'string') return null
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
    fullName:
      typeof repository.full_name === 'string' ? repository.full_name : `${owner}/${repository.name}`,
    description:
      typeof repository.description === 'string' ? repository.description.trim().slice(0, 500) : null,
    url: normalizeUrl(owner, repository.name, repository.html_url),
    language: typeof repository.language === 'string' ? repository.language : null,
    topics: Array.isArray(repository.topics)
      ? repository.topics.filter((topic) => typeof topic === 'string').slice(0, 8)
      : [],
    license:
      typeof repository.license?.spdx_id === 'string' ? repository.license.spdx_id : null,
    stars: Number.isFinite(repository.stargazers_count) ? repository.stargazers_count : 0,
    forks: Number.isFinite(repository.forks_count) ? repository.forks_count : 0,
    openIssues: Number.isFinite(repository.open_issues_count) ? repository.open_issues_count : 0,
    pushedAt,
    updatedAt: typeof repository.updated_at === 'string' ? repository.updated_at : null,
    activity,
    standards: standardsFor(repository, communityProfile),
  }
}

function summarize(repositories) {
  return repositories.reduce(
    (summary, repository) => {
      summary.total += 1
      summary[repository.activity] += 1
      summary.stars += repository.stars
      summary.forks += repository.forks
      summary.failedChecks += repository.standards.attentionCount
      if (repository.standards.status === 'needs-attention') summary.needsAttention += 1
      else summary.noKnownGaps += 1
      if (repository.standards.status === 'ready') summary.communityReady += 1
      return summary
    },
    {
      total: 0,
      active: 0,
      quiet: 0,
      archived: 0,
      stars: 0,
      forks: 0,
      needsAttention: 0,
      noKnownGaps: 0,
      communityReady: 0,
      failedChecks: 0,
    },
  )
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

export function createGitHubClient({
  owner,
  accountType = 'user',
  token,
  repositoryNames = [],
  maxRepositories = 100,
  communityProfilesEnabled = false,
  communityProfileTtlMs = 3600000,
  communityConcurrency = 4,
  timeoutMs,
  activityWindowDays,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.')
  const requestedRepositories = new Set(repositoryNames.map((name) => name.toLocaleLowerCase()))
  const communityCache = new Map()
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'samsarix-portfolio-board/1.1',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  async function listRepositoryPages() {
    const repositories = []
    let lastResponse = null
    let page = 1
    while (repositories.length < maxRepositories) {
      const perPage = Math.min(100, maxRepositories - repositories.length)
      const path =
        accountType === 'organization'
          ? `/orgs/${encodeURIComponent(owner)}/repos`
          : `/users/${encodeURIComponent(owner)}/repos`
      const endpoint = new URL(path, githubApiBase)
      endpoint.searchParams.set('per_page', String(perPage))
      endpoint.searchParams.set('page', String(page))
      endpoint.searchParams.set('sort', 'pushed')
      endpoint.searchParams.set('direction', 'desc')
      endpoint.searchParams.set('type', accountType === 'organization' ? 'public' : 'owner')
      const result = await requestJson(fetchImpl, endpoint, headers, timeoutMs)
      if (!Array.isArray(result.body)) {
        throw new GitHubError('GitHub returned an unexpected repository response.', {
          code: 'GITHUB_INVALID_RESPONSE',
        })
      }
      lastResponse = result.response
      repositories.push(...result.body)
      if (result.body.length < perPage) break
      page += 1
    }
    return {
      repositories: repositories.slice(0, maxRepositories),
      response: lastResponse,
      repositoryLimitReached: repositories.length >= maxRepositories,
    }
  }

  async function communityProfileFor(repository, currentTime) {
    const cacheKey = repository.name.toLocaleLowerCase()
    const cached = communityCache.get(cacheKey)
    if (cached && currentTime.getTime() - cached.cachedAt < communityProfileTtlMs) {
      return cached.profile
    }
    const endpoint = new URL(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository.name)}/community/profile`,
      githubApiBase,
    )
    try {
      const { body } = await requestJson(fetchImpl, endpoint, headers, timeoutMs)
      const profile = normalizeCommunityProfile(body)
      communityCache.set(cacheKey, { profile, cachedAt: currentTime.getTime() })
      return profile
    } catch {
      return null
    }
  }

  return {
    async listRepositories() {
      const pageResult = await listRepositoryPages()
      const currentTime = now()
      const selected = pageResult.repositories.filter(
        (repository) =>
          requestedRepositories.size === 0 ||
          requestedRepositories.has(repository.name?.toLocaleLowerCase()),
      )
      const communityProfiles = communityProfilesEnabled
        ? await mapWithConcurrency(selected, communityConcurrency, (repository) =>
            communityProfileFor(repository, currentTime),
          )
        : selected.map(() => null)
      const repositories = selected
        .map((repository, index) =>
          normalizeRepository(
            repository,
            owner,
            activityWindowDays,
            currentTime,
            communityProfiles[index],
          ),
        )
        .filter(Boolean)
      const availableProfiles = communityProfiles.filter(Boolean).length

      return {
        owner,
        accountType,
        activityWindowDays,
        fetchedAt: currentTime.toISOString(),
        repositoryLimit: maxRepositories,
        repositoryLimitReached: pageResult.repositoryLimitReached,
        repositories,
        summary: summarize(repositories),
        communityProfiles: {
          enabled: communityProfilesEnabled,
          available: availableProfiles,
          unavailable: selected.length - availableProfiles,
          cacheTtlSeconds: communityProfilesEnabled ? communityProfileTtlMs / 1000 : null,
        },
        rateLimit: pageResult.response
          ? rateLimitFrom(pageResult.response.headers)
          : { limit: null, remaining: null, resetAt: null },
      }
    },
  }
}
