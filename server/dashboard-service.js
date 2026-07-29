function decorate(payload, { cacheState, cachedAt, cacheTtlMs, warning = null }) {
  return {
    ...payload,
    meta: {
      cacheState,
      stale: cacheState === 'stale',
      fetchedAt: payload.fetchedAt,
      expiresAt: new Date(cachedAt + cacheTtlMs).toISOString(),
      warning,
    },
  }
}

export function createDashboardService({
  githubClient,
  cacheTtlMs,
  staleMaxAgeMs,
  now = () => Date.now(),
}) {
  let cache = null
  let inFlight = null

  async function refresh() {
    const payload = await githubClient.listRepositories()
    const cachedAt = now()
    cache = { payload, cachedAt }
    return decorate(payload, { cacheState: 'refreshed', cachedAt, cacheTtlMs })
  }

  return {
    async getDashboard() {
      const currentTime = now()
      if (cache && currentTime - cache.cachedAt < cacheTtlMs) {
        return decorate(cache.payload, {
          cacheState: 'fresh',
          cachedAt: cache.cachedAt,
          cacheTtlMs,
        })
      }

      if (!inFlight) {
        inFlight = refresh().finally(() => {
          inFlight = null
        })
      }

      try {
        return await inFlight
      } catch (error) {
        const cacheAge = cache ? now() - cache.cachedAt : Number.POSITIVE_INFINITY
        if (cache && cacheAge <= staleMaxAgeMs) {
          return decorate(cache.payload, {
            cacheState: 'stale',
            cachedAt: cache.cachedAt,
            cacheTtlMs,
            warning: error.message,
          })
        }

        throw error
      }
    },

    getStatus() {
      return {
        cacheReady: Boolean(cache),
        refreshing: Boolean(inFlight),
        cacheAgeSeconds: cache ? Math.max(0, Math.floor((now() - cache.cachedAt) / 1000)) : null,
      }
    },
  }
}
