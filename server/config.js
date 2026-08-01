import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const packageMetadata = JSON.parse(
  readFileSync(join(moduleDirectory, '..', 'package.json'), { encoding: 'utf8' }),
)
const ownerPattern = /^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/
const repositoryPattern = /^[A-Za-z0-9._-]{1,100}$/

export class ConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConfigError'
  }
}

function integerSetting(env, name, defaultValue, { minimum, maximum }) {
  const rawValue = env[name]
  if (rawValue == null || String(rawValue).trim() === '') {
    return defaultValue
  }

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ConfigError(`${name} must be an integer between ${minimum} and ${maximum}.`)
  }

  return value
}

function repositoryFilter(rawValue, maximum) {
  if (!rawValue?.trim()) {
    return []
  }

  const repositories = [...new Set(rawValue.split(',').map((value) => value.trim()).filter(Boolean))]
  if (repositories.length > maximum) {
    throw new ConfigError(`GITHUB_REPOS cannot contain more than ${maximum} repository names.`)
  }

  for (const repository of repositories) {
    if (!repositoryPattern.test(repository)) {
      throw new ConfigError(`GITHUB_REPOS contains an invalid repository name: ${repository}`)
    }
  }

  return repositories
}

function enumSetting(env, name, defaultValue, allowedValues) {
  const value = (env[name] || defaultValue).trim().toLocaleLowerCase()
  if (!allowedValues.includes(value)) {
    throw new ConfigError(`${name} must be one of: ${allowedValues.join(', ')}.`)
  }

  return value
}

function booleanSetting(env, name, defaultValue) {
  const rawValue = env[name]
  if (rawValue == null || String(rawValue).trim() === '') {
    return defaultValue
  }

  const value = String(rawValue).trim().toLocaleLowerCase()
  if (value === 'true') return true
  if (value === 'false') return false
  throw new ConfigError(`${name} must be true or false.`)
}

export function loadConfig(env = process.env) {
  const owner = (env.GITHUB_OWNER || 'Deathcharge').trim()
  if (!ownerPattern.test(owner)) {
    throw new ConfigError('GITHUB_OWNER must be a valid GitHub account name.')
  }

  const host = (env.HOST || '127.0.0.1').trim()
  if (!host || /[\s/]/.test(host)) {
    throw new ConfigError('HOST must be a hostname or IP address without whitespace or a URL scheme.')
  }

  const githubToken = env.GITHUB_TOKEN?.trim() || null
  const githubMaxRepositories = integerSetting(env, 'GITHUB_MAX_REPOSITORIES', 100, {
    minimum: 1,
    maximum: 300,
  })
  const githubCommunityProfile = booleanSetting(env, 'GITHUB_COMMUNITY_PROFILE', Boolean(githubToken))
  if (githubCommunityProfile && !githubToken) {
    throw new ConfigError(
      'GITHUB_COMMUNITY_PROFILE=true requires GITHUB_TOKEN so enrichment cannot exhaust the public rate limit.',
    )
  }

  const sourceRevision = env.SOURCE_REVISION?.trim() || null
  if (sourceRevision && !/^[A-Za-z0-9._/-]{1,100}$/.test(sourceRevision)) {
    throw new ConfigError('SOURCE_REVISION contains unsupported characters or is longer than 100 characters.')
  }

  return Object.freeze({
    appVersion: packageMetadata.version,
    sourceRevision,
    host,
    port: integerSetting(env, 'PORT', 5000, { minimum: 1, maximum: 65535 }),
    githubOwner: owner,
    githubAccountType: enumSetting(env, 'GITHUB_ACCOUNT_TYPE', 'user', ['user', 'organization']),
    githubToken,
    githubMaxRepositories,
    githubRepositories: repositoryFilter(env.GITHUB_REPOS, githubMaxRepositories),
    githubCommunityProfile,
    githubCommunityProfileTtlMs:
      integerSetting(env, 'GITHUB_COMMUNITY_PROFILE_TTL_SECONDS', 3600, {
        minimum: 900,
        maximum: 86400,
      }) * 1000,
    githubCommunityConcurrency: integerSetting(env, 'GITHUB_COMMUNITY_CONCURRENCY', 4, {
      minimum: 1,
      maximum: 10,
    }),
    githubTimeoutMs: integerSetting(env, 'GITHUB_TIMEOUT_MS', 8000, {
      minimum: 1000,
      maximum: 30000,
    }),
    activityWindowDays: integerSetting(env, 'ACTIVITY_WINDOW_DAYS', 90, {
      minimum: 1,
      maximum: 3650,
    }),
    cacheTtlMs:
      integerSetting(env, 'CACHE_TTL_SECONDS', 300, { minimum: 60, maximum: 3600 }) * 1000,
    staleMaxAgeMs:
      integerSetting(env, 'STALE_MAX_AGE_SECONDS', 86400, {
        minimum: 300,
        maximum: 604800,
      }) * 1000,
    clientDistDirectory: join(moduleDirectory, '..', 'client', 'dist'),
  })
}
