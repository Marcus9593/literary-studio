import { API } from './client.js'
import { authHeaders } from '../auth/token.js'

async function guestbookRequest(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.error || err.detail || err.message || `请求失败 ${res.status}`)
  }
  return res.json()
}

export const listGuestbookPosts = (page = 1, limit = 20) =>
  guestbookRequest(`/guestbook?page=${page}&limit=${limit}`)
export const createGuestbookPost = (formData) =>
  guestbookRequest('/guestbook', { method: 'POST', body: formData })
export const updateGuestbookPost = (postId, data) =>
  guestbookRequest(`/guestbook/${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
export const deleteGuestbookPost = (postId) =>
  guestbookRequest(`/guestbook/${encodeURIComponent(postId)}`, { method: 'DELETE' })
