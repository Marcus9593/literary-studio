import fs from 'fs';
import path from 'path';
import { workspacePath } from '../storage.js';

const MANAGED_DIRS = ['正文', '试验稿', '大纲', '设定集', 'archive'];

function collectMarkdownFiles(currentDir, ws, out) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(abs, ws, out);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(path.relative(ws, abs));
    }
  }
}

export function listManagedMarkdownPaths(projectId) {
  const ws = workspacePath(projectId);
  const paths = [];
  for (const dir of MANAGED_DIRS) {
    const absDir = path.join(ws, dir);
    if (!fs.existsSync(absDir)) continue;
    collectMarkdownFiles(absDir, ws, paths);
  }
  return paths.sort();
}

/** 捕获 workspace 文本快照（Version Domain 唯一写入源） */
export function captureWorkspaceFiles(projectId) {
  const ws = workspacePath(projectId);
  return listManagedMarkdownPaths(projectId).map((rel) => {
    const content = fs.readFileSync(path.join(ws, rel), 'utf-8');
    return {
      path: rel,
      content,
      words: content.replace(/[\s\n]/g, '').length,
    };
  });
}
