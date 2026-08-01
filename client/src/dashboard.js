const activityRank = { active: 0, quiet: 1, archived: 2 }
const allowedActivity = new Set(['all', 'active', 'quiet', 'archived'])
const allowedAttention = new Set(['all', 'needs-attention', 'no-known-gaps'])
const allowedSort = new Set(['recent', 'attention', 'stars', 'name'])

export function filterAndSortRepositories(
  repositories,
  { query = '', activity = 'all', attention = 'all', sort = 'recent' } = {},
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = repositories.filter((repository) => {
    if (activity !== 'all' && repository.activity !== activity) return false
    if (attention === 'needs-attention' && repository.standards?.attentionCount === 0) return false
    if (attention === 'no-known-gaps' && repository.standards?.attentionCount > 0) return false
    if (!normalizedQuery) return true

    const failedChecks = (repository.standards?.checks || [])
      .filter((check) => check.state === 'fail')
      .map((check) => check.label)
    return [
      repository.name,
      repository.description,
      repository.language,
      repository.license,
      ...(repository.topics || []),
      ...failedChecks,
    ]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  })

  return filtered.toSorted((left, right) => {
    if (sort === 'name') return left.name.localeCompare(right.name)
    if (sort === 'stars') return right.stars - left.stars || left.name.localeCompare(right.name)
    if (sort === 'attention') {
      return (
        (right.standards?.attentionCount || 0) - (left.standards?.attentionCount || 0) ||
        Date.parse(right.pushedAt || 0) - Date.parse(left.pushedAt || 0)
      )
    }
    const activityDifference = activityRank[left.activity] - activityRank[right.activity]
    if (activityDifference !== 0) return activityDifference
    return Date.parse(right.pushedAt || 0) - Date.parse(left.pushedAt || 0)
  })
}

export function readExplorerState(search = '') {
  const parameters = new URLSearchParams(search)
  const activity = parameters.get('activity') || 'all'
  const attention = parameters.get('attention') || 'all'
  const sort = parameters.get('sort') || 'recent'
  return {
    query: (parameters.get('query') || '').slice(0, 200),
    activity: allowedActivity.has(activity) ? activity : 'all',
    attention: allowedAttention.has(attention) ? attention : 'all',
    sort: allowedSort.has(sort) ? sort : 'recent',
  }
}

export function buildExplorerSearch({ query = '', activity = 'all', attention = 'all', sort = 'recent' }) {
  const parameters = new URLSearchParams()
  if (query.trim()) parameters.set('query', query.trim())
  if (activity !== 'all') parameters.set('activity', activity)
  if (attention !== 'all') parameters.set('attention', attention)
  if (sort !== 'recent') parameters.set('sort', sort)
  const value = parameters.toString()
  return value ? `?${value}` : ''
}

function safeCsvValue(value) {
  const rawValue = value == null ? '' : String(value)
  const safeValue = /^[\t\r\n ]*[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue
  return `"${safeValue.replaceAll('"', '""')}"`
}

export function repositoriesToCsv(repositories) {
  const headers = [
    'Repository',
    'Activity',
    'Standard status',
    'Attention count',
    'Failed checks',
    'Unavailable checks',
    'Language',
    'License',
    'Stars',
    'Forks',
    'Open issues & PRs',
    'Last push',
    'URL',
  ]
  const rows = repositories.map((repository) => {
    const checks = repository.standards?.checks || []
    return [
      repository.fullName || repository.name,
      repository.activity,
      repository.standards?.status,
      repository.standards?.attentionCount || 0,
      checks.filter((check) => check.state === 'fail').map((check) => check.label).join('; '),
      checks
        .filter((check) => check.state === 'unavailable')
        .map((check) => check.label)
        .join('; '),
      repository.language,
      repository.license,
      repository.stars,
      repository.forks,
      repository.openIssues,
      repository.pushedAt,
      repository.url,
    ]
  })
  return [headers, ...rows].map((row) => row.map(safeCsvValue).join(',')).join('\r\n')
}

export function createPortfolioReport(dashboard, repositories, filters) {
  return {
    schemaVersion: 1,
    product: 'Samsarix Portfolio Board',
    owner: dashboard.owner,
    accountType: dashboard.accountType,
    fetchedAt: dashboard.meta?.fetchedAt || dashboard.fetchedAt,
    filters,
    repositories,
  }
}

export function formatDate(value, locale) {
  if (!value || Number.isNaN(Date.parse(value))) return 'No push recorded'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function activityLabel(activity) {
  return { active: 'Active', quiet: 'Quiet', archived: 'Archived' }[activity] || 'Unknown'
}

export function standardsLabel(status) {
  return {
    'needs-attention': 'Needs attention',
    'baseline-ready': 'Core checks pass',
    ready: 'Community ready',
  }[status] || 'Checks unavailable'
}
