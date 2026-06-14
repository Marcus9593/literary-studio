import { request } from './client.js';


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

export const queryStoryCharacter = (projectId, q) =>
  request(`/projects/${projectId}/story/index/character?q=${encodeURIComponent(q)}`)
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
