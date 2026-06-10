import { randomUUID } from 'crypto';
import { workspacePath, touchProject } from '../storage.js';
import { loadStudioState, saveStudioState } from './studio-state.js';

/** @deprecated V2.8 — 素材已迁至 Knowledge，见 docs/archive/v2.8/v2.8-creative-cockpit-architecture.md */

function now() {
  return new Date().toISOString();
}

export function listStudioAssets(projectId = '') {
  const state = loadStudioState();
  if (projectId) {
    return [...(state.assets[projectId] || [])]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }
  const all = Object.values(state.assets || {}).flatMap((items) => items || []);
  return all.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export function createStudioAsset(payload = {}) {
  const projectId = String(payload.project_id || '').trim();
  if (!projectId) throw new Error('project_id 不能为空');
  workspacePath(projectId);
  const state = loadStudioState();
  const projectAssets = state.assets[projectId] || [];
  const name = String(payload.name || '').trim() || `素材 ${projectAssets.length + 1}`;
  const type = String(payload.type || '待补充').trim() || '待补充';
  const asset = {
    id: randomUUID().slice(0, 12),
    project_id: projectId,
    type,
    name,
    note: String(payload.note || '请补充描述与用途'),
    created_at: now(),
    updated_at: now(),
  };
  state.assets[projectId] = [asset, ...projectAssets];
  saveStudioState(state);
  touchProject(projectId);
  return asset;
}

export function deleteStudioAsset(assetId, projectId) {
  const state = loadStudioState();
  if (!projectId) throw new Error('project_id 不能为空');
  state.assets[projectId] = (state.assets[projectId] || []).filter((s) => s.id !== assetId);
  saveStudioState(state);
  return { status: 'deleted' };
}

export function updateStudioAsset(assetId, payload = {}) {
  const state = loadStudioState();
  for (const projectId of Object.keys(state.assets || {})) {
    const idx = (state.assets[projectId] || []).findIndex((a) => a.id === assetId);
    if (idx === -1) continue;
    const item = { ...state.assets[projectId][idx] };
    if (payload.name != null) item.name = String(payload.name).trim() || item.name;
    if (payload.type != null) item.type = String(payload.type).trim() || item.type;
    if (payload.note != null) item.note = String(payload.note).trim() || '';
    item.updated_at = now();
    state.assets[projectId][idx] = item;
    saveStudioState(state);
    touchProject(projectId);
    return item;
  }
  throw new Error(`素材不存在: ${assetId}`);
}
