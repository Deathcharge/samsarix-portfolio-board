const activityRank = {
  active: 0,
  quiet: 1,
  archived: 2,
}

export function filterAndSortRepositories(
  repositories,
  { query = '', activity = 'all', sort = 'recent' } = {},
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  const filtered = repositories.filter((repository) => {
    if (activity !== 'all' && repository.activity !== activity) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return [
      repository.name,
      repository.description,
      repository.language,
      ...(repository.topics || []),
    ]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  })

  return filtered.toSorted((left, right) => {
    if (sort === 'name') {
      return left.name.localeCompare(right.name)
    }

    if (sort === 'stars') {
      return right.stars - left.stars || left.name.localeCompare(right.name)
    }

    const activityDifference = activityRank[left.activity] - activityRank[right.activity]
    if (activityDifference !== 0) {
      return activityDifference
    }

    return Date.parse(right.pushedAt || 0) - Date.parse(left.pushedAt || 0)
  })
}

export function formatDate(value, locale) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return 'No push recorded'
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function activityLabel(activity) {
  return {
    active: 'Active',
    quiet: 'Quiet',
    archived: 'Archived',
  }[activity] || 'Unknown'
}
