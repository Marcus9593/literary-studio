import fs from 'fs';
import path from 'path';
import { decodeBuffer } from './encoding.js';
import { getProject, workspacePath, touchProject } from '../storage/projects.js';
import { listMdFilesInDir } from '../storage/workspace.js';

/** 允许 AI 落盘的子目录（相对 workspace 根） */
export const ALLOWED_WRITE_DIRS = ['正文', '大纲', '设定集', 'archive', '试验稿'];

const CATEGORY_BY_DIR = {
  正文: 'manuscript',
  大纲: 'outline',
  设定集: 'settings',
  archive: 'archive',
  试验稿: 'draft',
};

const PANEL_BY_CATEGORY = {
  manuscript: 'manuscripts',
  outline: 'outline',
  settings: 'settings',
  archive: 'archive',
  draft: 'draft',
};

function safeStat(fp) {
  try {
    return fs.statSync(fp);
  } catch {
    return null;
  }
}

function listTrackableMdFiles(wsRoot) {
  const out = new Map();
  const scanDir = (relDir) => {
    const abs = path.join(wsRoot, relDir);
    if (!fs.existsSync(abs)) return;
    for (const name of fs.readdirSync(abs)) {
      if (!name.endsWith('.md')) continue;
      const fp = path.join(abs, name);
      if (!safeStat(fp)?.isFile()) continue;
      const rel = relDir ? `${relDir}/${name}` : name;
      out.set(rel.replace(/\\/g, '/'), fp);
    }
  };

  for (const dir of ALLOWED_WRITE_DIRS) scanDir(dir);
  // 根目录 stray md（待归位）
  for (const name of fs.readdirSync(wsRoot)) {
    if (!name.endsWith('.md')) continue;
    const fp = path.join(wsRoot, name);
    if (!safeStat(fp)?.isFile()) continue;
    out.set(name, fp);
  }
  return out;
}

export function snapshotWorkspace(projectId) {
  const ws = workspacePath(projectId);
  const files = listTrackableMdFiles(ws);
  const snap = new Map();
  for (const [rel, abs] of files) {
    const st = safeStat(abs);
    if (!st) continue;
    snap.set(rel, { mtimeMs: st.mtimeMs, size: st.size });
  }
  return snap;
}

function guessTargetDir(filename) {
  const lower = String(filename || '').toLowerCase();
  if (/大纲|outline|梗概|阶段|设定|总纲/.test(lower)) return '大纲';
  if (/第\d+章|chapter|正文/.test(lower)) return '正文';
  if (/试验|draft/.test(lower)) return '试验稿';
  if (/archive|旧稿|归档/.test(lower)) return 'archive';
  return '大纲';
}

function uniqueDestPath(destPath) {
  if (!fs.existsSync(destPath)) return destPath;
  const dir = path.dirname(destPath);
  const ext = path.extname(destPath);
  const base = path.basename(destPath, ext);
  let n = 2;
  while (fs.existsSync(path.join(dir, `${base}-${n}${ext}`))) n += 1;
  return path.join(dir, `${base}-${n}${ext}`);
}

/** 将 workspace 根目录下的 stray .md 归位到允许子目录 */
export function normalizeStrayWorkspaceFiles(projectId) {
  const ws = workspacePath(projectId);
  if (!fs.existsSync(ws)) return [];

  const moved = [];
  for (const name of fs.readdirSync(ws)) {
    if (!name.endsWith('.md')) continue;
    const src = path.join(ws, name);
    if (!safeStat(src)?.isFile()) continue;

    const targetDir = guessTargetDir(name);
    const destDir = path.join(ws, targetDir);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = uniqueDestPath(path.join(destDir, path.basename(name)));
    try {
      fs.renameSync(src, dest);
      moved.push({
        from: name,
        to: path.relative(ws, dest).replace(/\\/g, '/'),
        subdir: targetDir,
      });
    } catch (err) {
      console.warn('[workspace-sync] 归位失败', name, err.message);
    }
  }
  if (moved.length) touchProject(projectId);
  return moved;
}

