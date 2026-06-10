import { API, request } from './client.js';


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
