export const PROJECT_STATUSES = ['writing', 'completed', 'paused', 'reviewing']

export function normalizeProjectStatus(value) {
  const s = String(value || 'writing')
  return PROJECT_STATUSES.includes(s) ? s : 'writing'
}
