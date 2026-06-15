import fs from 'fs';
import path from 'path';
import { loadToolsConfig, saveToolsConfig, scanInstalledSkills } from './tools-service.js';
import { discoverSkillCapabilities } from './discover.js';

const OVERRIDE_PATTERNS = [
  /(?:改用|切换(?:到)?|临时用|这次用|本条用|请用|使用|用)\s*[「"']?([a-z][a-z0-9_-]*)\s*(?:skill|子技能|技能)?[」"']?/i,
  /\/skill\s+([a-z][a-z0-9_-]*)/i,
  /(?:skill|技能)\s*[：:]\s*([a-z][a-z0-9_-]*)/i,
];

function normalizeBinding(raw = {}) {
  const skillId = String(raw.skill_id || '').trim();
  const subSkill = String(raw.sub_skill || '').trim() || null;
  if (!skillId) return null;
  return { skill_id: skillId, sub_skill: subSkill };
}

export function getDefaultSkillBinding() {
  const cfg = loadToolsConfig();
  return normalizeBinding(cfg.default_skill);
}

export function setDefaultSkillBinding(payload = {}) {
  const cfg = loadToolsConfig();
  const skillId = String(payload.skill_id || '').trim();

  if (!skillId) {
    delete cfg.default_skill;
    saveToolsConfig(cfg);
    return { default_skill: null };
  }

  const installed = scanInstalledSkills();
  const skill = installed.find((s) => s.id === skillId);
  if (!skill) {
    throw new Error(`未找到 Skill：${skillId}`);
  }

  const subSkill = String(payload.sub_skill || '').trim() || null;
  if (subSkill && !(skill.sub_skills || []).includes(subSkill)) {
    throw new Error(`Skill「${skill.name}」没有子技能「${subSkill}」`);
  }

  cfg.default_skill = { skill_id: skillId, sub_skill: subSkill };
  saveToolsConfig(cfg);
  return { default_skill: cfg.default_skill, skill };
}

export function resolveSkillById(skillId) {
  if (!skillId) return null;
  return scanInstalledSkills().find((s) => s.id === skillId) || null;
}

function readSkillExcerpt(skillMdPath, maxChars = 2400) {
  try {
    const text = fs.readFileSync(skillMdPath, 'utf-8');
    const body = text.replace(/^---[\s\S]*?---\n?/, '').trim();
    return body.length > maxChars ? `${body.slice(0, maxChars)}…` : body;
  } catch {
    return '';
  }
}

export function buildSkillInstructionBlock(binding, { override = false } = {}) {
  if (!binding?.skill_id) return '';

  const skill = resolveSkillById(binding.skill_id);
  if (!skill) return '';

  const mainSkillMd = path.join(skill.folder, 'SKILL.md');
  const lines = [
    '## 默认 Skill 绑定（工具中心配置）',
    '',
    override
      ? '【本条消息临时 override】用户指定了其他 skill，本条优先按 override 执行；下一条若无特殊指定，仍回到默认 skill。'
      : '以下 binding 对本项目对话**持续生效**，除非用户在本条消息里明确要求改用其他 skill。',
    '',
    `- **主 Skill**：${skill.name}`,
    `- **目录**：\`${skill.folder}\``,
    `- **必须先 Read**：\`${mainSkillMd}\``,
  ];

  const sub = binding.sub_skill;
  if (sub) {
    const subPath = path.join(skill.folder, 'skills', sub, 'SKILL.md');
    lines.push(
      `- **默认子 Skill**：${sub}`,
      `- **子 Skill 路径**：\`${subPath}\``,
      `- 执行任务前 Read 子 Skill 文件，并严格按其流程；不要跳到其他子 skill。`,
    );
    const excerpt = readSkillExcerpt(subPath, 1800);
    if (excerpt) {
      lines.push('', '### 子 Skill 要点（摘录）', excerpt);
    }
  } else if ((skill.sub_skills || []).length) {
    lines.push(
      `- 该 Skill 含子技能：${skill.sub_skills.join('、')}。未指定子 skill 时按主 SKILL.md 路由表自行选择最合适的一项。`,
    );
  }

  lines.push(
    '',
    '### 执行规则',
    '1. 默认只使用上述 skill（及指定子 skill），不要擅自切换到其他 skill。',
    '2. 仅当用户**在本条消息**里明确说「改用 xxx」「/skill xxx」「这次用 xxx skill」等，才可临时 override。',
    '3. override 只影响当前这一条；之后恢复默认 binding。',
    '4. 需要读文件、写稿、跑脚本时，优先通过该 skill 规定的流程与工具完成。',
  );

  const mainExcerpt = readSkillExcerpt(mainSkillMd, sub ? 800 : 1600);
  if (mainExcerpt && !sub) {
    lines.push('', '### 主 Skill 要点（摘录）', mainExcerpt);
  }

  try {
    const caps = discoverSkillCapabilities(skill.folder, { subSkill: sub || undefined });
    if (caps.entry) {
      lines.push(
        '',
        '### 平台 Skill 适配器（可执行）',
        `文匠 Studio 后端可通过 Skill 适配器直接调用本 skill 脚本，无需依赖模型自行 Bash。`,
        `- **入口**：\`${caps.entry.relative}\``,
        `- **调用 API**：\`POST /api/projects/{projectId}/skill/invoke\``,
      );
      const cmdNames = Object.keys(caps.commands || {}).slice(0, 12);
      if (cmdNames.length) {
        lines.push(`- **已注册命令**：${cmdNames.join('、')}${Object.keys(caps.commands).length > 12 ? '…' : ''}`);
      }
      if ((caps.scripts || []).length) {
        lines.push(`- **scripts/** 下另有 ${caps.scripts.length} 个可执行脚本，可用 \`script\` + \`argv\` 调用`);
      }
    }
  } catch {}

  return `\n\n---\n\n${lines.join('\n')}`;
}

export function detectSkillOverride(message, defaultBinding) {
  const text = String(message || '').trim();
  if (!text) return null;

  for (const re of OVERRIDE_PATTERNS) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const token = m[1].toLowerCase().replace(/-skill$/, '');
    if (!token) continue;

    // Same as default — not an override
    if (defaultBinding?.sub_skill === token) continue;
    const skill = defaultBinding ? resolveSkillById(defaultBinding.skill_id) : null;
    if (skill?.name?.toLowerCase() === token) continue;

    const installed = scanInstalledSkills();
    for (const s of installed) {
      if (s.name?.toLowerCase() === token || s.id.toLowerCase().includes(token)) {
        return { skill_id: s.id, sub_skill: null, override: true, token };
      }
      const sub = (s.sub_skills || []).find((n) => n.toLowerCase() === token);
      if (sub) {
        return { skill_id: s.id, sub_skill: sub, override: true, token };
      }
    }
  }
  return null;
}

