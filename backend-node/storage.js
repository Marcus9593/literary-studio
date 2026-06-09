import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { decodeBuffer, decodeUploadFilename, looksLikeMojibake } from './encoding.js';
import {
  normalizeWorkType,
  normalizeCreationMode,
  manuscriptDirForMode,
} from './projectProfile.js';
import {
  ARCHIVE_KEEP_MESSAGES,
  MAX_SESSION_MESSAGES,
  buildHeuristicMemorySummary,
  shouldRefreshMemory,
} from './conversation-memory.js';
import * as sqlAdapter from './storage/sqlite/adapter.js';
import { initSqliteStorage } from './storage/sqlite/migrate.js';
import { resolveProjectCardSummary } from './project-summary.js';
import { normalizeProjectStatus } from './project-meta-fields.js';
import { sanitizeManuscriptForSave } from './ai-runtime/output-sanitize.js';

initSqliteStorage();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
const JOBS_PATH = path.join(DATA_DIR, 'jobs.json');

// Ensure dirs exist
for (const dir of [DATA_DIR, PROJECTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function now() {
  return new Date().toISOString();
}

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

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

// ── Projects ──

export function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const items = [];
  for (const name of fs.readdirSync(PROJECTS_DIR).sort()) {
    const metaPath = path.join(PROJECTS_DIR, name, 'meta.json');
    try { items.push(JSON.parse(fs.readFileSync(metaPath, 'utf-8'))); } catch {}
  }
  items.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  return items;
}

export function projectDir(projectId) {
  return path.join(PROJECTS_DIR, projectId);
}

export function getProject(projectId) {
  const metaPath = path.join(projectDir(projectId), 'meta.json');
  if (!fs.existsSync(metaPath)) throw new Error(`项目不存在: ${projectId}`);
  return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
}

export function saveProjectMeta(meta) {
  const dir = projectDir(meta.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
  sqlAdapter.syncProjectMeta(meta);
}

// ── Screenplay Storage ──

export function loadScreenplay(projectId) {
  const filePath = path.join(projectDir(projectId), 'screenplay.json');
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveScreenplay(projectId, data) {
  const filePath = path.join(projectDir(projectId), 'screenplay.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  touchProject(projectId);
  return data;
}

function isScreenplayType(workType) {
  return ['screenplay_film', 'screenplay_series', 'web_short'].includes(workType);
}

function defaultScreenplayData(workType, title) {
  if (workType === 'screenplay_film') {
    return {
      schema: 'screenplay_film',
      version: 1,
      structure: 'three_act',
      scenes: [],
      storylines: [
        { id: 'main', label: '主线', color: '#4A90D9' },
      ],
      characters: {},
    };
  }
  if (workType === 'screenplay_series') {
    return {
      schema: 'screenplay_series',
      version: 1,
      seasons: [{ number: 1, title: '第一季', episode_count: 0 }],
      timelines: [{ id: 'present', label: '现代' }],
      storylines: [
        { id: 'main', label: 'A线', color: '#4A90D9' },
      ],
      episodes: [],
      foreshadows: [],
      character_arcs: {},
    };
  }
  if (workType === 'web_short') {
    return {
      schema: 'web_short',
      version: 1,
      platform: 'douyin',
      target_duration: 60,
      sections: [
        { id: 'sec_hook', type: 'hook', label: '钩子', duration: 3, order: 0 },
        { id: 'sec_content', type: 'content', label: '核心内容', duration: 52, order: 1 },
        { id: 'sec_cta', type: 'cta', label: '行动号召', duration: 5, order: 2 },
      ],
      shots: [],
      rhythm_profile: { hook_duration: 3, content_density: 'medium', cta_position: 'end', pacing_notes: '' },
    };
  }
  return null;
}

function defaultScreenState(workType) {
  if (workType === 'screenplay_film') {
    return {
      schema: 'screenplay_state',
      project_info: { title: '', genre: '' },
      structure: { type: 'three_act', current_act: 1, total_acts: 3 },
      progress: { total_scenes: 0, total_duration_minutes: 0, last_updated: now() },
      active_storylines: ['main'],
      notes: '',
    };
  }
  if (workType === 'screenplay_series') {
    return {
      schema: 'screenplay_state',
      project_info: { title: '', genre: '' },
      structure: { type: 'series', current_season: 1, current_episode: 1 },
      progress: { total_episodes: 0, total_scenes: 0, last_updated: now() },
      active_storylines: ['main'],
      notes: '',
    };
  }
  if (workType === 'web_short') {
    return {
      schema: 'screenplay_state',
      project_info: { title: '', genre: '' },
      structure: { type: 'short_video', platform: 'douyin', target_duration: 60 },
      progress: { total_shots: 0, total_duration: 0, last_updated: now() },
      notes: '',
    };
  }
  return null;
}

const WORKSPACE_SUBDIRS = ['正文', '大纲', '设定集', 'archive', '试验稿', '.webnovel'];

export function ensureWorkspaceDirs(workspace) {
  for (const sub of WORKSPACE_SUBDIRS) {
    fs.mkdirSync(path.join(workspace, sub), { recursive: true });
  }
}

export function normalizeProjectMeta(meta) {
  const chapters = listChapters(meta.id);
  const work_type = normalizeWorkType(meta.work_type);
  let creation_mode = normalizeCreationMode(meta.creation_mode);
  if (!meta.creation_mode && chapters.length > 0) creation_mode = 'continue';
  const total_words = chapters.reduce((s, c) => s + (c.words || 0), 0);
  const card = resolveProjectCardSummary(meta, chapters);
  return {
    ...meta,
    work_type,
    creation_mode,
    summary: String(meta.summary || ''),
    rewrite_note: String(meta.rewrite_note || ''),
    status: normalizeProjectStatus(meta.status),
    archived: Boolean(meta.archived),
    onboarding_completed: Boolean(meta.onboarding_completed),
    card_summary: card.text,
    summary_source: card.source,
    stats: {
      manuscript_count: chapters.length,
      total_words,
      latest_filename: chapters[chapters.length - 1]?.filename || null,
      latest_title: chapters[chapters.length - 1]?.title || null,
    },
  };
}

export function createProject(title, genre = '玄幻', options = {}) {
  const projectId = randomUUID().slice(0, 12);
  const root = projectDir(projectId);
  const workspace = path.join(root, 'workspace');
  ensureWorkspaceDirs(workspace);
  const work_type = normalizeWorkType(options.work_type);
  const creation_mode = normalizeCreationMode(options.creation_mode);

  // 剧本类型使用专用 state 结构
  const state = isScreenplayType(work_type)
    ? defaultScreenState(work_type)
    : {
        project_info: { title, genre, target_words: 0, target_chapters: 0 },
        progress: { current_chapter: 0, total_words: 0, last_updated: now(), volumes_completed: [], current_volume: 1, volumes_planned: [] },
        protagonist_state: { name: '', power: { realm: '', layer: 0, bottleneck: '' }, location: { current: '', last_chapter: 0 }, golden_finger: { name: '', level: 0, cooldown: 0 } },
        relationships: {}, world_settings: { power_system: [], factions: [], locations: [] },
        review_checkpoints: [],
        strand_tracker: { last_quest_chapter: 0, last_fire_chapter: 0, last_constellation_chapter: 0, current_dominant: 'quest', chapters_since_switch: 0, history: [] },
        plot_threads: { active_threads: [], foreshadowing: [] },
        disambiguation_warnings: [], disambiguation_pending: [], chapter_meta: {},
      };
  state.project_info = state.project_info || {};
  state.project_info.title = title;
  state.project_info.genre = genre;
  fs.writeFileSync(path.join(workspace, '.webnovel', 'state.json'), JSON.stringify(state, null, 2), 'utf-8');

  // 剧本类型创建 screenplay.json
  if (isScreenplayType(work_type)) {
    const screenplayData = defaultScreenplayData(work_type, title);
    saveScreenplay(projectId, screenplayData);
  }

  // 大纲模板
  let outlineTemplate = `# ${title}\n\n## 一句话概述\n\n待补充\n`;
  if (work_type === 'screenplay_film') {
    outlineTemplate = `# ${title}\n\n## 一句话概述\n\n待补充\n\n## 第一幕：建置\n\n待补充\n\n## 第二幕：对抗\n\n待补充\n\n## 第三幕：解决\n\n待补充\n`;
  } else if (work_type === 'screenplay_series') {
    outlineTemplate = `# ${title}\n\n## 一句话概述\n\n待补充\n\n## 第一季概要\n\n待补充\n\n## 主要角色\n\n待补充\n\n## 故事线\n\n待补充\n`;
  } else if (work_type === 'web_short') {
    outlineTemplate = `# ${title}\n\n## 一句话概述\n\n待补充\n\n## 目标平台\n\n抖音\n\n## 目标时长\n\n60秒\n`;
  }
  fs.writeFileSync(path.join(workspace, '大纲', '总纲.md'), outlineTemplate, 'utf-8');

  const meta = {
    id: projectId,
    title,
    genre,
    work_type,
    creation_mode,
    rewrite_note: String(options.rewrite_note || ''),
    summary: String(options.summary || ''),
    status: normalizeProjectStatus(options.status),
    archived: Boolean(options.archived),
    onboarding_completed: false,
    owner_id: String(options.owner_id || ''),
    shares: Array.isArray(options.shares) ? options.shares : [],
    created_at: now(),
    updated_at: now(),
    workspace,
  };
  saveProjectMeta(meta);
  return normalizeProjectMeta(meta);
}

export function updateProject(projectId, patch = {}) {
  const meta = getProject(projectId);
  if (patch.title?.trim()) meta.title = patch.title.trim();
  if (patch.genre?.trim()) meta.genre = patch.genre.trim();
  if (patch.work_type) meta.work_type = normalizeWorkType(patch.work_type);
  if (patch.creation_mode) meta.creation_mode = normalizeCreationMode(patch.creation_mode);
  if (patch.rewrite_note !== undefined) meta.rewrite_note = String(patch.rewrite_note || '');
  if (patch.summary !== undefined) meta.summary = String(patch.summary || '');
  if (patch.status !== undefined) meta.status = normalizeProjectStatus(patch.status);
  if (patch.archived !== undefined) meta.archived = Boolean(patch.archived);
  if (patch.onboarding_completed !== undefined) {
    meta.onboarding_completed = Boolean(patch.onboarding_completed);
  }
  meta.updated_at = now();
  saveProjectMeta(meta);
  return normalizeProjectMeta(meta);
}

export function updateProjectShares(projectId, shares = []) {
  const meta = getProject(projectId);
  if (!Array.isArray(meta.shares)) meta.shares = [];
  meta.shares = shares.map((s) => ({
    user_id: String(s.user_id || ''),
    username: String(s.username || ''),
    role: s.role === 'write' ? 'write' : 'read',
    granted_at: s.granted_at || now(),
  })).filter((s) => s.user_id);
  meta.updated_at = now();
  saveProjectMeta(meta);
  return meta;
}

export function touchProject(projectId) {
  const meta = getProject(projectId);
  meta.updated_at = now();
  saveProjectMeta(meta);
}

export function workspacePath(projectId) {
  return getProject(projectId).workspace;
}

function extractManuscriptTitle(text, filename) {
  const trimmed = (text || '').trim();
  const h1 = trimmed.match(/(?:^|\n)#\s+([^\n]+)/);
  if (h1?.[1]?.trim()) return h1[1].trim();

  const firstLine = trimmed.split('\n').map((l) => l.trim()).find(Boolean) || '';
  if (firstLine && firstLine.length <= 100 && !firstLine.startsWith('```')) {
    const plain = firstLine.replace(/^#+\s*/, '').trim();
    if (/[\u4e00-\u9fff《》]/.test(plain)) return plain;
  }

  const stem = path.parse(filename).name;
  const decoded = decodeUploadFilename(stem);
  if (decoded !== stem) return decoded;
  return stem;
}

function sanitizeManuscriptFilename(title) {
  const safe = String(title || '未命名')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('._-')
    .slice(0, 80) || '未命名';
  return `${safe}.md`;
}

function repairGarbledManuscriptFile(dir, filename, text) {
  const stem = path.parse(filename).name;
  const inner = stem.startsWith('导入-') ? stem.slice(3) : stem;
  const nameLooksBad = looksLikeMojibake(stem) || looksLikeMojibake(inner);
  if (!nameLooksBad) return filename;

  const title = extractManuscriptTitle(text, filename);
  if (!/[\u4e00-\u9fff《》]/.test(title)) return filename;

  let newName = sanitizeManuscriptFilename(title);
  if (newName === filename) return filename;

  let targetPath = path.join(dir, newName);
  let n = 2;
  while (fs.existsSync(targetPath) && path.basename(targetPath) !== filename) {
    const base = path.parse(newName).name;
    newName = `${base}-${n}.md`;
    targetPath = path.join(dir, newName);
    n += 1;
  }
  if (path.basename(targetPath) === filename) return filename;

  try {
    fs.renameSync(path.join(dir, filename), targetPath);
    return newName;
  } catch {
    return filename;
  }
}

function listMdFilesInDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map((originalName) => {
      const filePath = path.join(dir, originalName);
      const buf = fs.readFileSync(filePath);
      const text = decodeBuffer(buf);
      const filename = repairGarbledManuscriptFile(dir, originalName, text);
      return {
        filename,
        title: extractManuscriptTitle(text, filename),
        words: text.replace(/[\s\n]/g, '').length,
        preview: text.slice(0, 200),
      };
    });
}

export function listChapters(projectId) {
  const meta = getProject(projectId);
  const primaryDir = manuscriptDirForMode(meta.creation_mode || 'scratch');
  const bodyDir = path.join(workspacePath(projectId), primaryDir);
  let items = listMdFilesInDir(bodyDir);
  if (!items.length && primaryDir !== '正文') {
    items = listMdFilesInDir(path.join(workspacePath(projectId), '正文'));
  }
  return items;
}

export function listWorkspaceFiles(projectId, category) {
  const ws = workspacePath(projectId);
  const map = {
    manuscript: '正文',
    outline: '大纲',
    settings: '设定集',
    archive: 'archive',
    draft: '试验稿',
  };
  const sub = map[category];
  if (!sub) throw new Error(`未知分类: ${category}`);
  return listMdFilesInDir(path.join(ws, sub));
}

export function readWorkspaceFile(projectId, category, filename) {
  const ws = workspacePath(projectId);
  const map = {
    manuscript: '正文',
    outline: '大纲',
    settings: '设定集',
    archive: 'archive',
    draft: '试验稿',
  };
  const sub = map[category];
  if (!sub) throw new Error(`未知分类: ${category}`);
  const safe = path.basename(filename);
  const filePath = path.join(ws, sub, safe);
  if (!fs.existsSync(filePath)) throw new Error('文件不存在');
  const buf = fs.readFileSync(filePath);
  return { filename: safe, category, subdir: sub, content: decodeBuffer(buf) };
}

export function resolveManuscriptPath(projectId, filename) {
  const meta = getProject(projectId);
  const ws = workspacePath(projectId);
  const safe = path.basename(filename);
  const primary = manuscriptDirForMode(meta.creation_mode || 'scratch');
  for (const sub of [primary, '正文', '试验稿']) {
    const filePath = path.join(ws, sub, safe);
    if (fs.existsSync(filePath)) return filePath;
  }
  throw new Error(`文稿不存在: ${safe}`);
}

const FILE_CATEGORY_DIRS = {
  outline: '大纲',
  settings: '设定集',
  archive: 'archive',
  draft: '试验稿',
};

export function writeManuscriptFile(projectId, filename, content) {
  const filePath = resolveManuscriptPath(projectId, filename);
  const text = sanitizeManuscriptForSave(String(content ?? ''));
  fs.writeFileSync(filePath, text, 'utf-8');
  touchProject(projectId);
  const safe = path.basename(filePath);
  return {
    filename: safe,
    title: extractManuscriptTitle(text, safe),
    words: text.replace(/[\s\n]/g, '').length,
  };
}

/** Create or overwrite a chapter file by number (used when API models write without CLI tools). */
export function saveChapterByNumber(projectId, chapter, title, content) {
  const meta = getProject(projectId);
  const ws = workspacePath(projectId);
  const sub = manuscriptDirForMode(meta.creation_mode || 'scratch');
  const dir = path.join(ws, sub);
  fs.mkdirSync(dir, { recursive: true });
  const safeTitle = String(title || '未命名').trim().slice(0, 80) || '未命名';
  const filename = `第${String(chapter).padStart(4, '0')}章-${safeTitle}.md`;
  const filePath = path.join(dir, filename);
  const text = sanitizeManuscriptForSave(String(content ?? ''));
  fs.writeFileSync(filePath, text, 'utf-8');
  touchProject(projectId);
  return {
    filename,
    title: extractManuscriptTitle(text, filename),
    words: text.replace(/[\s\n]/g, '').length,
    subdir: sub,
  };
}

export function deleteManuscriptFile(projectId, filename) {
  const filePath = resolveManuscriptPath(projectId, filename);
  if (!fs.existsSync(filePath)) throw new Error('文稿不存在');
  const safe = path.basename(filePath);
  fs.unlinkSync(filePath);
  deleteSessionsForManuscript(projectId, safe);
  touchProject(projectId);
  return {
    status: 'deleted',
    filename: safe,
    chapters: listChapters(projectId),
  };
}

export function createManuscriptFile(projectId, title, content = '') {
  const meta = getProject(projectId);
  const ws = workspacePath(projectId);
  const sub = manuscriptDirForMode(meta.creation_mode || 'scratch');
  const dir = path.join(ws, sub);
  fs.mkdirSync(dir, { recursive: true });
  const safeTitle = String(title || '未命名').trim().slice(0, 80) || '未命名';
  const existing = listMdFilesInDir(dir);
  const num = existing.length + 1;
  const filename = `第${String(num).padStart(4, '0')}章-${safeTitle}.md`;
  const filePath = path.join(dir, filename);
  const body = content || `# ${safeTitle}\n\n`;
  fs.writeFileSync(filePath, body, 'utf-8');
  touchProject(projectId);
  return {
    filename,
    title: path.parse(filename).name,
    words: body.replace(/[\s\n]/g, '').length,
    subdir: sub,
  };
}

export function writeWorkspaceFile(projectId, category, filename, content) {
  if (category === 'manuscript') {
    return { ...writeManuscriptFile(projectId, filename, content), category: 'manuscript' };
  }
  const sub = FILE_CATEGORY_DIRS[category];
  if (!sub) throw new Error(`未知分类: ${category}`);
  const ws = workspacePath(projectId);
  const safe = path.basename(filename);
  const filePath = path.join(ws, sub, safe);
  if (!fs.existsSync(filePath)) throw new Error('文件不存在');
  const text = String(content ?? '');
  fs.writeFileSync(filePath, text, 'utf-8');
  touchProject(projectId);
  return {
    filename: safe,
    title: path.parse(safe).name,
    words: text.replace(/[\s\n]/g, '').length,
    category,
    subdir: sub,
  };
}

export function buildTakeoverReport(projectId) {
  const meta = normalizeProjectMeta(getProject(projectId));
  const ws = workspacePath(projectId);
  const chapters = listChapters(projectId);
  const outlines = listMdFilesInDir(path.join(ws, '大纲'));
  const settings = listMdFilesInDir(path.join(ws, '设定集'));
  const archive = listMdFilesInDir(path.join(ws, 'archive'));
  const drafts = listMdFilesInDir(path.join(ws, '试验稿'));

  const gaps = [];
  if (!chapters.length) {
    gaps.push({ id: 'no_manuscript', level: 'warn', message: '尚无正文/稿，可先导入或从大纲开写' });
  }
  if (!outlines.length) {
    gaps.push({ id: 'no_outline', level: 'info', message: '大纲目录为空，建议补充总纲或分卷梗概' });
  }
  if (!settings.length) {
    gaps.push({ id: 'no_settings', level: 'info', message: '设定集为空，长篇/剧本建议补充人物与世界观' });
  }
  if (meta.creation_mode === 'rewrite' && !drafts.length && !archive.length) {
    gaps.push({ id: 'rewrite_no_draft', level: 'info', message: '重写模式：新稿可写入「试验稿」，旧稿可放入 archive' });
  }

  const suggestions = [];
  if (meta.creation_mode === 'continue' || chapters.length > 0) {
    suggestions.push({ id: 'summarize', label: '梳理目前已写内容', prompt: '用 500 字以内总结目前已写剧情线、人物关系与未解悬念' });
    suggestions.push({ id: 'next', label: '讨论下一稿怎么写', prompt: '根据最新正文和大纲，讨论接下来最合理的续写方向（先讨论，不要直接写全文）' });
    suggestions.push({ id: 'check_outline', label: '对照大纲查偏离', prompt: '对照大纲/设定，检查已写正文有无明显偏离或矛盾' });
  }
  if (meta.creation_mode === 'rewrite') {
    suggestions.push({ id: 'rewrite_plan', label: '制定重写方案', prompt: `我正在进行重新创作。新方向：${meta.rewrite_note || '待定'}。请基于现有文稿，建议哪些保留、哪些重写，不要直接改文件。` });
    suggestions.push({ id: 'compare', label: '分析旧稿问题', prompt: '阅读已有正文/大纲，指出结构或人物上的主要问题，并给出 2 个可选的重写方向' });
  }
  if (meta.creation_mode === 'scratch' && !chapters.length) {
    suggestions.push({ id: 'bootstrap', label: '帮我搭写作计划', prompt: '项目刚起步，请根据大纲（若有）帮我列一个开篇写作计划与第一章要点' });
  }

  return {
    project: meta,
    work_type: meta.work_type,
    creation_mode: meta.creation_mode,
    stats: {
      manuscript_count: chapters.length,
      total_words: chapters.reduce((s, c) => s + c.words, 0),
      outline_count: outlines.length,
      settings_count: settings.length,
      archive_count: archive.length,
      draft_count: drafts.length,
    },
    latest: chapters[chapters.length - 1] || null,
    gaps,
    suggestions,
    files: {
      manuscripts: chapters,
      outlines,
      settings,
      archive,
      drafts,
    },
  };
}

export function deleteProject(projectId) {
  fs.rmSync(projectDir(projectId), { recursive: true, force: true });
}

// ── Chat History ──

function chatPath(projectId) {
  return path.join(workspacePath(projectId), '.webnovel', 'chat.json');
}

export function loadChatHistory(projectId) {
  const p = chatPath(projectId);
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return (data.messages || []).filter(m => ['user', 'assistant'].includes(m.role) && m.content);
  } catch { return []; }
}

export function saveChatHistory(projectId, messages) {
  const trimmed = messages.slice(-40);
  const p = chatPath(projectId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ messages: trimmed }, null, 2), 'utf-8');
  return trimmed;
}

export function clearChatHistory(projectId) {
  const p = chatPath(projectId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ── Sessions ──

function sessionsDir(projectId) {
  return path.join(workspacePath(projectId), '.webnovel', 'sessions');
}

function sessionIndexPath(projectId) {
  return path.join(sessionsDir(projectId), 'index.json');
}

function sessionFilePath(projectId, sessionId) {
  return path.join(sessionsDir(projectId), `${sessionId}.json`);
}

function sessionArchivePath(projectId, sessionId) {
  return path.join(sessionsDir(projectId), `${sessionId}.archive.json`);
}

/** 全书级会话标记（非某一章正文） */
export const SESSION_SCOPE_PROJECT = '__project__';

function normalizeSession(session) {
  if (!session) return session;
  session.memory_summary = session.memory_summary || '';
  session.memory_updated_at = session.memory_updated_at || null;
  session.memory_message_count = session.memory_message_count || 0;
  session.claude_session_id = session.claude_session_id || null;
  session.context_notes = Array.isArray(session.context_notes) ? session.context_notes : [];
  if (session.bound_filename === undefined) session.bound_filename = null;
  return session;
}

function sessionIndexEntry(session) {
  return {
    id: session.id,
    title: session.title,
    created_at: session.created_at,
    updated_at: session.updated_at,
    message_count: session.messages?.length ?? session.message_count ?? 0,
    bound_filename: session.bound_filename || null,
  };
}

function isProjectScopeSession(entry) {
  return !entry?.bound_filename || entry.bound_filename === SESSION_SCOPE_PROJECT;
}

function archiveOverflowMessages(session, projectId, sessionId) {
  if (!session.messages || session.messages.length <= MAX_SESSION_MESSAGES) return session;

  const overflow = session.messages.length - ARCHIVE_KEEP_MESSAGES;
  const toArchive = session.messages.slice(0, overflow);
  session.messages = session.messages.slice(overflow);

  const archivePath = sessionArchivePath(projectId, sessionId);
  let archive = { messages: [] };
  try {
    if (fs.existsSync(archivePath)) {
      archive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
    }
  } catch {}
  archive.messages = [...(archive.messages || []), ...toArchive];
  writeJSON(archivePath, archive);
  if (sqlAdapter.useSqlite()) {
    sqlAdapter.writeArchiveData(projectId, sessionId, archive, writeJSON, sessionArchivePath);
  }
  return session;
}

export function updateSessionFields(projectId, sessionId, patch = {}) {
  const session = getSessionWithMessages(projectId, sessionId);
  Object.assign(session, patch);
  session.updated_at = now();
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);
  return session;
}

export function removeLastSessionMessage(projectId, sessionId, role = null) {
  const session = getSessionWithMessages(projectId, sessionId);
  if (!session.messages.length) return session;

  if (role) {
    const last = session.messages[session.messages.length - 1];
    if (last.role !== role) return session;
  }
  session.messages.pop();
  session.updated_at = now();
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  const index = readSessionIndex(projectId);
  if (index) {
    const entry = index.sessions.find((s) => s.id === sessionId);
    if (entry) {
      entry.message_count = session.messages.length;
      entry.updated_at = session.updated_at;
    }
    writeSessionIndex(projectId, index);
  }
  return session;
}

export function refreshSessionMemory(projectId, sessionId) {
  let session;
  try {
    session = getSessionWithMessages(projectId, sessionId);
  } catch {
    return null;
  }
  const count = session.messages?.length || 0;
  if (!shouldRefreshMemory(count, session.memory_message_count || 0)) return session;

  session.memory_summary = buildHeuristicMemorySummary(
    session.messages,
    session.memory_summary,
  );
  session.memory_updated_at = now();
  session.memory_message_count = count;
  session.updated_at = now();
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);
  return session;
}

export function getSessionArchive(projectId, sessionId) {
  return sqlAdapter.readArchiveData(projectId, sessionId, readJSON, sessionArchivePath);
}

function readSessionIndex(projectId) {
  return sqlAdapter.readIndexData(projectId, readJSON, sessionIndexPath);
}

function writeSessionIndex(projectId, index) {
  sqlAdapter.writeIndexData(projectId, index, writeJSON, sessionIndexPath);
}

function migrateLegacyChat(projectId) {
  const legacy = loadChatHistory(projectId);
  const id = randomUUID().slice(0, 12);
  const ts = now();
  const firstMsg = legacy.find(m => m.role === 'user');
  const title = firstMsg ? firstMsg.content.slice(0, 20) : '默认会话';

  const session = {
    id,
    title,
    messages: legacy,
    created_at: ts,
    updated_at: ts,
    memory_summary: '',
    memory_updated_at: null,
    memory_message_count: legacy.length,
    claude_session_id: null,
    context_notes: [],
  };
  const dir = sessionsDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  writeJSON(sessionFilePath(projectId, id), session);
  if (sqlAdapter.useSqlite()) sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  const index = {
    active_session_id: id,
    sessions: [{ id, title, created_at: ts, updated_at: ts, message_count: legacy.length }],
  };
  writeSessionIndex(projectId, index);

  // Rename legacy file
  const legacyPath = chatPath(projectId);
  try { fs.renameSync(legacyPath, legacyPath + '.bak'); } catch {}
  return index;
}

export function listSessions(projectId) {
  let index = readSessionIndex(projectId);
  if (!index) {
    index = migrateLegacyChat(projectId);
  }
  return index;
}

export function createSession(projectId, title, options = {}) {
  let index = readSessionIndex(projectId);
  if (!index) index = { active_session_id: '', sessions: [] };

  const id = randomUUID().slice(0, 12);
  const ts = now();
  const sessionTitle = title || '新会话';
  const boundFilename = options.bound_filename ?? null;
  const session = {
    id,
    title: sessionTitle,
    messages: [],
    created_at: ts,
    updated_at: ts,
    memory_summary: '',
    memory_updated_at: null,
    memory_message_count: 0,
    claude_session_id: null,
    context_notes: [],
    bound_filename: boundFilename,
  };

  fs.mkdirSync(sessionsDir(projectId), { recursive: true });
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  index.sessions.unshift(sessionIndexEntry(session));
  index.active_session_id = id;
  writeSessionIndex(projectId, index);
  return normalizeSession(session);
}

export function deleteSessionsForManuscript(projectId, filename) {
  const safe = path.basename(String(filename || ''));
  if (!safe) return;
  const index = readSessionIndex(projectId);
  if (!index?.sessions?.length) return;
  const toRemove = index.sessions.filter((s) => s.bound_filename === safe);
  for (const entry of toRemove) {
    try { fs.unlinkSync(sessionFilePath(projectId, entry.id)); } catch {}
    try { fs.unlinkSync(sessionArchivePath(projectId, entry.id)); } catch {}
  }
  index.sessions = index.sessions.filter((s) => s.bound_filename !== safe);
  if (toRemove.some((s) => s.id === index.active_session_id)) {
    index.active_session_id = index.sessions[0]?.id || '';
  }
  writeSessionIndex(projectId, index);
}

export function focusChapterSession(projectId, filename, chapterTitle = '') {
  const safe = path.basename(String(filename || ''));
  if (!safe) throw new Error('缺少文稿文件名');
  const index = listSessions(projectId);
  let entry = index.sessions.find((s) => s.bound_filename === safe);
  if (entry) {
    setActiveSession(projectId, entry.id);
    return { session: getSessionWithMessages(projectId, entry.id), ...listSessions(projectId) };
  }
  const title = chapterTitle
    ? `本章 · ${String(chapterTitle).slice(0, 24)}`
    : `本章 · ${safe.replace(/\.md$/i, '')}`;
  const session = createSession(projectId, title, { bound_filename: safe });
  return { session, ...listSessions(projectId) };
}

export function focusProjectSession(projectId) {
  let index = listSessions(projectId);
  let entry = index.sessions.find((s) => isProjectScopeSession(s));
  if (!entry) {
    createSession(projectId, '全书讨论', { bound_filename: SESSION_SCOPE_PROJECT });
    index = listSessions(projectId);
    entry = index.sessions.find((s) => s.bound_filename === SESSION_SCOPE_PROJECT)
      || index.sessions.find((s) => isProjectScopeSession(s));
  }
  if (entry) setActiveSession(projectId, entry.id);
  index = listSessions(projectId);
  const sid = index.active_session_id;
  return {
    session: sid ? getSessionWithMessages(projectId, sid) : null,
    ...index,
  };
}

export function getSessionWithMessages(projectId, sessionId) {
  const session = sqlAdapter.readSessionData(projectId, sessionId, readJSON, sessionFilePath);
  if (!session) throw new Error(`会话不存在: ${sessionId}`);
  return normalizeSession(session);
}

export function getActiveSessionId(projectId) {
  const index = listSessions(projectId);
  return index.active_session_id || index.sessions[0]?.id || '';
}

export function setActiveSession(projectId, sessionId) {
  const index = listSessions(projectId);
  if (!index.sessions.find(s => s.id === sessionId)) throw new Error(`会话不存在: ${sessionId}`);
  index.active_session_id = sessionId;
  writeSessionIndex(projectId, index);
  return index;
}

export function appendSessionMessage(projectId, sessionId, role, content, extra = {}) {
  const session = getSessionWithMessages(projectId, sessionId);
  const ts = now();
  session.messages.push({ id: randomUUID().slice(0, 12), role, content, at: ts, ...extra });
  archiveOverflowMessages(session, projectId, sessionId);
  session.updated_at = ts;

  const index = readSessionIndex(projectId);
  if (index) {
    const entry = index.sessions.find(s => s.id === sessionId);
    if (entry) {
      entry.updated_at = ts;
      entry.message_count = session.messages.length;
      if (entry.title === '新会话' && role === 'user') {
        entry.title = content.slice(0, 20);
        session.title = entry.title;
      }
    }
    index.sessions.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    writeSessionIndex(projectId, index);
  }

  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);
  return session;
}

export function deleteSession(projectId, sessionId) {
  const p = sessionFilePath(projectId, sessionId);
  try { fs.unlinkSync(p); } catch {}

  const index = readSessionIndex(projectId);
  if (index) {
    index.sessions = index.sessions.filter(s => s.id !== sessionId);
    if (index.active_session_id === sessionId) {
      index.active_session_id = index.sessions[0]?.id || '';
    }
    writeSessionIndex(projectId, index);
  }
  return index;
}

export function renameSession(projectId, sessionId, title) {
  const session = getSessionWithMessages(projectId, sessionId);
  session.title = title;
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  const index = readSessionIndex(projectId);
  if (index) {
    const entry = index.sessions.find(s => s.id === sessionId);
    if (entry) entry.title = title;
    writeSessionIndex(projectId, index);
  }
  return session;
}

export function clearSessionMessages(projectId, sessionId) {
  const session = getSessionWithMessages(projectId, sessionId);
  session.messages = [];
  session.memory_summary = '';
  session.memory_updated_at = null;
  session.memory_message_count = 0;
  session.claude_session_id = null;
  session.context_notes = [];
  session.updated_at = now();
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  const archivePath = sessionArchivePath(projectId, sessionId);
  try { fs.unlinkSync(archivePath); } catch {}
  if (sqlAdapter.useSqlite()) {
    sqlAdapter.writeArchiveData(projectId, sessionId, { messages: [] }, writeJSON, sessionArchivePath);
  }

  const index = readSessionIndex(projectId);
  if (index) {
    const entry = index.sessions.find(s => s.id === sessionId);
    if (entry) { entry.message_count = 0; entry.updated_at = session.updated_at; }
    writeSessionIndex(projectId, index);
  }
  return session;
}

// ── Jobs ──

export function loadJobs() {
  return sqlAdapter.readKv(sqlAdapter.KV_KEYS.jobs, JOBS_PATH, {}, readJSON);
}
export function saveJobs(jobs) {
  sqlAdapter.writeKv(sqlAdapter.KV_KEYS.jobs, JOBS_PATH, jobs, writeJSON);
}

export function getJob(jobId) {
  const jobs = loadJobs();
  if (!jobs[jobId]) throw new Error(`任务不存在: ${jobId}`);
  return jobs[jobId];
}

export function createJob(projectId, jobType, params) {
  const jobId = randomUUID().slice(0, 16);
  const job = { id: jobId, project_id: projectId, type: jobType, params, status: 'queued', steps: [], result: null, error: null, created_at: now(), updated_at: now() };
  const jobs = loadJobs();
  jobs[jobId] = job;
  saveJobs(jobs);
  return job;
}

export function updateJob(jobId, fields) {
  const jobs = loadJobs();
  Object.assign(jobs[jobId], fields, { updated_at: now() });
  saveJobs(jobs);
  return jobs[jobId];
}

export function appendJobStep(jobId, step, status, detail = '') {
  const job = getJob(jobId);
  job.steps.push({ step, status, detail, at: now() });
  updateJob(jobId, { steps: job.steps });
}

