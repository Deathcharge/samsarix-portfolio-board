import { loadEnvFile } from 'node:process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { createDashboardService } from './dashboard-service.js'
import { createGitHubClient } from './github-client.js'

function loadLocalEnvironment() {
  try {
    loadEnvFile()
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

export function startServer({ env = process.env, logger = console } = {}) {
  const config = loadConfig(env)
  const githubClient = createGitHubClient({
    owner: config.githubOwner,
    accountType: config.githubAccountType,
    token: config.githubToken,
    repositoryNames: config.githubRepositories,
    maxRepositories: config.githubMaxRepositories,
    communityProfilesEnabled: config.githubCommunityProfile,
    communityProfileTtlMs: config.githubCommunityProfileTtlMs,
    communityConcurrency: config.githubCommunityConcurrency,
    timeoutMs: config.githubTimeoutMs,
    activityWindowDays: config.activityWindowDays,
  })
  const dashboardService = createDashboardService({
    githubClient,
    cacheTtlMs: config.cacheTtlMs,
    staleMaxAgeMs: config.staleMaxAgeMs,
  })
  const app = createApp({ config, dashboardService, logger })
  const server = app.listen(config.port, config.host, () => {
    logger.info?.(`Samsarix Portfolio Board listening on http://${config.host}:${config.port}`)
  })

  let stopping = false
  const shutdown = (signal) => {
    if (stopping) {
      return
    }

    stopping = true
    logger.info?.(`Received ${signal}; closing the dashboard server.`)
    const forcedShutdown = setTimeout(() => {
      logger.error?.('Graceful shutdown timed out; closing remaining connections.')
      server.closeAllConnections?.()
    }, 10000)
    forcedShutdown.unref()

    server.close((error) => {
      clearTimeout(forcedShutdown)
      if (error) {
        logger.error?.('Dashboard shutdown failed.', { error: error.message })
        process.exitCode = 1
      }
    })
    server.closeIdleConnections?.()
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  return server
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMainModule) {
  try {
    loadLocalEnvironment()
    startServer()
  } catch (error) {
    console.error(`Unable to start Samsarix Portfolio Board: ${error.message}`)
    process.exitCode = 1
  }
}
