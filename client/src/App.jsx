import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  activityLabel,
  filterAndSortRepositories,
  formatDate,
} from './dashboard.js'
import './App.css'

class DashboardError extends Error {
  constructor(message, code = 'REQUEST_FAILED') {
    super(message)
    this.name = 'DashboardError'
    this.code = code
  }
}

async function fetchDashboard(signal) {
  let response

  try {
    response = await fetch('/api/dashboard', {
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error
    }

    throw new DashboardError(
      navigator.onLine
        ? 'The dashboard server could not be reached.'
        : 'You appear to be offline.',
      'NETWORK_ERROR',
    )
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new DashboardError(
      body?.error?.message || 'Repository data is temporarily unavailable.',
      body?.error?.code,
    )
  }

  if (!body || !Array.isArray(body.repositories)) {
    throw new DashboardError('The server returned an invalid dashboard response.')
  }

  return body
}

function SummaryCard({ label, value, detail, tone = 'default' }) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <p className="summary-card__label">{label}</p>
      <p className="summary-card__value">{value}</p>
      <p className="summary-card__detail">{detail}</p>
    </article>
  )
}

function RepositoryCard({ repository }) {
  return (
    <article className="repository-card">
      <div className="repository-card__heading">
        <div>
          <p className="repository-card__eyebrow">{repository.language || 'Unspecified'}</p>
          <h2>{repository.name}</h2>
        </div>
        <span className={`activity activity--${repository.activity}`}>
          {activityLabel(repository.activity)}
        </span>
      </div>

      <p className="repository-card__description">
        {repository.description || 'No repository description has been added yet.'}
      </p>

      {repository.topics?.length > 0 && (
        <ul className="topics" aria-label={`${repository.name} topics`}>
          {repository.topics.slice(0, 4).map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      )}

      <dl className="repository-card__metrics">
        <div>
          <dt>Stars</dt>
          <dd>{repository.stars.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Forks</dt>
          <dd>{repository.forks.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Open issues &amp; PRs</dt>
          <dd>{repository.openIssues.toLocaleString()}</dd>
        </div>
      </dl>

      <div className="repository-card__footer">
        <p>
          Last push <time dateTime={repository.pushedAt || undefined}>{formatDate(repository.pushedAt)}</time>
        </p>
        <a href={repository.url} target="_blank" rel="noreferrer">
          Open on GitHub <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  )
}

function LoadingState() {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <div>
        <h2>Loading repository activity</h2>
        <p>Fetching a cached portfolio snapshot from the dashboard server.</p>
      </div>
    </div>
  )
}

export default function App() {
  const [dashboard, setDashboard] = useState(null)
  const [requestState, setRequestState] = useState('loading')
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [activity, setActivity] = useState('all')
  const [sort, setSort] = useState('recent')
  const activeRequest = useRef(null)

  const load = useCallback(async ({ preserveData = false } = {}) => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setRequestState(preserveData ? 'refreshing' : 'loading')
    setError(null)

    try {
      const nextDashboard = await fetchDashboard(controller.signal)
      setDashboard(nextDashboard)
      setRequestState('ready')
    } catch (nextError) {
      if (nextError.name === 'AbortError') {
        return
      }

      setError(nextError)
      setRequestState('error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    activeRequest.current = controller

    fetchDashboard(controller.signal)
      .then((nextDashboard) => {
        setDashboard(nextDashboard)
        setRequestState('ready')
      })
      .catch((nextError) => {
        if (nextError.name !== 'AbortError') {
          setError(nextError)
          setRequestState('error')
        }
      })

    return () => controller.abort()
  }, [])

  const repositories = useMemo(
    () =>
      filterAndSortRepositories(dashboard?.repositories || [], {
        query,
        activity,
        sort,
      }),
    [activity, dashboard?.repositories, query, sort],
  )

  const hasFilters = Boolean(query.trim()) || activity !== 'all'
  const summary = dashboard?.summary

  return (
    <div className="page-shell">
      <header className="masthead">
        <a className="brand" href="#main" aria-label="Samsarix Portfolio Board home">
          <span className="brand__mark" aria-hidden="true">S</span>
          <span>Samsarix Portfolio Board</span>
        </a>
        <div className="masthead__meta">
          <span className="source-dot" aria-hidden="true" />
          Read-only GitHub activity
        </div>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero__copy">
            <p className="eyebrow">Repository portfolio</p>
            <h1 id="page-title">
              A clear view of what is <span>moving.</span>
            </h1>
            <p className="hero__lede">
              Recent pushes, quiet projects, and archived work across{' '}
              <strong>{dashboard?.owner || 'one GitHub account'}</strong>—without inventing build or deployment health.
            </p>
          </div>

          <div className="snapshot-card">
            <p className="snapshot-card__label">Snapshot</p>
            <p className="snapshot-card__time">
              {dashboard ? new Date(dashboard.meta.fetchedAt).toLocaleString() : 'Waiting for data'}
            </p>
            <p className="snapshot-card__detail">
              {dashboard?.rateLimit?.remaining != null
                ? `${dashboard.rateLimit.remaining.toLocaleString()} GitHub requests remain in this window.`
                : 'GitHub rate-limit details will appear after the first response.'}
            </p>
            <button
              className="button button--secondary"
              type="button"
              disabled={requestState === 'loading' || requestState === 'refreshing'}
              onClick={() => load({ preserveData: Boolean(dashboard) })}
            >
              {requestState === 'refreshing' ? 'Checking…' : 'Check for updates'}
            </button>
          </div>
        </section>

        {dashboard?.meta.stale && (
          <aside className="notice notice--warning" role="status">
            <span aria-hidden="true">!</span>
            <div>
              <strong>Showing a saved snapshot.</strong>
              <p>{dashboard.meta.warning || 'GitHub could not be reached during the latest refresh.'}</p>
            </div>
          </aside>
        )}

        {dashboard && requestState === 'error' && (
          <aside className="notice notice--error" role="alert">
            <span aria-hidden="true">×</span>
            <div>
              <strong>The latest check failed; the previous snapshot is still visible.</strong>
              <p>{error?.message || 'The dashboard server could not be reached.'}</p>
              <button
                className="notice__action"
                type="button"
                onClick={() => load({ preserveData: true })}
              >
                Try again
              </button>
            </div>
          </aside>
        )}

        {dashboard && summary && (
          <section className="summary-grid" aria-label="Portfolio summary">
            <SummaryCard label="Repositories" value={summary.total} detail="Visible in this portfolio" />
            <SummaryCard label="Active" value={summary.active} detail={`Pushed within ${dashboard.activityWindowDays} days`} tone="active" />
            <SummaryCard label="Quiet" value={summary.quiet} detail={`No push within ${dashboard.activityWindowDays} days`} tone="quiet" />
            <SummaryCard label="Stars" value={summary.stars.toLocaleString()} detail="Across visible repositories" tone="accent" />
          </section>
        )}

        {dashboard && (
          <section className="explorer" aria-labelledby="explorer-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Explore</p>
                <h2 id="explorer-title">Repository activity</h2>
              </div>
              <p aria-live="polite">
                Showing {repositories.length} of {dashboard.repositories.length}
              </p>
            </div>

            <div className="toolbar">
              <label className="search-field">
                <span className="visually-hidden">Search repositories</span>
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, topic, or language"
                />
              </label>

              <label className="select-field">
                <span>Activity</span>
                <select value={activity} onChange={(event) => setActivity(event.target.value)}>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="quiet">Quiet</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label className="select-field">
                <span>Sort</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="recent">Activity</option>
                  <option value="stars">Stars</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>

            {repositories.length > 0 ? (
              <div className="repository-grid">
                {repositories.map((repository) => (
                  <RepositoryCard key={repository.fullName} repository={repository} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span aria-hidden="true">◇</span>
                <h3>{hasFilters ? 'No repositories match' : 'No repositories to show'}</h3>
                <p>
                  {hasFilters
                    ? 'Try a different search or activity filter.'
                    : 'This account has no visible repositories, or the configured repository filter matched none.'}
                </p>
                {hasFilters && (
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setActivity('all')
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {!dashboard && requestState === 'loading' && <LoadingState />}

        {!dashboard && requestState === 'error' && (
          <div className="state-panel state-panel--error" role="alert">
            <span className="state-panel__icon" aria-hidden="true">×</span>
            <div>
              <p className="eyebrow">Could not load the portfolio</p>
              <h2>{error?.message || 'Repository data is unavailable.'}</h2>
              <p>
                Check the server configuration and GitHub status, then try again.
                {error?.code ? ` Error code: ${error.code}.` : ''}
              </p>
              <button className="button" type="button" onClick={() => load()}>
                Try again
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="page-footer">
        <div>
          <p>Activity is derived from GitHub push timestamps; it is not build, security, or deployment health.</p>
          <p className="page-footer__copyright">© 2026 Samsarix LLC. Licensed under Apache-2.0.</p>
        </div>
        <nav className="page-footer__links" aria-label="Project links">
          <a href="mailto:contact@samsarix.com">Contact</a>
          <a href="mailto:support@samsarix.com">Support</a>
          <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer">
            Apache-2.0 <span aria-hidden="true">↗</span>
          </a>
          <a href="https://github.com/Deathcharge/samsarix-portfolio-board" target="_blank" rel="noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </footer>
    </div>
  )
}
