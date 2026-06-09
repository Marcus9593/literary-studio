import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** 工程内嵌 literary-writer skill 根目录 */
export const BUNDLED_LITERARY_WRITER = path.join(ROOT, 'skills', 'literary-writer');
export const BUNDLED_SKILLS_DIR = path.join(ROOT, 'skills');

export function bundledLiteraryWriterAvailable() {
  return fs.existsSync(path.join(BUNDLED_LITERARY_WRITER, 'SKILL.md'));
}

export function resolveBundledOrCustom(customPath) {
  const p = String(customPath || '').trim();
  if (p) {
    const resolved = path.resolve(p.replace(/^~(?=$|[\\/])/, os.homedir()));
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return resolved;
    }
  }
  if (bundledLiteraryWriterAvailable()) return BUNDLED_LITERARY_WRITER;
  return null;
}
