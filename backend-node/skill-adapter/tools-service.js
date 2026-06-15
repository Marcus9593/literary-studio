import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as sqlAdapter from '../storage/sqlite/adapter.js';
import { discoverSkillCapabilities } from './discover.js';
import {
  BUNDLED_LITERARY_WRITER,
  BUNDLED_SKILLS_DIR,
  bundledLiteraryWriterAvailable,
} from './literary-writer-paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data'));
const TOOLS_CONFIG_PATH = path.join(DATA_DIR, 'tools.json');

const DEFAULT_SKILL_SCAN_DIRS = [
  ...(bundledLiteraryWriterAvailable() ? [BUNDLED_SKILLS_DIR] : []),
  path.join(os.homedir(), '.claude', 'skills'),
  path.join(os.homedir(), '.cursor', 'skills'),
  path.join(os.homedir(), '.codex', 'skills'),
];

const FIND_SKILL_ROOT = path.resolve(
  process.env.FIND_SKILL_ROOT || path.join(os.homedir(), '.claude', 'skills', 'find-skill'),
);
const FIND_SKILL_CATALOGUE = path.join(FIND_SKILL_ROOT, 'cache', 'catalogue.json');
const FIND_SKILL_INSTALL_SCRIPT = path.join(FIND_SKILL_ROOT, 'scripts', 'install-skill.sh');
const FIND_SKILL_UPDATE_SCRIPT = path.join(FIND_SKILL_ROOT, 'update-skills-catalogue.sh');

export function loadToolsConfig() {
  try {
    const fromKv = sqlAdapter.useSqlite()
      ? sqlAdapter.readKv(sqlAdapter.KV_KEYS.tools, TOOLS_CONFIG_PATH, null, (p, fb) => {
        try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fb; }
      })
      : null;
    if (fromKv) return fromKv;
    if (fs.existsSync(TOOLS_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(TOOLS_CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return { skill_scan_dirs: [], extra_paths: {} };
}

export function saveToolsConfig(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOOLS_CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  if (sqlAdapter.useSqlite()) {
    sqlAdapter.writeKv(sqlAdapter.KV_KEYS.tools, TOOLS_CONFIG_PATH, data, (p, d) => {
      fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf-8');
    });
  }
  return data;
}

function resolveLiteraryWriterRoot() {
  const cfg = loadToolsConfig();
  const custom = String(cfg.literary_writer_root || '').trim();
  if (custom) {
    const p = path.resolve(custom.replace(/^~/, os.homedir()));
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  }
  const env = process.env.LITERARY_WRITER_ROOT;
  if (env) {
    const p = path.resolve(env.replace(/^~/, os.homedir()));
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  }
  const candidates = [
    BUNDLED_LITERARY_WRITER,
    path.join(os.homedir(), '.claude', 'skills', 'literary-writer'),
    path.join(os.homedir(), '.cursor', 'skills', 'literary-writer'),
    path.join(ROOT, '..', 'skills', 'literary-writer'),
  ];
  for (const c of candidates) {
    const resolved = path.resolve(c);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return resolved;
    }
  }
  return path.resolve(candidates[0]);
}

function webnovelPyPath(skillsRoot) {
  return path.join(skillsRoot, 'scripts', 'webnovel.py');
}

function getSkillScanDirs() {
  const cfg = loadToolsConfig();
  const extra = (cfg.skill_scan_dirs || []).map((p) =>
    path.resolve(String(p).replace(/^~/, os.homedir())),
  );
  const dirs = [];
  const seen = new Set();
  for (const p of [...DEFAULT_SKILL_SCAN_DIRS, ...extra]) {
    try {
      if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) continue;
      const key = fs.realpathSync(p);
      if (seen.has(key)) continue;
      seen.add(key);
      dirs.push(key);
    } catch {}
  }
  return dirs;
}

function parseFrontmatter(text) {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end < 0) return {};
  const block = text.slice(3, end).trim();
  const meta = {};
  for (const line of block.split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    val = val.replace(/^["']|["']$/g, '');
    meta[key] = val;
  }
  return meta;
}

function skillEntry(skillMd, scanRoot) {
  const folder = path.dirname(skillMd);
  const text = fs.readFileSync(skillMd, 'utf-8');
  const meta = parseFrontmatter(text);
  const rel = path.relative(scanRoot, folder);
  const subSkills = [];
  const skillsDir = path.join(folder, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir)) {
      const sub = path.join(skillsDir, name, 'SKILL.md');
      if (fs.existsSync(sub)) subSkills.push(name);
    }
  }
  let entry_relative = null;
  let command_count = 0;
  try {
    const caps = discoverSkillCapabilities(folder);
    entry_relative = caps.entry?.relative || null;
    command_count = Object.keys(caps.commands || {}).length;
  } catch {}
  return {
    id: rel.split(path.sep).join('__'),
    name: meta.name || path.basename(folder),
    folder,
    relative_path: rel,
    description: (meta.description || '').slice(0, 280),
    has_scripts: fs.existsSync(path.join(folder, 'scripts')),
    sub_skills: subSkills.sort(),
    is_literary_writer: folder.includes('literary-writer'),
    invocable: Boolean(entry_relative),
    entry_relative,
    command_count,
  };
}

