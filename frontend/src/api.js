import { authHeaders } from './auth/token.js'

const API = '/api'

async function request(path, options = {}) {
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
export const getSettings = () => request('/models')
export const saveSettings = (body) =>
  request('/settings', { method: 'PUT', body: JSON.stringify(body) })

export const listModels = () => request('/models')
export const createModel = (body) =>
  request('/models', { method: 'POST', body: JSON.stringify(body) })
export const updateModel = (id, body) =>
  request(`/models/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const deleteModel = (id) =>
  request(`/models/${id}`, { method: 'DELETE' })
export const activateModel = (id) =>
  request(`/models/${id}/activate`, { method: 'POST' })
export const testModel = (id) =>
  request(`/models/${id}/test`, { method: 'POST' })
export const testModelConfig = (body) =>
  request('/models/test', { method: 'POST', body: JSON.stringify(body) })
export const importCcSwitch = () => request('/models/import/cc-switch')

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

/** @deprecated 工作台已改用 WebSocket；保留供脚本/测试 */
export const getChat = (projectId) => request(`/projects/${projectId}/chat`)
/** @deprecated 工作台已改用 WebSocket */
export const sendChat = (projectId, message) =>
  request(`/projects/${projectId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
/** @deprecated 工作台已改用 WebSocket */
export const clearChat = (projectId) =>
  request(`/projects/${projectId}/chat`, { method: 'DELETE' })

/** @deprecated 工作台已改用 WebSocket 写稿任务 */
export const writeChapter = (projectId, body) =>
  request(`/projects/${projectId}/write`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

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
export const renameSession = (projectId, sessionId, title) =>
  request(`/projects/${projectId}/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
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

export const getJob = (jobId) => request(`/jobs/${jobId}`)

export const getUploadFormats = () => request('/upload/formats')

/** 支持 zip / docx / pdf / md / txt 等，后端自动转为 Markdown */
export async function uploadProjectFile(projectId, file, subdir = '正文') {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(
    `${API}/projects/${projectId}/upload?subdir=${encodeURIComponent(subdir)}`,
    { method: 'POST', body: form, headers: authHeaders() },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = err.detail
    const msg = Array.isArray(detail)
      ? detail.map((d) => d.msg || d).join('; ')
      : detail || '上传失败'
    throw new Error(msg)
  }
  return res.json()
}

/** @deprecated 使用 uploadProjectFile */
export const uploadProjectZip = uploadProjectFile

export function downloadProjectUrl(projectId, format = 'zip') {
  return `${API}/projects/${projectId}/download?format=${encodeURIComponent(format)}`
}

export function downloadChapterUrl(projectId, filename, format = 'md') {
  return `${API}/projects/${projectId}/chapters/${encodeURIComponent(filename)}/export?format=${encodeURIComponent(format)}`
}

export const getExportFormats = () => request('/export/formats')

/** 触发浏览器下载（二进制或文本附件） */
export async function triggerDownload(apiPath, suggestedFilename = '') {
  let res
  try {
    res = await fetch(`${API}${apiPath}`, { headers: authHeaders() })
  } catch (err) {
    const msg = String(err?.message || '')
    if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new Error('无法连接服务器，请确认已运行 ./start.sh')
    }
    throw err
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.error || err.detail || err.message || `导出失败 ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedFilename || ''
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const getToolsOverview = () => request('/tools/overview')
export const listInstalledSkills = () => request('/tools/skills')
export const searchSkills = (q, page = 1, limit = 20) =>
  request(`/tools/skills/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`)
export const installSkill = (body) =>
  request('/tools/skills/install', { method: 'POST', body: JSON.stringify(body) })
export const updateSkillsCatalogue = () =>
  request('/tools/skills/catalogue/update', { method: 'POST' })
export const setLiteraryWriterRoot = (path) =>
  request('/tools/literary-writer', { method: 'PUT', body: JSON.stringify({ path }) })
export const getDefaultSkill = () => request('/tools/default-skill')
export const setDefaultSkill = (body) =>
  request('/tools/default-skill', { method: 'PUT', body: JSON.stringify(body) })
export const getDefaultSkillCapabilities = () => request('/tools/skills/capabilities/default')
export const getSkillCapabilities = (skillId, subSkill = '') =>
  request(`/tools/skills/${encodeURIComponent(skillId)}/capabilities${subSkill ? `?sub_skill=${encodeURIComponent(subSkill)}` : ''}`)
export const invokeSkill = (body) =>
  request('/tools/skills/invoke', { method: 'POST', body: JSON.stringify(body) })
export const invokeProjectSkill = (projectId, body) =>
  request(`/projects/${projectId}/skill/invoke`, { method: 'POST', body: JSON.stringify(body) })
export const runProjectSkillPreflight = (projectId, skillId = '') =>
  request(`/projects/${projectId}/skill/preflight${skillId ? `?skill_id=${encodeURIComponent(skillId)}` : ''}`)

// ── MCP ──
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

// ── Guestbook ──
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
export const createGuestbookReply = (postId, formData) =>
  guestbookRequest(`/guestbook/${encodeURIComponent(postId)}/replies`, {
    method: 'POST',
    body: formData,
  })
export const deleteGuestbookPost = (postId) =>
  guestbookRequest(`/guestbook/${encodeURIComponent(postId)}`, { method: 'DELETE' })
export const deleteGuestbookReply = (postId, replyId) =>
  guestbookRequest(
    `/guestbook/${encodeURIComponent(postId)}/replies/${encodeURIComponent(replyId)}`,
    { method: 'DELETE' },
  )

// ── Versions (V2.8) ──
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

// ── Dashboard（创作看板）──

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

// ── WebSocket for streaming chat / writing ──

export { createWebSocket } from './services/ws.ts'

// ── Story OS (V2.5) ──

export const getStoryKnowledge = (projectId) =>
  request(`/projects/${projectId}/story/knowledge`)
export const updateStoryKnowledge = (projectId, patch) =>
  request(`/projects/${projectId}/story/knowledge`, { method: 'PUT', body: JSON.stringify(patch) })
export const getStoryConsistency = (projectId) =>
  request(`/projects/${projectId}/story/consistency`)
export const rebuildStoryKnowledge = (projectId) =>
  request(`/projects/${projectId}/story/knowledge/rebuild`, { method: 'POST' })
export const getStorySummaries = (projectId) =>
  request(`/projects/${projectId}/story/summaries`)
export const rebuildStorySummaries = (projectId) =>
  request(`/projects/${projectId}/story/summaries/rebuild`, { method: 'POST' })
export const queryStoryIndex = (projectId, q) =>
  request(`/projects/${projectId}/story/index/query?q=${encodeURIComponent(q)}`)
export const listStoryPlans = (projectId, status = '') =>
  request(`/projects/${projectId}/story/plans${status ? `?status=${status}` : ''}`)
export const getStoryPlan = (projectId, planId) =>
  request(`/projects/${projectId}/story/plans/${planId}`)
export const createStoryDiffPlan = (projectId, message) =>
  request(`/projects/${projectId}/story/plans/diff`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
export const createRewritePlan = (projectId, message) =>
  request(`/projects/${projectId}/story/plans/rewrite`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
export const confirmStoryPlan = (projectId, planId) =>
  request(`/projects/${projectId}/story/plans/${planId}/confirm`, { method: 'POST' })
export const completeStoryPlan = (projectId, planId) =>
  request(`/projects/${projectId}/story/plans/${planId}/complete`, { method: 'POST' })
export const getStoryHealth = (projectId) =>
  request(`/projects/${projectId}/story/health`)
export const getStoryUnderstanding = (projectId) =>
  request(`/projects/${projectId}/story/understanding`)
export const getTodaySuggestions = (projectId, limit = 3) =>
  request(`/projects/${projectId}/story/actions/today?limit=${limit}`)
export const createActionPlan = (projectId, actionId) =>
  request(`/projects/${projectId}/story/actions/${encodeURIComponent(actionId)}/plan`, {
    method: 'POST',
  })
export const runStorySync = (projectId, mode = 'quick') =>
  request(`/projects/${projectId}/story/sync`, {
    method: 'POST',
    body: JSON.stringify({ mode, async: mode === 'deep' }),
  })

/** Story OS Phase 1 */
export const generateStoryPlanner = (projectId, horizon = 5) =>
  request(`/projects/${projectId}/story/planner/generate`, {
    method: 'POST',
    body: JSON.stringify({ horizon }),
  })
export const getPlannerBundle = (projectId) =>
  request(`/projects/${projectId}/story/planner/bundle`)
export const getPlannerPreferences = (projectId) =>
  request(`/projects/${projectId}/story/planner/preferences`)
export const updatePlannerPreferences = (projectId, prefs) =>
  request(`/projects/${projectId}/story/planner/preferences`, {
    method: 'PUT',
    body: JSON.stringify(prefs),
  })
export const getTodayTasks = (projectId) =>
  request(`/projects/${projectId}/story/tasks/today`)
export const startTask = (projectId, taskId) =>
  request(`/projects/${projectId}/story/tasks/${encodeURIComponent(taskId)}/start`, {
    method: 'POST',
  })
export const startNextTask = (projectId) =>
  request(`/projects/${projectId}/story/tasks/next`, { method: 'POST' })
export const rebuildStoryTasks = (projectId, horizon) =>
  request(`/projects/${projectId}/story/tasks/rebuild`, {
    method: 'POST',
    body: JSON.stringify(horizon != null ? { horizon } : {}),
  })

export const routeStoryRequest = (projectId, message) =>
  request(`/projects/${projectId}/story/route`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })

// ── Story Index 查询（后端已实现，前端补充） ──

export const queryStoryCharacter = (projectId, name) =>
  request(`/projects/${projectId}/story/index/character?name=${encodeURIComponent(name)}`)
export const queryStoryRelationship = (projectId, q) =>
  request(`/projects/${projectId}/story/index/relationship?q=${encodeURIComponent(q)}`)
export const queryStoryTimeline = (projectId, q) =>
  request(`/projects/${projectId}/story/index/timeline?q=${encodeURIComponent(q)}`)
export const queryStoryForeshadow = (projectId, q) =>
  request(`/projects/${projectId}/story/index/foreshadow?q=${encodeURIComponent(q)}`)
export const queryStoryLocation = (projectId, q) =>
  request(`/projects/${projectId}/story/index/location?q=${encodeURIComponent(q)}`)

// ── Story Verify（后端已实现，前端补充） ──

export const getStoryVerify = (projectId) =>
  request(`/projects/${projectId}/story/verify`)
export const runStoryVerify = (projectId, body) =>
  request(`/projects/${projectId}/story/verify/run`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  })
export const runChapterReview = (projectId, filename) =>
  request(`/projects/${projectId}/story/health/review`, {
    method: 'POST',
    body: JSON.stringify({ filename }),
  })

// ── Story Engine（AWR 规则审稿 / 结构化记忆） ──

export const runEngineCritic = (projectId, body = {}) =>
  request(`/projects/${projectId}/engine/critic/run`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const runLlmCritic = (projectId, body = {}) =>
  request(`/projects/${projectId}/engine/critic/llm`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const runEngineCriticFull = (projectId, body = {}) =>
  runEngineCritic(projectId, { ...body, include_llm_critic: true })

export const listCanonRules = (projectId) =>
  request(`/projects/${projectId}/engine/canon`)

export const createCanonRule = (projectId, body) =>
  request(`/projects/${projectId}/engine/canon`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const updateCanonRule = (projectId, ruleId, body) =>
  request(`/projects/${projectId}/engine/canon/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const deleteCanonRule = (projectId, ruleId) =>
  request(`/projects/${projectId}/engine/canon/${ruleId}`, { method: 'DELETE' })

export const listEngineMemoryFacts = (projectId, params = {}) => {
  const q = new URLSearchParams()
  if (params.unit_index != null) q.set('unit_index', String(params.unit_index))
  if (params.category) q.set('category', params.category)
  const qs = q.toString()
  return request(`/projects/${projectId}/engine/memory/facts${qs ? `?${qs}` : ''}`)
}

export const listEngineMemorySummaries = (projectId) =>
  request(`/projects/${projectId}/engine/memory/summaries`)

export const listEnginePipelines = (projectId, params = {}) => {
  const q = params.unit_index != null ? `?unit_index=${params.unit_index}` : ''
  return request(`/projects/${projectId}/engine/pipelines${q}`)
}

export const getBeatWritePlan = (projectId, unitIndex) =>
  request(`/projects/${projectId}/engine/beats/${unitIndex}/write-plan`, { method: 'POST' })
export const runAutoPipeline = (projectId, body = {}) =>
  request(`/projects/${projectId}/engine/pipeline/run`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
export const getEngineLatest = (projectId) =>
  request(`/projects/${projectId}/engine/critic/latest`)
export const listEngineCriticReports = (projectId) =>
  request(`/projects/${projectId}/engine/critic-reports`)
export const getEngineMemoryContext = (projectId, unitIndex = 1) =>
  request(`/projects/${projectId}/engine/memory/context/${unitIndex}`)

export const getNarrativeAnalysis = (projectId, params = {}) => {
  const q = new URLSearchParams()
  if (params.filename) q.set('filename', params.filename)
  if (params.unit_index != null) q.set('unit_index', String(params.unit_index))
  if (params.chapter != null) q.set('chapter', String(params.chapter))
  const qs = q.toString()
  return request(`/projects/${projectId}/engine/analysis${qs ? `?${qs}` : ''}`)
}

export const runNarrativeAnalysis = (projectId, body = {}) =>
  request(`/projects/${projectId}/engine/analysis`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const getCreatorContext = (projectId, unitIndex = 1, params = {}) => {
  const q = params.filename ? `?filename=${encodeURIComponent(params.filename)}` : ''
  return request(`/projects/${projectId}/engine/creator-context/${unitIndex}${q}`)
}

export const extractSelfReview = (projectId, output) =>
  request(`/projects/${projectId}/engine/self-review/extract`, {
    method: 'POST',
    body: JSON.stringify({ output }),
  })

export const listVoiceDnas = (projectId) =>
  request(`/projects/${projectId}/engine/voice-dna`)

export const getVoiceDna = (projectId, characterId) =>
  request(`/projects/${projectId}/engine/voice-dna/${encodeURIComponent(characterId)}`)

export const saveVoiceDna = (projectId, characterId, body) =>
  request(`/projects/${projectId}/engine/voice-dna/${encodeURIComponent(characterId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const trainVoiceDna = (projectId, characterId, body) =>
  request(`/projects/${projectId}/engine/voice-dna/${encodeURIComponent(characterId)}/train`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const getStoryBible = (projectId) =>
  request(`/projects/${projectId}/engine/bible`)

export const saveStoryBible = (projectId, body) =>
  request(`/projects/${projectId}/engine/bible`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const upsertBibleSection = (projectId, section) =>
  request(`/projects/${projectId}/engine/bible/sections`, {
    method: 'POST',
    body: JSON.stringify(section),
  })

export const deleteBibleSection = (projectId, sectionId) =>
  request(`/projects/${projectId}/engine/bible/sections/${encodeURIComponent(sectionId)}`, {
    method: 'DELETE',
  })

export const listBeatOutlines = (projectId) =>
  request(`/projects/${projectId}/engine/beats`)

export const getBeatOutline = (projectId, unitIndex) =>
  request(`/projects/${projectId}/engine/beats?unit_index=${unitIndex}`)

export const saveBeatOutline = (projectId, unitIndex, body) =>
  request(`/projects/${projectId}/engine/beats/${unitIndex}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const getCharacterGraph = (projectId) =>
  request(`/projects/${projectId}/engine/character-graph`)

export const exportManuscript = (projectId, body = {}) =>
  request(`/projects/${projectId}/engine/export`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

// ── Story Planner 额外接口（后端已实现，前端补充） ──

export const getPlannerGoal = (projectId) =>
  request(`/projects/${projectId}/story/planner/goal`)
export const getPlannerRoadmap = (projectId) =>
  request(`/projects/${projectId}/story/planner/roadmap`)

// ── Story Tasks 额外接口（后端已实现，前端补充） ──

export const getAllTasks = (projectId) =>
  request(`/projects/${projectId}/story/tasks`)
export const createTaskPlan = (projectId, taskId) =>
  request(`/projects/${projectId}/story/tasks/${encodeURIComponent(taskId)}/plan`, {
    method: 'POST',
  })
export const completeTask = (projectId, taskId) =>
  request(`/projects/${projectId}/story/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
  })

// ── 章节列表（后端已实现，前端补充） ──

export const listChapters = (projectId) =>
  request(`/projects/${projectId}/chapters`)

// ── Screenplay (剧本/脚本) ──

export const getScreenplay = (projectId) =>
  request(`/projects/${projectId}/screenplay`)
export const updateScreenplay = (projectId, patch) =>
  request(`/projects/${projectId}/screenplay`, { method: 'PATCH', body: JSON.stringify(patch) })
export const getScreenplayStats = (projectId) =>
  request(`/projects/${projectId}/screenplay/stats`)

// 电影剧本：场景
export const createScene = (projectId, scene) =>
  request(`/projects/${projectId}/screenplay/scenes`, { method: 'POST', body: JSON.stringify(scene) })
export const updateScene = (projectId, sceneId, patch) =>
  request(`/projects/${projectId}/screenplay/scenes/${sceneId}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const deleteScene = (projectId, sceneId) =>
  request(`/projects/${projectId}/screenplay/scenes/${sceneId}`, { method: 'DELETE' })
export const reorderScenes = (projectId, order) =>
  request(`/projects/${projectId}/screenplay/scenes/reorder`, { method: 'POST', body: JSON.stringify({ order }) })

// 电影剧本：故事线
export const getStorylines = (projectId) =>
  request(`/projects/${projectId}/screenplay/storylines`)
export const updateStorylines = (projectId, storylines) =>
  request(`/projects/${projectId}/screenplay/storylines`, { method: 'PUT', body: JSON.stringify(storylines) })

// 电影剧本：角色统计
export const getScreenplayCharacters = (projectId) =>
  request(`/projects/${projectId}/screenplay/characters`)

// 剧集：集管理
export const createEpisode = (projectId, episode) =>
  request(`/projects/${projectId}/screenplay/episodes`, { method: 'POST', body: JSON.stringify(episode) })
export const updateEpisode = (projectId, episodeId, patch) =>
  request(`/projects/${projectId}/screenplay/episodes/${episodeId}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const deleteEpisode = (projectId, episodeId) =>
  request(`/projects/${projectId}/screenplay/episodes/${episodeId}`, { method: 'DELETE' })

// 剧集：集内场景
export const createEpisodeScene = (projectId, episodeId, scene) =>
  request(`/projects/${projectId}/screenplay/episodes/${episodeId}/scenes`, { method: 'POST', body: JSON.stringify(scene) })
export const updateEpisodeScene = (projectId, episodeId, sceneId, patch) =>
  request(`/projects/${projectId}/screenplay/episodes/${episodeId}/scenes/${sceneId}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const reorderEpisodeScenes = (projectId, episodeId, order) =>
  request(`/projects/${projectId}/screenplay/episodes/${episodeId}/scenes/reorder`, { method: 'POST', body: JSON.stringify({ order }) })

// 剧集：伏笔
export const getForeshadows = (projectId) =>
  request(`/projects/${projectId}/screenplay/foreshadows`)
export const createForeshadow = (projectId, foreshadow) =>
  request(`/projects/${projectId}/screenplay/foreshadows`, { method: 'POST', body: JSON.stringify(foreshadow) })
export const updateForeshadow = (projectId, foreshadowId, patch) =>
  request(`/projects/${projectId}/screenplay/foreshadows/${foreshadowId}`, { method: 'PATCH', body: JSON.stringify(patch) })

// 剧集：角色弧线
export const getCharacterArcs = (projectId) =>
  request(`/projects/${projectId}/screenplay/character-arcs`)
export const updateCharacterArc = (projectId, characterName, patch) =>
  request(`/projects/${projectId}/screenplay/character-arcs/${encodeURIComponent(characterName)}`, { method: 'PATCH', body: JSON.stringify(patch) })

// 短视频：分镜
export const createShot = (projectId, shot) =>
  request(`/projects/${projectId}/screenplay/shots`, { method: 'POST', body: JSON.stringify(shot) })
export const updateShot = (projectId, shotId, patch) =>
  request(`/projects/${projectId}/screenplay/shots/${shotId}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const deleteShot = (projectId, shotId) =>
  request(`/projects/${projectId}/screenplay/shots/${shotId}`, { method: 'DELETE' })
export const reorderShots = (projectId, order) =>
  request(`/projects/${projectId}/screenplay/shots/reorder`, { method: 'POST', body: JSON.stringify({ order }) })

// 短视频：段落
export const updateSections = (projectId, sections) =>
  request(`/projects/${projectId}/screenplay/sections`, { method: 'PUT', body: JSON.stringify(sections) })

// 短视频：节奏分析
export const getRhythm = (projectId) =>
  request(`/projects/${projectId}/screenplay/rhythm`)

// 短视频：平台设置
export const updatePlatform = (projectId, settings) =>
  request(`/projects/${projectId}/screenplay/platform`, { method: 'PUT', body: JSON.stringify(settings) })

// 导出：Fountain
export const exportFountainUrl = (projectId) =>
  `${API}/projects/${projectId}/screenplay/export/fountain`
