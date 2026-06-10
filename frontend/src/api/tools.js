import { request } from './client.js';

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