export function resolveSkillForMessage(message) {
  const defaultBinding = getDefaultSkillBinding();
  const override = detectSkillOverride(message, defaultBinding);
  if (override) {
    return {
      binding: { skill_id: override.skill_id, sub_skill: override.sub_skill },
      isOverride: true,
      defaultBinding,
    };
  }
  return {
    binding: defaultBinding,
    isOverride: false,
    defaultBinding,
  };
}

export function describeDefaultSkill() {
  const binding = getDefaultSkillBinding();
  if (!binding) return null;
  const skill = resolveSkillById(binding.skill_id);
  if (!skill) return { ...binding, valid: false };
  return {
    ...binding,
    valid: true,
    skill_name: skill.name,
    folder: skill.folder,
    sub_skills: skill.sub_skills || [],
    label: binding.sub_skill ? `${skill.name} / ${binding.sub_skill}` : skill.name,
    workflow: skill.workflow || null,
  };
}

const BUILTIN_WORKFLOWS = {
  'character-master': {
    name: '角色塑造大师',
    type: 'workflow',
    steps: ['analyze-character', 'generate-content', 'review-content'],
  },
  'outline-master': {
    name: '大纲结构大师',
    type: 'workflow',
    steps: ['analyze-outline', 'generate-content'],
  },
};

function readSkillWorkflowMeta(skill) {
  if (!skill?.folder) return null;
  const metaPath = path.join(skill.folder, 'workflow.json');
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }
  } catch {}
  const cfg = loadToolsConfig();
  const custom = cfg.skill_workflows?.[skill.id];
  if (custom) return custom;
  return BUILTIN_WORKFLOWS[skill.id] || null;
}

export function resolveSkillWorkflow(binding) {
  if (!binding?.skill_id) return null;
  const skill = resolveSkillById(binding.skill_id);
  if (!skill) return null;
  const wf = readSkillWorkflowMeta(skill);
  if (!wf || wf.type !== 'workflow' || !Array.isArray(wf.steps) || !wf.steps.length) {
    return null;
  }
  return { ...wf, skill_id: skill.id, skill_name: skill.name };
}
