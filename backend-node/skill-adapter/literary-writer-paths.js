import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');

/** 工程内嵌 skills 目录（开发：仓库根；打包：app.asar 内或 extraResources） */
export const BUNDLED_SKILLS_DIR = path.join(REPO_ROOT, 'skills');
export const BUNDLED_LITERARY_WRITER = path.join(BUNDLED_SKILLS_DIR, 'literary-writer');

export function bundledLiteraryWriterAvailable() {
  return fs.existsSync(path.join(BUNDLED_LITERARY_WRITER, 'SKILL.md'));
}

/** 优先使用 Electron 注入的物理路径（resources/skills），便于 Python 脚本执行 */
export function resolveBundledLiteraryWriterPath() {
  const envRoot = String(process.env.LITERARY_WRITER_ROOT || '').trim();
  if (envRoot) {
    const resolved = path.resolve(envRoot.replace(/^~(?=$|[\\/])/, os.homedir()));
    if (fs.existsSync(path.join(resolved, 'SKILL.md'))) return resolved;
  }
  if (bundledLiteraryWriterAvailable()) return BUNDLED_LITERARY_WRITER;
  return null;
}

export function resolveBundledSkillsDir() {
  const lw = resolveBundledLiteraryWriterPath();
  if (lw) return path.dirname(lw);
  return BUNDLED_SKILLS_DIR;
}

export function resolveBundledOrCustom(customPath) {
  const p = String(customPath || '').trim();
  if (p) {
    const resolved = path.resolve(p.replace(/^~(?=$|[\\/])/, os.homedir()));
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return resolved;
    }
  }
  return resolveBundledLiteraryWriterPath();
}
