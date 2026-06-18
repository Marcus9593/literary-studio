import fs from 'fs';
import path from 'path';
import {
  bundledLiteraryWriterAvailable,
  resolveBundledLiteraryWriterPath,
  resolveBundledSkillsDir,
} from './literary-writer-paths.js';
import { loadToolsConfig, saveToolsConfig, scanInstalledSkills, isLiteraryWriterRoot } from './tools-service.js';

/** 启动时将 tools.json 指向内嵌 skill，并加入 skill 扫描目录 */
export function bootstrapToolsConfig() {
  const bundledRoot = resolveBundledLiteraryWriterPath();
  if (!bundledRoot) {
    if (!bundledLiteraryWriterAvailable()) {
      console.warn('  [tools] bundled literary-writer not found, skipping bootstrap');
    }
    return;
  }

  const bundledSkillsDir = resolveBundledSkillsDir();

  const cfg = loadToolsConfig();
  let changed = false;

  const root = String(cfg.literary_writer_root || '').trim();
  const rootValid = isLiteraryWriterRoot(root);
  if (!rootValid || path.normalize(root) !== path.normalize(bundledRoot)) {
    cfg.literary_writer_root = bundledRoot;
    process.env.LITERARY_WRITER_ROOT = bundledRoot;
    changed = true;
  }

  const scanDirs = Array.isArray(cfg.skill_scan_dirs) ? cfg.skill_scan_dirs.map(String) : [];
  const normalized = scanDirs.map((d) => path.normalize(d));
  if (!normalized.includes(path.normalize(bundledSkillsDir))) {
    cfg.skill_scan_dirs = [bundledSkillsDir, ...scanDirs];
    changed = true;
  }

  if (changed) {
    saveToolsConfig(cfg);
    changed = false;
  }

  if (!cfg.default_skill?.skill_id) {
    const installed = scanInstalledSkills();
    const lw = installed.find((s) => s.id === 'literary-writer' || s.is_literary_writer);
    if (lw) {
      cfg.default_skill = { skill_id: lw.id, sub_skill: null };
      changed = true;
    }
  }

  if (changed) {
    saveToolsConfig(cfg);
    console.log(`  [tools] literary-writer → ${bundledRoot}`);
  }
}
