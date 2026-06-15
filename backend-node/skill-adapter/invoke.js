import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { resolveSkillById, getDefaultSkillBinding } from './skill-config.js';
import { discoverSkillCapabilities } from './discover.js';
import { runScript, tryParseJson } from './runner.js';

function splitArgv(input) {
  if (Array.isArray(input)) return input.map(String);
  const s = String(input || '').trim();
  if (!s) return [];
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) { out.push(cur); cur = ''; }
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function resolveSkillContext(skillId, subSkill) {
  const skill = resolveSkillById(skillId);
  if (!skill) throw new Error(`未找到 Skill：${skillId}`);
  const folder = skill.folder;
  let activeFolder = folder;
  if (subSkill) {
    const subRoot = path.join(folder, 'skills', subSkill);
    if (fs.existsSync(subRoot)) activeFolder = subRoot;
  }
  return { skill, folder, activeFolder, subSkill: subSkill || null };
}

function buildEnv({ skillFolder, projectRoot }) {
  const scriptsDir = path.join(skillFolder, 'scripts');
  const env = {
    SKILL_ROOT: skillFolder,
    LITERARY_STUDIO_SKILL_ROOT: skillFolder,
  };
  if (projectRoot) {
    env.LITERARY_STUDIO_PROJECT_ROOT = projectRoot;
    env.PROJECT_ROOT = projectRoot;
  }
  if (skillFolder.includes('literary-writer')) {
    env.LITERARY_WRITER_ROOT = path.dirname(scriptsDir) === skillFolder
      ? skillFolder
      : skillFolder;
  }
  return env;
}

function buildArgv({
  capabilities,
  command,
  args,
  argv,
  projectRoot,
}) {
  if (argv?.length) return argv.map(String);

  const entry = capabilities.entry;
  const cmdKey = String(command || '').trim();

  if (cmdKey && capabilities.commands[cmdKey]) {
    const spec = capabilities.commands[cmdKey];
    return [...(spec.args || []), ...args];
  }

  if (entry && cmdKey) {
    return [cmdKey, ...args];
  }

  if (args.length) return args;

  throw new Error('请提供 command、args 或 argv');
}

/**
 * 调用 Skill 内脚本/CLI
 * @param {{
 *   skillId?: string,
 *   subSkill?: string,
 *   command?: string,
 *   args?: string[],
 *   argv?: string[],
 *   script?: string,
 *   projectId?: string,
 *   projectRoot?: string,
 *   cwd?: string,
 *   timeoutMs?: number,
 *   useDefaultSkill?: boolean,
 * }} opts
 */
export async function invokeSkill(opts = {}) {
  let skillId = opts.skillId;
  let subSkill = opts.subSkill || null;

  if (!skillId && opts.useDefaultSkill !== false) {
    const binding = getDefaultSkillBinding();
    if (binding) {
      skillId = binding.skill_id;
      subSkill = subSkill || binding.sub_skill;
    }
  }

  if (!skillId) throw new Error('未指定 skill_id，且未配置默认 Skill');

  const { skill, folder, activeFolder } = resolveSkillContext(skillId, subSkill);
  const capabilities = discoverSkillCapabilities(folder, { subSkill });

  let projectRoot = opts.projectRoot || null;
  if (!projectRoot && opts.projectId) {
    projectRoot = storage.workspacePath(opts.projectId);
  }

  const extraArgs = (opts.args || []).map(String);
  let targetScript = null;
  let argv;

  if (opts.script) {
    const rel = opts.script.replace(/^\//, '');
    const candidates = [
      path.join(activeFolder, rel),
      path.join(folder, rel),
      path.join(activeFolder, 'scripts', rel),
      path.join(folder, 'scripts', rel),
    ];
    targetScript = candidates.find((p) => fs.existsSync(p));
    if (!targetScript) throw new Error(`未找到脚本: ${opts.script}`);
    argv = opts.argv?.length
      ? opts.argv.map(String)
      : buildArgv({ capabilities, command: opts.command, args: extraArgs, argv: null, projectRoot });
  } else {
    const entry = capabilities.entry;
    if (!entry) {
      throw new Error(`Skill「${skill.name}」没有可执行入口（缺少 studio-manifest.json 或 scripts/ 约定入口）`);
    }
    targetScript = entry.path;
    argv = buildArgv({
      capabilities,
      command: opts.command,
      args: extraArgs,
      argv: opts.argv,
      projectRoot,
    });
  }

  if (capabilities.entry?.inject_project_root && projectRoot) {
    const flag = capabilities.entry.project_root_flag || '--project-root';
    const hasFlag = argv.some((a, i) => a === flag || String(a).startsWith(`${flag}=`));
    if (!hasFlag) {
      argv = [flag, projectRoot, ...argv];
    }
  }

  const env = buildEnv({ skillFolder: folder, projectRoot });
  const cwd = opts.cwd || capabilities.entry?.cwd || path.dirname(targetScript);

  const result = await runScript(targetScript, argv, {
    cwd,
    env,
    timeoutMs: opts.timeoutMs,
    runner: capabilities.entry?.runner || undefined,
  });

  const json = tryParseJson(result.stdout);

  return {
    schema: 'skill_invoke_result',
    ok: result.code === 0 && !result.killed,
    skill_id: skillId,
    skill_name: skill.name,
    sub_skill: subSkill,
    script: targetScript,
    argv,
    cwd,
    project_root: projectRoot,
    exit_code: result.code,
    killed: result.killed,
    stdout: result.stdout,
    stderr: result.stderr,
    json,
  };
}

export function getSkillCapabilities(skillId, subSkill = null) {
  const skill = resolveSkillById(skillId);
  if (!skill) throw new Error(`未找到 Skill：${skillId}`);
  return discoverSkillCapabilities(skill.folder, { subSkill });
}

export function getDefaultSkillCapabilities() {
  const binding = getDefaultSkillBinding();
  if (!binding) return null;
  return {
    binding,
    capabilities: getSkillCapabilities(binding.skill_id, binding.sub_skill),
  };
}

/** literary-writer 兼容：preflight */
export async function runSkillPreflight(projectId, skillId = null) {
  const result = await invokeSkill({
    skillId: skillId || undefined,
    command: 'preflight',
    args: ['--format', 'json'],
    projectId,
    useDefaultSkill: !skillId,
  });
  return {
    ok: result.ok,
    report: result.json || { raw: result.stdout },
    error: result.ok ? null : (result.stderr || result.stdout || 'preflight 失败'),
    invoke: result,
  };
}