export function scanInstalledSkills() {
  const items = [];
  const seen = new Set();
  for (const scanRoot of getSkillScanDirs()) {
    walkSkillMd(scanRoot, scanRoot, (skillMd) => {
      const folder = fs.realpathSync(path.dirname(skillMd));
      if (seen.has(folder)) return;
      if (skillMd.includes(`${path.sep}cache${path.sep}`)) return;
      seen.add(folder);
      try {
        items.push(skillEntry(skillMd, scanRoot));
      } catch {}
    });
  }
  items.sort((a, b) => {
    if (a.is_literary_writer !== b.is_literary_writer) {
      return a.is_literary_writer ? -1 : 1;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
  return items;
}

function walkSkillMd(dir, scanRoot, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkSkillMd(full, scanRoot, onFile);
    } else if (ent.name === 'SKILL.md') {
      onFile(full);
    }
  }
}

function catalogueMeta() {
  if (!fs.existsSync(FIND_SKILL_CATALOGUE)) {
    return { total: 0, updated_at: null, stale: true };
  }
  try {
    const data = JSON.parse(fs.readFileSync(FIND_SKILL_CATALOGUE, 'utf-8'));
    const updated = data.updated_at;
    let stale = true;
    if (updated) {
      const dt = new Date(updated);
      const ageDays = (Date.now() - dt.getTime()) / (86400 * 1000);
      stale = ageDays > 30;
    }
    return {
      total: data.total ?? (data.skills || []).length,
      updated_at: updated,
      stale,
      sources: data.sources || {},
    };
  } catch {
    return { total: 0, updated_at: null, stale: true };
  }
}

export function getToolsOverview() {
  const skillsRoot = resolveLiteraryWriterRoot();
  const webnovel = webnovelPyPath(skillsRoot);
  const installed = scanInstalledSkills();
  return {
    literary_writer: {
      path: skillsRoot,
      webnovel_cli: fs.existsSync(webnovel),
      webnovel_path: webnovel,
      exists: fs.existsSync(skillsRoot),
    },
    find_skill: {
      path: FIND_SKILL_ROOT,
      catalogue_available: fs.existsSync(FIND_SKILL_CATALOGUE),
      install_script: fs.existsSync(FIND_SKILL_INSTALL_SCRIPT),
      ...catalogueMeta(),
    },
    installed_skills_count: installed.length,
    skill_scan_dirs: getSkillScanDirs(),
    config: loadToolsConfig(),
  };
}

export function setLiteraryWriterRoot(dirPath) {
  const p = path.resolve(dirPath.replace(/^~/, os.homedir()));
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    throw new Error(`目录不存在: ${p}`);
  }
  const cfg = loadToolsConfig();
  cfg.literary_writer_root = p;
  saveToolsConfig(cfg);
  process.env.LITERARY_WRITER_ROOT = p;
  const webnovel = webnovelPyPath(p);
  return {
    path: p,
    webnovel_cli: fs.existsSync(webnovel),
    webnovel_path: webnovel,
  };
}

export function searchCatalogue(query = '', { limit = 20, page = 1, agent = 'any' } = {}) {
  if (!fs.existsSync(FIND_SKILL_CATALOGUE)) {
    return {
      items: [],
      total: 0,
      page,
      limit,
      query,
      message: '未找到 find-skill 目录，请先安装 find-skill 技能',
    };
  }
  const data = JSON.parse(fs.readFileSync(FIND_SKILL_CATALOGUE, 'utf-8'));
  let skills = data.skills || [];
  const q = query.trim().toLowerCase();
  if (q) {
    skills = skills.filter((s) => {
      const agents = s.agents || [];
      if (agent !== 'any' && !agents.includes(agent)) return false;
      const name = String(s.name || '').replace(/^\[([^\]]+)\].*/, '$1');
      const hay = `${name} ${s.description || ''} ${s.repo || ''} ${(s.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }
  const total = skills.length;
  const start = (page - 1) * limit;
  const items = skills.slice(start, start + limit);
  return { items, total, page, limit, query };
}

export function installSkill({ source, target = 'claude', force = false }) {
  if (!fs.existsSync(FIND_SKILL_INSTALL_SCRIPT)) {
    throw new Error(`未找到安装脚本: ${FIND_SKILL_INSTALL_SCRIPT}`);
  }
  const cmd = ['bash', FIND_SKILL_INSTALL_SCRIPT, source, '--target', target];
  if (force) cmd.push('--force');
  const out = execSync(cmd.join(' '), { encoding: 'utf-8', timeout: 300000, maxBuffer: 4 * 1024 * 1024 });
  return { ok: true, source, target, output: out.slice(-2000) };
}

export function updateCatalogue() {
  if (!fs.existsSync(FIND_SKILL_UPDATE_SCRIPT)) {
    throw new Error(`未找到更新脚本: ${FIND_SKILL_UPDATE_SCRIPT}`);
  }
  const out = execSync(`bash "${FIND_SKILL_UPDATE_SCRIPT}"`, {
    encoding: 'utf-8',
    timeout: 600000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return { ok: true, meta: catalogueMeta(), output: out.slice(-1500) };
}

