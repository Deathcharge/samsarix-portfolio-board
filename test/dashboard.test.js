import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activityLabel,
  buildExplorerSearch,
  createPortfolioReport,
  filterAndSortRepositories,
  formatDate,
  readExplorerState,
  repositoriesToCsv,
  standardsLabel,
} from '../client/src/dashboard.js'

const repositories = [
  {
    name: 'Zulu',
    description: 'Quiet Python tool',
    language: 'Python',
    topics: ['automation'],
    activity: 'quiet',
    stars: 2,
    pushedAt: '2025-01-01T00:00:00Z',
    standards: { attentionCount: 2, status: 'needs-attention', checks: [] },
  },
  {
    name: 'Alpha',
    description: 'Active JavaScript tool',
    language: 'JavaScript',
    topics: ['portfolio'],
    activity: 'active',
    stars: 10,
    pushedAt: '2026-07-01T00:00:00Z',
    standards: {
      attentionCount: 0,
      status: 'ready',
      checks: [{ id: 'readme', label: 'README', state: 'pass' }],
    },
  },
]

test('repository explorer filters across metadata and sorts predictably', () => {
  assert.deepEqual(
    filterAndSortRepositories(repositories).map((repository) => repository.name),
    ['Alpha', 'Zulu'],
  )
  assert.deepEqual(
    filterAndSortRepositories(repositories, { query: 'python' }).map(
      (repository) => repository.name,
    ),
    ['Zulu'],
  )
  assert.deepEqual(
    filterAndSortRepositories(repositories, { activity: 'active', sort: 'stars' }).map(
      (repository) => repository.name,
    ),
    ['Alpha'],
  )
  assert.deepEqual(
    filterAndSortRepositories(repositories, {
      attention: 'needs-attention',
      sort: 'attention',
    }).map((repository) => repository.name),
    ['Zulu'],
  )
  assert.deepEqual(
    filterAndSortRepositories(repositories, { query: 'readme' }).map(
      (repository) => repository.name,
    ),
    [],
  )
})

test('explorer state is shareable and rejects unsupported values', () => {
  const search = buildExplorerSearch({
    query: 'docs',
    activity: 'quiet',
    attention: 'needs-attention',
    sort: 'attention',
  })
  assert.equal(
    search,
    '?query=docs&activity=quiet&attention=needs-attention&sort=attention',
  )
  assert.deepEqual(readExplorerState(search), {
    query: 'docs',
    activity: 'quiet',
    attention: 'needs-attention',
    sort: 'attention',
  })
  assert.deepEqual(readExplorerState('?activity=invalid&sort=unknown'), {
    query: '',
    activity: 'all',
    attention: 'all',
    sort: 'recent',
  })
})

test('exports are deterministic and protect spreadsheet users from formula injection', () => {
  const exportRepositories = [
    {
      ...repositories[0],
      name: '=WEBSERVICE("https://example.invalid")',
      fullName: '=WEBSERVICE("https://example.invalid")',
      url: 'https://github.com/octocat/safe',
      openIssues: 3,
      forks: 1,
      license: 'Apache-2.0',
    },
  ]
  const csv = repositoriesToCsv(exportRepositories)
  assert.match(csv, /"'=WEBSERVICE\(""https:\/\/example\.invalid""\)"/)
  assert.match(csv, /"Needs attention"|"needs-attention"/)

  const report = createPortfolioReport(
    { owner: 'octocat', accountType: 'user', fetchedAt: '2026-08-01T00:00:00Z' },
    exportRepositories,
    { attention: 'all' },
  )
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.repositories.length, 1)
})

test('dashboard display helpers avoid fabricated dates and labels', () => {
  assert.equal(formatDate(null), 'No push recorded')
  assert.equal(activityLabel('archived'), 'Archived')
  assert.equal(activityLabel('unexpected'), 'Unknown')
  assert.equal(standardsLabel('needs-attention'), 'Needs attention')
  assert.equal(standardsLabel('unexpected'), 'Checks unavailable')
})
