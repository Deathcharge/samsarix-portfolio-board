import assert from 'node:assert/strict'
import test from 'node:test'
import { createDashboardService } from '../server/dashboard-service.js'

function payload() {
  return {
    owner: 'octocat',
    activityWindowDays: 90,
    fetchedAt: '2026-07-28T12:00:00.000Z',
    repositories: [],
    summary: { total: 0, active: 0, quiet: 0, archived: 0, stars: 0, forks: 0 },
    rateLimit: { limit: 60, remaining: 59, resetAt: null },
  }
}

test('dashboard service caches and deduplicates concurrent refreshes', async () => {
  let requests = 0
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  const service = createDashboardService({
    githubClient: {
      async listRepositories() {
        requests += 1
        await pending
        return payload()
      },
    },
    cacheTtlMs: 1000,
    staleMaxAgeMs: 10000,
    now: () => 100,
  })

  const first = service.getDashboard()
  const second = service.getDashboard()
  release()
  const [firstResult, secondResult] = await Promise.all([first, second])
  const cachedResult = await service.getDashboard()

  assert.equal(requests, 1)
  assert.equal(firstResult.meta.cacheState, 'refreshed')
  assert.equal(secondResult.meta.cacheState, 'refreshed')
  assert.equal(cachedResult.meta.cacheState, 'fresh')
})

test('dashboard service serves a labelled stale snapshot after an upstream failure', async () => {
  let currentTime = 0
  let shouldFail = false
  const service = createDashboardService({
    githubClient: {
      async listRepositories() {
        if (shouldFail) {
          throw new Error('GitHub is unavailable')
        }
        return payload()
      },
    },
    cacheTtlMs: 1000,
    staleMaxAgeMs: 10000,
    now: () => currentTime,
  })

  await service.getDashboard()
  currentTime = 2000
  shouldFail = true
  const result = await service.getDashboard()

  assert.equal(result.meta.stale, true)
  assert.equal(result.meta.warning, 'GitHub is unavailable')
})

test('dashboard service rejects failures after the stale safety window', async () => {
  let currentTime = 0
  let shouldFail = false
  const service = createDashboardService({
    githubClient: {
      async listRepositories() {
        if (shouldFail) {
          throw new Error('GitHub is unavailable')
        }
        return payload()
      },
    },
    cacheTtlMs: 1000,
    staleMaxAgeMs: 1500,
    now: () => currentTime,
  })

  await service.getDashboard()
  currentTime = 2000
  shouldFail = true

  await assert.rejects(service.getDashboard(), /GitHub is unavailable/)
})
