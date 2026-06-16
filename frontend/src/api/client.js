import { authHeaders } from '../auth/token.js'

export const API = '/api'

const DEFAULT_TIMEOUT_MS = 30000
const HEALTH_TIMEOUT_MS = 5000

function connectionErrorMessage() {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (host === '127.0.0.1' || host === 'localhost') {
    return '无法连接应用后端，请完全退出并重新打开文匠 Studio'
  }
  return '无法连接服务器，请确认已在 literary-studio 目录运行 ./start.sh'
}

export async function request(path, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options
  const controller = new AbortController()
  const timer = timeout > 0
    ? setTimeout(() => controller.abort(), timeout)
    : null

  let res
  try {
    res = await fetch(`${API}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: authHeaders({ 'Content-Type': 'application/json', ...fetchOptions.headers }),
    })
  } catch (err) {
    const msg = String(err?.message || '')
    if (err?.name === 'AbortError') {
      throw new Error(`请求超时：${path}`)
    }
    if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new Error(connectionErrorMessage())
    }
    throw err
  } finally {
    if (timer) clearTimeout(timer)
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

export const getHealth = () => request('/health', { timeout: HEALTH_TIMEOUT_MS })
