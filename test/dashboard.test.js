import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activityLabel,
  filterAndSortRepositories,
  formatDate,
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
  },
  {
    name: 'Alpha',
    description: 'Active JavaScript tool',
    language: 'JavaScript',
    topics: ['portfolio'],
    activity: 'active',
    stars: 10,
    pushedAt: '2026-07-01T00:00:00Z',
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
})

test('dashboard display helpers avoid fabricated dates and labels', () => {
  assert.equal(formatDate(null), 'No push recorded')
  assert.equal(activityLabel('archived'), 'Archived')
  assert.equal(activityLabel('unexpected'), 'Unknown')
})
