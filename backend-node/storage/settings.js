import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { SETTINGS_PATH, now, readJSON, writeJSON, sqlAdapter } from './core.js';

// ── Settings / Models ──

function defaultSettings() {
  return { active_id: '', models: [] };
}

function inferProtocol(baseUrl) {
  return (baseUrl || '').toLowerCase().includes('/anthropic') ? 'anthropic' : 'openai';
}

function maskKey(key) {
  key = String(key || '');
  return key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '';
}

function migrateLegacy(raw) {
  if (!raw || typeof raw !== 'object') return defaultSettings();
  if (raw.models) return raw;
  const baseUrl = String(raw.base_url || '').trim();
  const model = String(raw.model || '').trim();
  const apiKey = String(raw.api_key || '').trim();
  if (!baseUrl && !model && !apiKey) return defaultSettings();
  const id = randomUUID().slice(0, 12);
  const ts = now();
  return {
    active_id: id,
    models: [{
      id, name: model || '默认模型',
      protocol: inferProtocol(baseUrl || 'https://api.openai.com/v1'),
      base_url: baseUrl || 'https://api.openai.com/v1',
      model: model || 'gpt-4o-mini',
      api_key: apiKey,
      created_at: ts, updated_at: ts,
    }],
  };
}

export function loadSettingsRaw() {
  const raw = sqlAdapter.readKv(sqlAdapter.KV_KEYS.settings, SETTINGS_PATH, defaultSettings(), readJSON);
  const migrated = migrateLegacy(raw);
  if (JSON.stringify(migrated) !== JSON.stringify(raw)) {
    sqlAdapter.writeKv(sqlAdapter.KV_KEYS.settings, SETTINGS_PATH, migrated, writeJSON);
  }
  return migrated;
}

export function getActiveModel() {
  const data = loadSettingsRaw();
  const activeId = String(data.active_id || '');
  const models = data.models || [];
  if (!models.length) return null;
  return models.find(m => m.id === activeId) || models[0];
}

export function listModelsPublic() {
  const data = loadSettingsRaw();
  const models = (data.models || []).map(m => ({
    id: m.id,
    name: m.name || m.model || '未命名',
    protocol: m.protocol || inferProtocol(m.base_url),
    base_url: m.base_url || '',
    model: m.model || '',
    api_key_set: Boolean(String(m.api_key || '').trim()),
    api_key_preview: maskKey(m.api_key),
    created_at: m.created_at,
    updated_at: m.updated_at,
  }));
  let activeId = String(data.active_id || '');
  if (models.length && !models.find(m => m.id === activeId)) {
    activeId = models[0].id;
  }
  return { active_id: activeId, models };
}

export function createModel(payload) {
  const data = loadSettingsRaw();
  const id = randomUUID().slice(0, 12);
  const ts = now();
  const baseUrl = String(payload.base_url || '').trim();
  const entry = {
    id, name: String(payload.name || payload.model || '新模型').trim(),
    protocol: String(payload.protocol || inferProtocol(baseUrl)).trim(),
    base_url: baseUrl,
    model: String(payload.model || '').trim(),
    api_key: String(payload.api_key || '').trim(),
    created_at: ts, updated_at: ts,
  };
  if (!entry.base_url) throw new Error('Base URL 不能为空');
  if (!entry.model) throw new Error('模型名称不能为空');
  if (!entry.api_key) throw new Error('API Key 不能为空');
  const models = [...(data.models || []), entry];
  sqlAdapter.writeKv(sqlAdapter.KV_KEYS.settings, SETTINGS_PATH, { active_id: data.active_id || id, models }, writeJSON);
  return modelPublic(entry);
}

export function updateModel(modelId, payload) {
  const data = loadSettingsRaw();
  const models = [...(data.models || [])];
  const idx = models.findIndex(m => m.id === modelId);
  if (idx === -1) throw new Error(`模型配置不存在: ${modelId}`);
  const entry = { ...models[idx] };
  if (payload.name != null) entry.name = String(payload.name).trim() || entry.name;
  if (payload.protocol) entry.protocol = String(payload.protocol).trim();
  if (payload.base_url != null) { const u = String(payload.base_url).trim(); if (u) entry.base_url = u; }
  if (payload.model != null) { const m = String(payload.model).trim(); if (m) entry.model = m; }
  if (payload.api_key && String(payload.api_key).trim()) entry.api_key = String(payload.api_key).trim();
  entry.updated_at = now();
  models[idx] = entry;
  saveSettingsData({ active_id: data.active_id || '', models });
  return modelPublic(entry);
}

function saveSettingsData(data) {
  sqlAdapter.writeKv(sqlAdapter.KV_KEYS.settings, SETTINGS_PATH, data, writeJSON);
}

export function deleteModel(modelId) {
  const data = loadSettingsRaw();
  const remaining = (data.models || []).filter(m => m.id !== modelId);
  if (remaining.length === (data.models || []).length) throw new Error(`模型配置不存在: ${modelId}`);
  let activeId = String(data.active_id || '');
  if (activeId === modelId) activeId = remaining[0]?.id || '';
  saveSettingsData({ active_id: activeId, models: remaining });
  return { status: 'deleted', active_id: activeId };
}

export function setActiveModel(modelId) {
  const data = loadSettingsRaw();
  if (!(data.models || []).find(m => m.id === modelId)) throw new Error(`模型配置不存在: ${modelId}`);
  saveSettingsData({ active_id: modelId, models: data.models });
  return listModelsPublic();
}

export function getModelById(modelId) {
  const data = loadSettingsRaw();
  const m = (data.models || []).find(m => m.id === modelId);
  if (!m) throw new Error(`模型配置不存在: ${modelId}`);
  return m;
}

export function readCcSwitchConfig() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    throw new Error('未找到 ~/.claude/settings.json，请先在 CC Switch 中配置并启用提供商');
  }
  const raw = readJSON(settingsPath, null);
  const env = raw?.env || {};
  const base = String(env.ANTHROPIC_BASE_URL || env.OPENAI_BASE_URL || '').trim();
  const key = String(env.ANTHROPIC_AUTH_TOKEN || env.OPENAI_API_KEY || '').trim();
  const model = String(env.ANTHROPIC_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  if (!base) throw new Error('CC Switch 配置中未找到 ANTHROPIC_BASE_URL / OPENAI_BASE_URL');
  if (!key) throw new Error('CC Switch 配置中未找到 ANTHROPIC_AUTH_TOKEN / OPENAI_API_KEY');
  const protocol = (env.ANTHROPIC_AUTH_TOKEN || String(base).toLowerCase().includes('/anthropic')) ? 'anthropic' : 'openai';
  return {
    name: 'CC Switch 当前',
    protocol,
    base_url: base,
    model,
    api_key: key,
    source: 'cc-switch',
  };
}

function modelPublic(entry) {
  const key = String(entry.api_key || '');
  return {
    id: entry.id, name: entry.name || entry.model || '未命名',
    protocol: entry.protocol || inferProtocol(entry.base_url),
    base_url: entry.base_url || '', model: entry.model || '',
    api_key_set: Boolean(key.trim()),
    api_key_preview: maskKey(key),
    created_at: entry.created_at, updated_at: entry.updated_at,
  };
}