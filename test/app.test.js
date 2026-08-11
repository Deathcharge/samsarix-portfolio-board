import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from '../server/app.js'
import { GitHubError } from '../server/github-client.js'

async function withServer(app, callback) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const address = server.address()

  try {
    await callback(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

function config(overrides = {}) {
  return {
    appVersion: '1.1.0',
    sourceRevision: 'abc1234',
    clientDistDirectory: 'Z:\\missing-client-build',
    trustProxyHops: 0,
    requestRateLimitMax: 300,
    requestRateLimitWindowMs: 60000,
    ...overrides,
  }
}

function logger() {
  return { error() {}, info() {} }
}

test('API health is honest about app liveness and cache state', async () => {
  const app = createApp({
    config: config(),
    logger: logger(),
    dashboardService: {
      getStatus: () => ({ cacheReady: false, refreshing: false, cacheAgeSeconds: null }),
      getDashboard: async () => ({ repositories: [] }),
    },
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.service, 'samsarix-portfolio-board')
    assert.equal(body.version, '1.1.0')
    assert.equal(body.sourceRevision, 'abc1234')
    assert.equal(body.status, 'ok')
    assert.equal(body.data.cacheReady, false)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('x-powered-by'), null)
  })
})

test('dashboard endpoint returns the service contract without browser caching', async () => {
  const expected = { owner: 'octocat', repositories: [], meta: { stale: false } }
  const app = createApp({
    config: config(),
    logger: logger(),
    dashboardService: {
      getStatus: () => ({}),
      getDashboard: async () => expected,
    },
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/dashboard`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control'), /no-store/)
    assert.deepEqual(await response.json(), expected)
  })
})

test('dashboard endpoint returns structured bounded upstream errors', async () => {
  const app = createApp({
    config: config(),
    logger: logger(),
    dashboardService: {
      getStatus: () => ({}),
      async getDashboard() {
        throw new GitHubError('Try after the reset window.', {
          code: 'GITHUB_RATE_LIMITED',
          status: 503,
          retryAfterSeconds: 45,
        })
      },
    },
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/dashboard`)
    const body = await response.json()

    assert.equal(response.status, 503)
    assert.equal(response.headers.get('retry-after'), '45')
    assert.deepEqual(body, {
      error: { code: 'GITHUB_RATE_LIMITED', message: 'Try after the reset window.' },
    })
  })
})

test('unknown API routes stay JSON and a missing client build is actionable', async () => {
  const app = createApp({
    config: config(),
    logger: logger(),
    dashboardService: { getStatus: () => ({}), getDashboard: async () => ({}) },
  })

  await withServer(app, async (baseUrl) => {
    const missingApi = await fetch(`${baseUrl}/api/unknown`)
    assert.equal(missingApi.status, 404)
    assert.equal((await missingApi.json()).error.code, 'NOT_FOUND')

    const missingClient = await fetch(baseUrl)
    assert.equal(missingClient.status, 503)
    assert.match(await missingClient.text(), /npm run build/)
  })
})

test('request limiter blocks repeated SPA file access and preserves normal responses', async () => {
  const clientDirectory = mkdtempSync(join(tmpdir(), 'samsarix-client-'))
  writeFileSync(join(clientDirectory, 'index.html'), '<!doctype html><title>Samsarix</title>')

  try {
    const app = createApp({
      config: config({
        clientDistDirectory: clientDirectory,
        requestRateLimitMax: 10,
      }),
      logger: logger(),
      dashboardService: { getStatus: () => ({}), getDashboard: async () => ({}) },
    })

    await withServer(app, async (baseUrl) => {
      for (let index = 0; index < 10; index += 1) {
        const response = await fetch(`${baseUrl}/route-${index}`)
        assert.equal(response.status, 200)
        assert.match(await response.text(), /Samsarix/)
      }

      const blocked = await fetch(`${baseUrl}/blocked`)
      assert.equal(blocked.status, 429)
      assert.match(await blocked.text(), /Too many requests/)
      assert.equal(blocked.headers.get('cache-control'), 'no-store')
      assert.ok(blocked.headers.get('ratelimit'))
      assert.ok(blocked.headers.get('retry-after'))
    })
  } finally {
    rmSync(clientDirectory, { recursive: true, force: true })
  }
})
