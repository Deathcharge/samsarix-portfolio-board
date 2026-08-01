import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import { GitHubError } from './github-client.js'

function setSecurityHeaders(_request, response, next) {
  response.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "base-uri 'none'",
      "connect-src 'self'",
      "font-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
    ].join('; '),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  })
  next()
}

export function createApp({ config, dashboardService, logger = console }) {
  const app = express()
  const clientIndex = join(config.clientDistDirectory, 'index.html')
  const clientBuildAvailable = existsSync(clientIndex)

  app.disable('x-powered-by')
  app.use(setSecurityHeaders)

  app.get('/api/health', (_request, response) => {
    response.set('Cache-Control', 'no-store').json({
      status: 'ok',
      service: 'samsarix-portfolio-board',
      version: config.appVersion,
      sourceRevision: config.sourceRevision,
      timestamp: new Date().toISOString(),
      data: dashboardService.getStatus(),
    })
  })

  app.get('/api/dashboard', async (_request, response, next) => {
    try {
      const dashboard = await dashboardService.getDashboard()
      response.set('Cache-Control', 'private, no-store').json(dashboard)
    } catch (error) {
      next(error)
    }
  })

  app.use('/api', (_request, response) => {
    response.status(404).set('Cache-Control', 'no-store').json({
      error: { code: 'NOT_FOUND', message: 'The requested API endpoint does not exist.' },
    })
  })

  if (clientBuildAvailable) {
    app.use(
      express.static(config.clientDistDirectory, {
        etag: true,
        index: false,
        maxAge: '1y',
        immutable: true,
        setHeaders(response, filePath) {
          if (filePath.endsWith('.html')) {
            response.setHeader('Cache-Control', 'no-cache')
          }
        },
      }),
    )
  }

  app.use((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.status(404).type('text/plain').send('Not found')
      return
    }

    if (!clientBuildAvailable) {
      response
        .status(503)
        .set('Cache-Control', 'no-store')
        .type('text/plain')
        .send('Client build is missing. Run npm run build before npm start.')
      return
    }

    response.set('Cache-Control', 'no-cache').sendFile(clientIndex)
  })

  app.use((error, _request, response, _next) => {
    void _next
    const isGitHubError = error instanceof GitHubError
    const status = isGitHubError ? error.status : 500
    const code = isGitHubError ? error.code : 'INTERNAL_ERROR'
    const message = isGitHubError
      ? error.message
      : 'The dashboard could not complete this request.'

    logger.error?.('Dashboard request failed.', {
      code,
      status,
      error: isGitHubError ? error.name : error?.message,
    })

    if (isGitHubError && error.retryAfterSeconds) {
      response.set('Retry-After', String(error.retryAfterSeconds))
    }

    response.status(status).set('Cache-Control', 'no-store').json({
      error: { code, message },
    })
  })

  return app
}
