import fs from 'fs';
import path from 'path';

const MANIFEST_NAMES = ['studio-manifest.json', 'skill-manifest.json'];
const ENTRY_CANDIDATES = [
  'scripts/webnovel.py',
  'scripts/main.py',
  'scripts/cli.py',
  'scripts/run.py',
  'scripts/main.sh',
  'scripts/run.sh',
];

const WEBNOVEL_BUILTIN_COMMANDS = [
  'preflight',
  'where',
  'use',
  'init',
  'index',
  'state',
  'context',
  'extract-context',
  'status',
  'backup',
  'archive',
  'migrate',
  'rag',
  'style',
  'entity',
  'memory',
  'story-system',
];

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function listScriptsInDir(dir, prefix = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      if (['node_modules', '__pycache__', '.git', 'cache'].includes(ent.name)) continue;
      out.push(...listScriptsInDir(full, rel));
      continue;
    }
    if (!/\.(py|sh|js|mjs|cjs)$/i.test(ent.name)) continue;
    out.push({
      id: rel.replace(/\.(py|sh|js|mjs|cjs)$/i, ''),
      path: full,
      relative: rel,
      name: ent.name,
    });
  }
  return out;
}

function loadManifest(skillFolder) {
  for (const name of MANIFEST_NAMES) {
    const fp = path.join(skillFolder, name);
    if (fs.existsSync(fp)) {
      const raw = readJsonSafe(fp);
      if (raw) return { path: fp, data: raw };
    }
  }
  return null;
}

function inferEntry(skillFolder) {
  const manifest = loadManifest(skillFolder);
  if (manifest?.data?.entry) {
    const entry = manifest.data.entry;
    const rel = entry.path || entry.script;
    if (rel) {
      const abs = path.join(skillFolder, rel);
      if (fs.existsSync(abs)) {
        return {
          source: 'manifest',
          path: abs,
          relative: rel,
          runner: entry.runner || null,
          inject_project_root: entry.inject_project_root !== false,
          project_root_flag: entry.project_root_flag || '--project-root',
          cwd: entry.cwd ? path.join(skillFolder, entry.cwd) : path.dirname(abs),
        };
      }
    }
  }

  for (const rel of ENTRY_CANDIDATES) {
    const abs = path.join(skillFolder, rel);
    if (fs.existsSync(abs)) {
      return {
        source: 'convention',
        path: abs,
        relative: rel,
        runner: rel.endsWith('.py') ? 'python' : rel.endsWith('.sh') ? 'bash' : null,
        inject_project_root: rel.includes('webnovel.py'),
        project_root_flag: '--project-root',
        cwd: path.dirname(abs),
      };
    }
  }

  const scriptsDir = path.join(skillFolder, 'scripts');
  const scripts = listScriptsInDir(scriptsDir);
  if (scripts.length === 1) {
    const s = scripts[0];
    return {
      source: 'single_script',
      path: s.path,
      relative: `scripts/${s.relative}`,
      runner: null,
      inject_project_root: false,
      project_root_flag: '--project-root',
      cwd: path.dirname(s.path),
    };
  }

  return null;
}

function buildCommands(skillFolder, entry, manifest) {
  const commands = {};

  if (manifest?.data?.commands) {
    for (const [name, spec] of Object.entries(manifest.data.commands)) {
      commands[name] = {
        args: Array.isArray(spec) ? spec : (spec.args || []),
        description: spec.description || '',
      };
    }
  }

  if (entry?.relative?.endsWith('webnovel.py')) {
    for (const cmd of WEBNOVEL_BUILTIN_COMMANDS) {
      if (!commands[cmd]) {
        commands[cmd] = { args: [cmd], description: `webnovel ${cmd}` };
      }
    }
  }

  return commands;
}

/**
 * @param {string} skillFolder - skill 根目录（含 SKILL.md）
 * @param {{ subSkill?: string }} [opts]
 */
export function discoverSkillCapabilities(skillFolder, opts = {}) {
  const folder = path.resolve(skillFolder);
  if (!fs.existsSync(folder)) {
    throw new Error(`Skill 目录不存在: ${folder}`);
  }

  const manifestWrap = loadManifest(folder);
  const entry = inferEntry(folder);
  const scripts = listScriptsInDir(path.join(folder, 'scripts'), '');

  const subSkills = [];
  const skillsDir = path.join(folder, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir)) {
      const subRoot = path.join(skillsDir, name);
      if (!fs.statSync(subRoot).isDirectory()) continue;
      const subScripts = listScriptsInDir(path.join(subRoot, 'scripts'), '');
      subSkills.push({
        name,
        has_skill_md: fs.existsSync(path.join(subRoot, 'SKILL.md')),
        scripts: subScripts,
        entry: inferEntry(subRoot),
      });
    }
  }

  let activeFolder = folder;
  let activeEntry = entry;
  if (opts.subSkill) {
    const subRoot = path.join(skillsDir, opts.subSkill);
    if (fs.existsSync(subRoot)) {
      activeFolder = subRoot;
      activeEntry = inferEntry(subRoot) || entry;
    }
  }

  const commands = buildCommands(folder, entry, manifestWrap);
  const activeScripts = listScriptsInDir(path.join(activeFolder, 'scripts'), '');

  return {
    schema: 'skill_capabilities',
    skill_folder: folder,
    active_folder: activeFolder,
    sub_skill: opts.subSkill || null,
    manifest: manifestWrap ? { path: manifestWrap.path, version: manifestWrap.data?.version } : null,
    entry: activeEntry
      ? {
        path: activeEntry.path,
        relative: activeEntry.relative,
        source: activeEntry.source,
        runner: activeEntry.runner,
        inject_project_root: activeEntry.inject_project_root,
        project_root_flag: activeEntry.project_root_flag,
      }
      : null,
    commands,
    scripts: scripts.map((s) => ({ id: s.id, relative: `scripts/${s.relative}`, name: s.name })),
    active_scripts: activeScripts.map((s) => ({ id: s.id, relative: s.relative, name: s.name })),
    sub_skills: subSkills,
    invoke_modes: [
      entry ? 'entry_command' : null,
      scripts.length ? 'script_argv' : null,
      'raw_argv',
    ].filter(Boolean),
  };
}
