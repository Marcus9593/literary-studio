import { request } from './client.js';

export const listVersions = (projectId) =>
  request(`/projects/${encodeURIComponent(projectId)}/versions`)
export const getVersion = (projectId, versionId, { includeFiles = false } = {}) =>
  request(`/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}${includeFiles ? '?include_files=1' : ''}`)
export const createVersion = (projectId, body = {}) =>
  request(`/projects/${encodeURIComponent(projectId)}/versions/create`, { method: 'POST', body: JSON.stringify(body) })
export const deleteVersion = (projectId, versionId) =>
  request(`/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`, { method: 'DELETE' })
export const getVersionDiff = (projectId, versionId) =>
  request(`/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/diff`)
export const restoreVersion = (projectId, versionId) =>
  request(`/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/restore`, { method: 'POST' })
