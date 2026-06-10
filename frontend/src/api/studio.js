import { request } from './client.js';
import { getJob } from './files.js';


function normalizeDashboard(raw) {
  if (!raw) return null
  if (raw.schema === 'writing_dashboard') return raw

  const projects = (raw.active_projects || []).map((p) => ({
    id: p.id,
    title: p.title,
    total_words: p.words || 0,
    manuscript_count: p.manuscripts || 0,
    today_chapters_updated: 0,
    today_words_updated: 0,
    archived: false,
  }))

  return {
    schema: 'writing_dashboard',
    date: new Date().toISOString().slice(0, 10),
    summary: {
      projects_count: raw.projects_count ?? 0,
      projects_active_today: 0,
      manuscripts_count: raw.manuscripts_count ?? 0,
      total_words: raw.total_words ?? 0,
      today_chapters_updated: 0,
      today_words_updated: 0,
    },
    projects,
    activity_7d: (raw.activity_7d || []).map((d) => ({
      date: d.date,
      label: d.label,
      chapters_updated: d.chapters_updated ?? 0,
      words_updated: d.words_updated ?? 0,
      projects_active: d.projects_active ?? d.project_updates ?? 0,
    })),
    _legacy: true,
  }
}

export const getAiUsage = () => request('/usage')
export const getProjectAiUsage = (projectId) => request(`/projects/${projectId}/usage`)

/** 创作看板数据（走 /studio/overview，兼容新旧后端） */
export async function getDashboard() {
  const raw = await request('/studio/overview')
  return normalizeDashboard(raw)
}

/** @deprecated 请用 getDashboard */
export const getStudioOverview = () => request('/studio/overview')
/** @deprecated — 后端已重定向至 versions；请用 listVersions */
export const listStudioSnapshots = (projectId = '') =>
  request(`/studio/snapshots${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`)
export const createStudioSnapshot = (body = {}) =>
  request('/studio/snapshots', { method: 'POST', body: JSON.stringify(body) })
export const deleteStudioSnapshot = (id, projectId) =>
  request(`/studio/snapshots/${id}?project_id=${encodeURIComponent(projectId)}`, { method: 'DELETE' })
export const getStudioSnapshotDiff = (projectId, snapshotId) =>
  request(`/studio/snapshots/${snapshotId}/diff?project_id=${encodeURIComponent(projectId)}`)
export const restoreStudioSnapshot = (projectId, snapshotId) =>
  request(`/studio/snapshots/${snapshotId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  })
export const listStudioAssets = (projectId = '') =>
  request(`/studio/assets${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`)
export const createStudioAsset = (body = {}) =>
  request('/studio/assets', { method: 'POST', body: JSON.stringify(body) })
export const deleteStudioAsset = (id, projectId) =>
  request(`/studio/assets/${id}?project_id=${encodeURIComponent(projectId)}`, { method: 'DELETE' })
export const updateStudioAsset = (id, body = {}) =>
  request(`/studio/assets/${id}`, { method: 'PUT', body: JSON.stringify(body) })
/** @deprecated V2.8 — use getMeasurementReview */
export const getStudioReview = (projectId = '') =>
  request(`/studio/review${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`)

// ── Measurement layer (Sprint 1) ──
export const getMeasurementReview = (projectId) =>
  request(`/projects/${projectId}/measurement/review`)
export const runMeasurementReview = (projectId) =>
  request(`/projects/${projectId}/measurement/review/run`, { method: 'POST' })
export const getMeasurementHealth = (projectId) =>
  request(`/projects/${projectId}/measurement/health`)
/** @deprecated V2.8 — use getMeasurementReview / runMeasurementReview */
export const runStudioReview = (projectId) =>
  request('/studio/review/run', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  })

export function pollJob(jobId, onUpdate, intervalMs = 1200) {
  let active = true
  const tick = async () => {
    if (!active) return
    try {
      const job = await getJob(jobId)
      onUpdate(job)
      if (job.status === 'queued' || job.status === 'running') {
        setTimeout(tick, intervalMs)
      }
    } catch {
      setTimeout(tick, intervalMs * 2)
    }
  }
  tick()
  return () => {
    active = false
  }
}
