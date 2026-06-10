import { request } from './client.js';

// ── Auth ──
export const login = (username, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
export const register = (body) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify(body) })
export const fetchMe = () => request('/auth/me')
export const listUsers = () => request('/auth/users')
export const createUser = (body) =>
  request('/auth/users', { method: 'POST', body: JSON.stringify(body) })
export const updateUser = (id, body) =>
  request(`/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteUser = (id) =>
  request(`/auth/users/${id}`, { method: 'DELETE' })
export const getProjectShares = (projectId) =>
  request(`/projects/${projectId}/shares`)
export const updateProjectShares = (projectId, shares) =>
  request(`/projects/${projectId}/shares`, {
    method: 'PUT',
    body: JSON.stringify({ shares }),
  })