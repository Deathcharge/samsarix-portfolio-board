import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
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

function repositoryFilter(rawValue) {
  if (!rawValue?.trim()) {
    return []
  }

  const repositories = [...new Set(rawValue.split(',').map((value) => value.trim()).filter(Boolean))]
  if (repositories.length > 100) {
    throw new ConfigError('GITHUB_REPOS cannot contain more than 100 repository names.')
  }

  for (const repository of repositories) {
    if (!repositoryPattern.test(repository)) {
      throw new ConfigError(`GITHUB_REPOS contains an invalid repository name: ${repository}`)
    }
  }

  return repositories
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

  return Object.freeze({
    host,
    port: integerSetting(env, 'PORT', 5000, { minimum: 1, maximum: 65535 }),
    githubOwner: owner,
    githubToken: env.GITHUB_TOKEN?.trim() || null,
    githubRepositories: repositoryFilter(env.GITHUB_REPOS),
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
