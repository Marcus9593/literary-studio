import { request } from './client.js';

export const listProjects = () => request('/projects')
export const createProject = (body) =>
  request('/projects', { method: 'POST', body: JSON.stringify(body) })
export const updateProject = (id, body) =>
  request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const getProject = (id) => request(`/projects/${id}`)
export const getTakeoverReport = (id) => request(`/projects/${id}/takeover`)
export const deleteProject = (id) =>
  request(`/projects/${id}`, { method: 'DELETE' })
export const getChapter = (projectId, filename) =>
  request(`/projects/${projectId}/chapters/${encodeURIComponent(filename)}`)

export const searchProjectManuscripts = (projectId, q, { regex = false, limit = 80 } = {}) =>
  request(
    `/projects/${projectId}/search?q=${encodeURIComponent(q)}${regex ? '&regex=1' : ''}&limit=${limit}`,
  )

export const saveChapter = (projectId, filename, content) =>
  request(`/projects/${projectId}/chapters/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })

export const createManuscript = (projectId, title, content) =>
  request(`/projects/${projectId}/manuscripts`, {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  })

export const deleteChapter = (projectId, filename) =>
  request(`/projects/${projectId}/chapters/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  })

export const listProjectFiles = (projectId, category) =>
  request(`/projects/${projectId}/files/${category}`)

export const getProjectFile = (projectId, category, filename) =>
  request(`/projects/${projectId}/files/${category}/${encodeURIComponent(filename)}`)

export const saveProjectFile = (projectId, category, filename, content) =>
  request(`/projects/${projectId}/files/${category}/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
