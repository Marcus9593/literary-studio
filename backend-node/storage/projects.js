import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  normalizeWorkType,
  normalizeCreationMode,
  manuscriptDirForMode,
} from '../projectProfile.js';
import { resolveProjectCardSummary } from '../project-summary.js';
import { normalizeProjectStatus } from '../project-meta-fields.js';
import { PROJECTS_DIR, now, sqlAdapter } from './core.js';
import { listChapters, listMdFilesInDir, ensureWorkspaceDirs } from './workspace.js';

// ── Projects ──
// 注意：以下存储层函数不包含权限检查。
// 权限控制由路由层（routes.js）的中间件负责：
//   - requireAuth: 验证用户身份
//   - attachProjectParam: 验证项目读权限
//   - requireProjectWrite: 验证项目写权限
//   - requireProjectManage: 验证项目管理权限（仅 owner）
// 调用方须自行确保已通过权限检查。

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

  // 剧本类型创建 screenplay.json（须在 meta 写入之后，saveScreenplay 会 touchProject）
  if (isScreenplayType(work_type)) {
    const screenplayData = defaultScreenplayData(work_type, title);
    saveScreenplay(projectId, screenplayData);
  }

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

/**
 * 删除项目及其所有文件。
 *
 * ⚠️ 此函数不做权限检查！
 * 路由层已通过 requireProjectManage 中间件保护。
 * 任何直接调用此函数的代码必须自行确保权限。
 */
export function deleteProject(projectId) {
  fs.rmSync(projectDir(projectId), { recursive: true, force: true });
}