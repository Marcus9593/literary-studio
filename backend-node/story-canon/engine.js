import {
  listCanonRules,
  getOverrideBudget,
} from '../storage/sqlite/repos/canon-repo.js';

/**
 * Canon > Memory > AI Output
 * Keyword / negation matcher — extend with semantic checks later.
 */
function checkViolation(content, rule) {
  const text = String(content || '');
  const spec = String(rule.content || '').trim();
  if (!spec || !text) return false;

  const quoted = [...spec.matchAll(/[「【"']([^」】"']+)[」】"']/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  const hasNegation = /不得|不能|禁止|不可/.test(spec);

  for (const phrase of quoted) {
    if (hasNegation && text.includes(phrase)) return true;
  }

  const negPatterns = [...spec.matchAll(/(?:不得|不能|禁止|不可)([\u4e00-\u9fff\w]{2,24})/g)];
  for (const m of negPatterns) {
    if (text.includes(m[1])) return true;
  }

  if (rule.level === 'immutable' && /必须|始终|一定是/.test(spec)) {
    const req = spec.match(/(?:必须|始终|一定是)([\u4e00-\u9fff\w]{2,16})/);
    if (req && text.length > 300 && !text.includes(req[1])) return true;
  }

  const segments = spec.split(/[，。；、\n]/).map((s) => s.trim()).filter((s) => s.length >= 4);
  for (const seg of segments) {
    if (!/(不得|不能|禁止|不可)/.test(seg)) continue;
    const inner = seg.match(/(?:不得|不能|禁止|不可)([\u4e00-\u9fff\w]{2,24})/);
    if (inner && text.includes(inner[1])) return true;
  }

  return false;
}

export function validateCanon(projectId, content, unitIndex = 1) {
  const rules = listCanonRules(projectId, { activeOnly: true });

  for (const rule of rules) {
    if (!checkViolation(content, rule)) continue;

    if (rule.level === 'immutable') {
      return {
        level: 'immutable',
        action: 'block',
        message: `违反不可变设定：${rule.title}`,
        rule_id: rule.id,
      };
    }

    if (rule.level === 'semi_mutable') {
      const budget = getOverrideBudget(projectId, unitIndex);
      if (budget.used >= budget.max) {
        return {
          level: 'semi_mutable',
          action: 'block',
          message: `本单元 Override 预算已用尽（上限 ${budget.max}），无法覆盖：${rule.title}`,
          rule_id: rule.id,
        };
      }
      return {
        level: 'semi_mutable',
        action: 'review',
        message: `半可变设定需 Governor 审批：${rule.title}`,
        rule_id: rule.id,
      };
    }

    return {
      level: 'mutable',
      action: 'allow',
      message: `可变设定变更允许：${rule.title}`,
      rule_id: rule.id,
    };
  }

  return {
    level: 'mutable',
    action: 'allow',
    message: '未检测到设定冲突',
    rule_id: null,
  };
}

export function buildCanonContext(projectId) {
  const rules = listCanonRules(projectId, { activeOnly: true });
  if (!rules.length) return '尚未建立设定约束规则。';

  const lines = ['设定约束（必须遵守）：', ''];
  for (const r of rules) {
    lines.push(`- [${r.level}] ${r.title}: ${r.content}`);
  }
  return lines.join('\n');
}
