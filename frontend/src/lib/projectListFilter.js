import { creationModeOf, workTypeOf } from './projectProfile.js'
import { loadRecentOpenMap } from './homeProjectPrefs.js'

export const PROJECT_SORT_OPTIONS = [
  { id: 'updated_desc', label: '最近更新' },
  { id: 'recent_open', label: '最近打开' },
  { id: 'updated_asc', label: '最早更新' },
  { id: 'title_asc', label: '标题 A→Z' },
  { id: 'title_desc', label: '标题 Z→A' },
  { id: 'words_desc', label: '字数最多' },
  { id: 'chapters_desc', label: '章节最多' },
]

export const DEFAULT_PROJECT_SORT = 'updated_desc'
export const HOME_SORT_STORAGE_KEY = 'wenjiang.home.projectSort'

export const EMPTY_FILTERS = {
  workType: '',
  creationMode: '',
  genre: '',
  status: '',
  showArchived: false,
}

export function loadProjectSort() {
  try {
    const v = localStorage.getItem(HOME_SORT_STORAGE_KEY)
    if (v && PROJECT_SORT_OPTIONS.some((o) => o.id === v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_PROJECT_SORT
}

export function saveProjectSort(sortId) {
  try {
    localStorage.setItem(HOME_SORT_STORAGE_KEY, sortId)
  } catch {
    /* ignore */
  }
}

function searchBlob(project) {
  const wt = workTypeOf(project)
  const cm = creationModeOf(project)
  return [
    project.title,
    project.genre,
    project.card_summary,
    project.summary,
    wt.label,
    cm.label,
    project.stats?.latest_title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function filterProjectsBySearch(projects, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return projects
  return projects.filter((p) => searchBlob(p).includes(q))
}

export function filterProjectsByArchive(projects, showArchived) {
  if (showArchived) {
    return projects.filter((p) => Boolean(p.archived))
  }
  return projects.filter((p) => !p.archived)
}

export function filterProjectsByChips(projects, filters = EMPTY_FILTERS) {
  let list = projects
  if (filters.workType) {
    list = list.filter((p) => (p.work_type || 'novel_long') === filters.workType)
  }
  if (filters.creationMode) {
    list = list.filter((p) => (p.creation_mode || 'scratch') === filters.creationMode)
  }
  if (filters.genre) {
    list = list.filter((p) => p.genre === filters.genre)
  }
  if (filters.status) {
    list = list.filter((p) => (p.status || 'writing') === filters.status)
  }
  return list
}

function ts(project) {
  const t = new Date(project.updated_at || project.created_at || 0).getTime()
  return Number.isNaN(t) ? 0 : t
}

export function sortProjects(projects, sortId, recentOpenMap = null) {
  const recent = recentOpenMap || loadRecentOpenMap()
  const list = [...projects]
  switch (sortId) {
    case 'recent_open':
      return list.sort(
        (a, b) => (recent[b.id] || 0) - (recent[a.id] || 0) || ts(b) - ts(a),
      )
    case 'updated_asc':
      return list.sort((a, b) => ts(a) - ts(b))
    case 'title_asc':
      return list.sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh-CN'))
    case 'title_desc':
      return list.sort((a, b) => String(b.title).localeCompare(String(a.title), 'zh-CN'))
    case 'words_desc':
      return list.sort(
        (a, b) => (b.stats?.total_words || 0) - (a.stats?.total_words || 0),
      )
    case 'chapters_desc':
      return list.sort(
        (a, b) => (b.stats?.manuscript_count || 0) - (a.stats?.manuscript_count || 0),
      )
    case 'updated_desc':
    default:
      return list.sort((a, b) => ts(b) - ts(a))
  }
}

export function applyPinnedOrder(projects, pinnedIds = []) {
  if (!pinnedIds.length) return projects
  const pinSet = new Set(pinnedIds)
  const pinned = []
  const rest = []
  for (const p of projects) {
    if (pinSet.has(p.id)) pinned.push(p)
    else rest.push(p)
  }
  const pinIndex = new Map(pinnedIds.map((id, i) => [id, i]))
  pinned.sort((a, b) => (pinIndex.get(a.id) ?? 0) - (pinIndex.get(b.id) ?? 0))
  return [...pinned, ...rest]
}

export function processProjectList(projects, { query, sortId, filters, pinnedIds }) {
  let list = filterProjectsByArchive(projects, filters.showArchived)
  list = filterProjectsBySearch(list, query)
  list = filterProjectsByChips(list, filters)
  list = sortProjects(list, sortId)
  list = applyPinnedOrder(list, pinnedIds)
  return list
}

export function countActiveProjects(projects) {
  return projects.filter((p) => !p.archived).length
}

export function countArchivedProjects(projects) {
  return projects.filter((p) => p.archived).length
}

export function collectGenres(projects) {
  const set = new Set()
  for (const p of projects) {
    if (p.genre) set.add(p.genre)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function countChipFilters(filters = EMPTY_FILTERS) {
  let n = 0
  if (filters.workType) n += 1
  if (filters.creationMode) n += 1
  if (filters.genre) n += 1
  if (filters.status) n += 1
  return n
}

export function hasActiveFilters(filters, searchQuery) {
  return Boolean(
    String(searchQuery || '').trim()
    || filters.workType
    || filters.creationMode
    || filters.genre
    || filters.status,
  )
}

export function filterAndSortProjects(projects, query, sortId) {
  return processProjectList(projects, {
    query,
    sortId,
    filters: EMPTY_FILTERS,
    pinnedIds: [],
  })
}