export function classifyWorkspaceRelPath(relPath) {
  const norm = String(relPath || '').replace(/\\/g, '/');
  const parts = norm.split('/');
  const filename = parts[parts.length - 1];
  const subdir = parts.length > 1 ? parts[0] : null;

  if (subdir && CATEGORY_BY_DIR[subdir]) {
    const category = CATEGORY_BY_DIR[subdir];
    return {
      relPath: norm,
      filename,
      subdir,
      category,
      panel: PANEL_BY_CATEGORY[category],
      displayPath: `${subdir}/${filename}`,
    };
  }

  return {
    relPath: norm,
    filename,
    subdir: subdir || null,
    category: 'outline',
    panel: 'outline',
    displayPath: norm,
  };
}

function fileMetaFromPath(projectId, relPath, absPath, changeType) {
  const info = classifyWorkspaceRelPath(relPath);
  let words = 0;
  let title = path.parse(info.filename).name;
  try {
    const text = decodeBuffer(fs.readFileSync(absPath));
    words = text.replace(/[\s\n]/g, '').length;
    const h1 = text.match(/(?:^|\n)#\s+([^\n]+)/);
    if (h1?.[1]?.trim()) title = h1[1].trim();
  } catch {}

  return {
    change: changeType,
    rel_path: info.relPath,
    display_path: info.displayPath,
    filename: info.filename,
    subdir: info.subdir,
    category: info.category,
    panel: info.panel,
    title,
    words,
  };
}

export function diffWorkspace(projectId, beforeSnap) {
  normalizeStrayWorkspaceFiles(projectId);
  const ws = workspacePath(projectId);
  const afterFiles = listTrackableMdFiles(ws);
  const changes = [];

  for (const [rel, abs] of afterFiles) {
    const st = safeStat(abs);
    if (!st) continue;
    const prev = beforeSnap?.get?.(rel);
    if (!prev) {
      changes.push(fileMetaFromPath(projectId, rel, abs, 'added'));
    } else if (prev.mtimeMs !== st.mtimeMs || prev.size !== st.size) {
      changes.push(fileMetaFromPath(projectId, rel, abs, 'modified'));
    }
  }

  return changes;
}

export function getWorkspaceSummary(projectId) {
  const ws = workspacePath(projectId);
  const meta = getProject(projectId);
  return {
    project_id: projectId,
    project_title: meta.title,
    workspace_root: ws,
    allowed_dirs: ALLOWED_WRITE_DIRS,
    manuscript_count: listMdFilesInDir(path.join(ws, '正文')).length,
    outline_count: listMdFilesInDir(path.join(ws, '大纲')).length,
    settings_count: listMdFilesInDir(path.join(ws, '设定集')).length,
  };
}

export function buildWorkspacePathRules(projectId) {
  const ws = workspacePath(projectId);
  const meta = getProject(projectId);
  const title = meta.title || '未命名项目';
  const dirs = ALLOWED_WRITE_DIRS.filter((d) => d !== '.webnovel').join('、');

  return `【项目落盘规则 — 必须遵守】
- 当前项目：《${title}》
- 唯一工作区根目录（cwd）：${ws}
- 所有新建/修改的 .md 必须写在该根目录下的子文件夹内：${dirs}
- 禁止在项目根目录外创建文件；禁止在 workspace 根目录直接新建 .md（应写入对应子目录）
- 大纲、梗概、阶段规划 → 写入 大纲/（例如 大纲/第1章梗概.md）
- 章节正文 → 写入 正文/（例如 正文/第0001章-标题.md）
- 人物设定 → 写入 设定集/
- 试验性文稿 → 写入 试验稿/
- 写完后在回复中说明完整相对路径（如 大纲/xxx.md），不要只说文件名`;
}

export function readWorkspaceFileByMeta(projectId, fileMeta) {
  const ws = workspacePath(projectId);
  const rel = fileMeta?.rel_path || (fileMeta?.subdir
    ? `${fileMeta.subdir}/${fileMeta.filename}`
    : fileMeta?.filename);
  const abs = path.join(ws, rel.replace(/\//g, path.sep));
  if (!abs.startsWith(ws)) throw new Error('路径无效');
  if (!fs.existsSync(abs)) throw new Error('文件不存在');
  const content = decodeBuffer(fs.readFileSync(abs));
  const info = classifyWorkspaceRelPath(rel.replace(/\\/g, '/'));
  return { ...info, content };
}
