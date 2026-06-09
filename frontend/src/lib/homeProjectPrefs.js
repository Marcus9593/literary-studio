const VIEW_KEY = 'wenjiang.home.viewMode'
const PIN_KEY = 'wenjiang.home.pinnedIds'
const RECENT_KEY = 'wenjiang.home.recentOpen'

export function loadViewMode() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function saveViewMode(mode) {
  try {
    localStorage.setItem(VIEW_KEY, mode === 'list' ? 'list' : 'grid')
  } catch {
    /* ignore */
  }
}

export function loadPinnedIds() {
  try {
    const raw = localStorage.getItem(PIN_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function savePinnedIds(ids) {
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify([...new Set(ids)]))
  } catch {
    /* ignore */
  }
}

export function togglePinned(id) {
  const set = new Set(loadPinnedIds())
  if (set.has(id)) set.delete(id)
  else set.add(id)
  const next = [...set]
  savePinnedIds(next)
  return next
}

export function loadRecentOpenMap() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const obj = raw ? JSON.parse(raw) : {}
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

/** 最近打开的项目 id（用于首页「继续创作」） */
export function loadMostRecentOpenId() {
  return loadRecentOpenIds(1)[0] || null
}

/** @returns {string[]} project ids most recent first */
export function loadRecentOpenIds(max = 8) {
  const map = loadRecentOpenMap()
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, max)
}

export function recordRecentOpen(projectId) {
  if (!projectId) return
  try {
    const map = loadRecentOpenMap()
    map[projectId] = Date.now()
    const entries = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
    localStorage.setItem(RECENT_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    /* ignore */
  }
}
