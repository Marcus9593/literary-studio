import fs from 'fs';
import path from 'path';
import {
  BUNDLED_LITERARY_WRITER,
  BUNDLED_SKILLS_DIR,
  bundledLiteraryWriterAvailable,
} from './literary-writer-paths.js';
import { loadToolsConfig, saveToolsConfig } from './tools-service.js';

/** 启动时将 tools.json 指向工程内嵌 skill，并加入 skill 扫描目录 */
export function bootstrapToolsConfig() {
  if (!bundledLiteraryWriterAvailable()) return;

  const cfg = loadToolsConfig();
  let changed = false;

  const root = String(cfg.literary_writer_root || '').trim();
  const rootValid = root && fs.existsSync(root) && fs.statSync(root).isDirectory();
  if (!rootValid || root !== BUNDLED_LITERARY_WRITER) {
    cfg.literary_writer_root = BUNDLED_LITERARY_WRITER;
    process.env.LITERARY_WRITER_ROOT = BUNDLED_LITERARY_WRITER;
    changed = true;
  }

  const scanDirs = Array.isArray(cfg.skill_scan_dirs) ? cfg.skill_scan_dirs.map(String) : [];
  const normalized = scanDirs.map((d) => path.normalize(d));
  if (!normalized.includes(path.normalize(BUNDLED_SKILLS_DIR))) {
    cfg.skill_scan_dirs = [BUNDLED_SKILLS_DIR, ...scanDirs];
    changed = true;
  }

  if (changed) {
    saveToolsConfig(cfg);
    console.log(`  [tools] literary-writer → ${BUNDLED_LITERARY_WRITER}`);
  }
}
