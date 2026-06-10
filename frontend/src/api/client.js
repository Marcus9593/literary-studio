import { authHeaders } from '../auth/token.js'

export const API = '/api'

export async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: authHeaders({ 'Content-Type': 'application/json', ...options.headers }),
    })
  } catch (err) {
    const msg = String(err?.message || '')
    if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new Error('无法连接服务器，请确认已在 literary-studio 目录运行 ./start.sh')
    }
    throw err
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.error || err.detail || err.message || `请求失败 ${res.status}`)
  }
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res
}

export const getHealth = () => request('/health')