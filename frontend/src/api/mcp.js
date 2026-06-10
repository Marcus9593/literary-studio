import { request } from './client.js';

export const getMcpOverview = () => request('/mcp/overview')
export const listMcpServers = () => request('/mcp/servers')
export const setMcpServerEnabled = (serverId, enabled) =>
  request(`/mcp/servers/${encodeURIComponent(serverId)}/enabled`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  })
export const listMcpServerTools = (serverId) =>
  request(`/mcp/servers/${encodeURIComponent(serverId)}/tools`)
export const callMcpTool = (body) =>
  request('/mcp/call', { method: 'POST', body: JSON.stringify(body) })
export const checkMcpHealth = (serverId = null) =>
  request('/mcp/health', {
    method: 'POST',
    body: JSON.stringify(serverId ? { server_id: serverId } : {}),
  })
export const getMcpStudioConfig = () => request('/mcp/studio')
export const saveMcpStudioConfig = (content) =>
  request('/mcp/studio', { method: 'PUT', body: JSON.stringify({ content }) })
export const refreshMcpRuntime = () =>
  request('/mcp/runtime/refresh', { method: 'POST' })
export const searchMcpRegistry = (q, { limit = 20, cursor = '' } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) })
  if (q) params.set('q', q)
  if (cursor) params.set('cursor', cursor)
  return request(`/mcp/registry/search?${params}`)
}
export const getMcpRegistryMeta = () => request('/mcp/registry/meta')
export const installMcpFromRegistry = (body) =>
  request('/mcp/registry/install', { method: 'POST', body: JSON.stringify(body) })
