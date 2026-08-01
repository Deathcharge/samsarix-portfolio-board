import assert from 'node:assert/strict'
import test from 'node:test'
import { ConfigError, loadConfig } from '../server/config.js'

test('loadConfig provides safe local defaults', () => {
  const config = loadConfig({})

  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 5000)
  assert.equal(config.githubOwner, 'Deathcharge')
  assert.equal(config.githubAccountType, 'user')
  assert.equal(config.githubToken, null)
  assert.equal(config.githubMaxRepositories, 100)
  assert.equal(config.githubCommunityProfile, false)
  assert.deepEqual(config.githubRepositories, [])
  assert.equal(config.cacheTtlMs, 300000)
})

test('loadConfig trims and validates operator settings', () => {
  const config = loadConfig({
    HOST: '0.0.0.0',
    PORT: '8080',
    GITHUB_OWNER: 'octocat',
    GITHUB_ACCOUNT_TYPE: 'organization',
    GITHUB_TOKEN: '  secret  ',
    GITHUB_MAX_REPOSITORIES: '200',
    GITHUB_REPOS: 'Hello-World, Spoon-Knife,Hello-World',
    GITHUB_COMMUNITY_PROFILE_TTL_SECONDS: '7200',
    GITHUB_COMMUNITY_CONCURRENCY: '6',
    ACTIVITY_WINDOW_DAYS: '30',
    CACHE_TTL_SECONDS: '60',
    STALE_MAX_AGE_SECONDS: '600',
    GITHUB_TIMEOUT_MS: '2500',
  })

  assert.equal(config.port, 8080)
  assert.equal(config.githubToken, 'secret')
  assert.equal(config.githubAccountType, 'organization')
  assert.equal(config.githubMaxRepositories, 200)
  assert.equal(config.githubCommunityProfile, true)
  assert.equal(config.githubCommunityProfileTtlMs, 7200000)
  assert.equal(config.githubCommunityConcurrency, 6)
  assert.deepEqual(config.githubRepositories, ['Hello-World', 'Spoon-Knife'])
  assert.equal(config.activityWindowDays, 30)
  assert.equal(config.cacheTtlMs, 60000)
})

test('loadConfig rejects invalid external-input boundaries', () => {
  assert.throws(() => loadConfig({ GITHUB_OWNER: '../secret' }), ConfigError)
  assert.throws(() => loadConfig({ PORT: '70000' }), ConfigError)
  assert.throws(() => loadConfig({ CACHE_TTL_SECONDS: '59' }), ConfigError)
  assert.throws(() => loadConfig({ GITHUB_REPOS: 'valid,not/a/repository' }), ConfigError)
  assert.throws(() => loadConfig({ GITHUB_ACCOUNT_TYPE: 'enterprise' }), ConfigError)
  assert.throws(() => loadConfig({ GITHUB_MAX_REPOSITORIES: '301' }), ConfigError)
  assert.throws(() => loadConfig({ GITHUB_COMMUNITY_PROFILE: 'sometimes' }), ConfigError)
  assert.throws(() => loadConfig({ GITHUB_COMMUNITY_PROFILE: 'true' }), ConfigError)
})
