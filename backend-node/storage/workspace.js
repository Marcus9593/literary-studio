import fs from 'fs';
import path from 'path';
import { decodeBuffer, decodeUploadFilename, looksLikeMojibake } from '../lib/encoding.js';
import { manuscriptDirForMode } from '../lib/projectProfile.js';
import { sanitizeManuscriptForSave } from '../ai-runtime/output-sanitize.js';
import { getProject, touchProject, workspacePath } from './projects.js';
import { deleteSessionsForManuscript } from './sessions.js';

const WORKSPACE_SUBDIRS = ['正文', '大纲', '设定集', 'archive', '试验稿', '.webnovel'];
const KNOWN_WORKSPACE_DIRS = new Set(['正文', '大纲', '设定集', 'archive', '试验稿', '.webnovel']);

function uniqueDestPath(destPath) {
  if (!fs.existsSync(destPath)) return destPath;
  const dir = path.dirname(destPath);
  const ext = path.extname(destPath);
  const base = path.basename(destPath, ext);
  let n = 2;
  while (fs.existsSync(path.join(dir, `${base}-${n}${ext}`))) n += 1;
  return path.join(dir, `${base}-${n}${ext}`);
}

/** zip 导入后整理目录：剥掉多余外层文件夹、根目录 md 归入正文/ */
export function normalizeImportedWorkspace(projectId) {
  const ws = workspacePath(projectId);
  if (!fs.existsSync(ws)) return { chapters: 0 };

  const bodyDir = path.join(ws, '正文');
  fs.mkdirSync(bodyDir, { recursive: true });

  for (const name of fs.readdirSync(ws)) {
    if (!name.endsWith('.md')) continue;
    const src = path.join(ws, name);
    if (!fs.statSync(src).isFile()) continue;
    fs.renameSync(src, uniqueDestPath(path.join(bodyDir, name)));
  }

  const topDirs = fs.readdirSync(ws, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !KNOWN_WORKSPACE_DIRS.has(d.name) && !d.name.startsWith('.'));

  if (topDirs.length === 1) {
    const wrapper = path.join(ws, topDirs[0].name);
    const innerBody = path.join(wrapper, '正文');
    if (fs.existsSync(innerBody)) {
      for (const name of fs.readdirSync(innerBody)) {
        if (!name.endsWith('.md')) continue;
        const src = path.join(innerBody, name);
        if (!fs.statSync(src).isFile()) continue;
        fs.renameSync(src, uniqueDestPath(path.join(bodyDir, name)));
      }
    } else {
      for (const name of fs.readdirSync(wrapper)) {
        if (!name.endsWith('.md')) continue;
        const src = path.join(wrapper, name);
        if (!fs.statSync(src).isFile()) continue;
        fs.renameSync(src, uniqueDestPath(path.join(bodyDir, name)));
      }
    }
    try {
      if (fs.readdirSync(wrapper).length === 0) fs.rmdirSync(wrapper);
    } catch { /* ignore */ }
  }

  ensureWorkspaceDirs(ws);
  return { chapters: listChapters(projectId).length };
}

export function ensureWorkspaceDirs(workspace) {
  for (const sub of WORKSPACE_SUBDIRS) {
    fs.mkdirSync(path.join(workspace, sub), { recursive: true });
  }
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

export function listMdFilesInDir(dir) {
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
  // 先清理关联会话，再删除文件，避免文件删除后会话清理失败导致孤立数据
  try {
    deleteSessionsForManuscript(projectId, safe);
  } catch (e) {
    console.error(`[storage] 清理关联会话失败 (${safe}):`, e.message);
  }
  fs.unlinkSync(filePath);
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
  const maxNum = existing.reduce((max, f) => {
    // listMdFilesInDir 返回对象数组，需要使用 f.filename
    const m = (f.filename || f).match(/^第(\d+)章/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const num = maxNum + 1;
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
