import { request } from './client.js';

// ── Sessions ──

export const listSessions = (projectId) => request(`/projects/${projectId}/sessions`)
export const createSession = (projectId, title, options = {}) =>
  request(`/projects/${projectId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ title, bound_filename: options.bound_filename ?? null }),
  })
export const focusSession = (projectId, body) =>
  request(`/projects/${projectId}/sessions/focus`, { method: 'POST', body: JSON.stringify(body) })
export const getSession = (projectId, sessionId) =>
  request(`/projects/${projectId}/sessions/${sessionId}`)
export const activateSession = (projectId, sessionId) =>
  request(`/projects/${projectId}/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: true }),
  })
export const getSessionMemory = (projectId, sessionId) =>
  request(`/projects/${projectId}/sessions/${sessionId}/memory`)
export const deleteSession = (projectId, sessionId) =>
  request(`/projects/${projectId}/sessions/${sessionId}`, { method: 'DELETE' })
export const clearSessionMessages = (projectId, sessionId) =>
  request(`/projects/${projectId}/sessions/${sessionId}/messages`, { method: 'DELETE' })
