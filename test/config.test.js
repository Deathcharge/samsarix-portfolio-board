import assert from 'node:assert/strict'
import test from 'node:test'
import { ConfigError, loadConfig } from '../server/config.js'

test('loadConfig provides safe local defaults', () => {
  const config = loadConfig({})

  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 5000)
  assert.equal(config.githubOwner, 'Deathcharge')
  assert.equal(config.githubToken, null)
  assert.deepEqual(config.githubRepositories, [])
  assert.equal(config.cacheTtlMs, 300000)
})

test('loadConfig trims and validates operator settings', () => {
  const config = loadConfig({
    HOST: '0.0.0.0',
    PORT: '8080',
    GITHUB_OWNER: 'octocat',
    GITHUB_TOKEN: '  secret  ',
    GITHUB_REPOS: 'Hello-World, Spoon-Knife,Hello-World',
    ACTIVITY_WINDOW_DAYS: '30',
    CACHE_TTL_SECONDS: '60',
    STALE_MAX_AGE_SECONDS: '600',
    GITHUB_TIMEOUT_MS: '2500',
  })

  assert.equal(config.port, 8080)
  assert.equal(config.githubToken, 'secret')
  assert.deepEqual(config.githubRepositories, ['Hello-World', 'Spoon-Knife'])
  assert.equal(config.activityWindowDays, 30)
  assert.equal(config.cacheTtlMs, 60000)
})

test('loadConfig rejects invalid external-input boundaries', () => {
  assert.throws(() => loadConfig({ GITHUB_OWNER: '../secret' }), ConfigError)
  assert.throws(() => loadConfig({ PORT: '70000' }), ConfigError)
  assert.throws(() => loadConfig({ CACHE_TTL_SECONDS: '59' }), ConfigError)
  assert.throws(() => loadConfig({ GITHUB_REPOS: 'valid,not/a/repository' }), ConfigError)
})
