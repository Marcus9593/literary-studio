import { newActionId, appendAction } from '../story-actions/store.js';

const TYPE_MAP = {
  write_chapter: 'plan_chapter',
  rewrite_plan: 'conflict_boost',
  arc_step: 'arc_enhance',
  rewrite_chapter: 'conflict_boost',
  align_goal: 'arc_enhance',
  task: 'conflict_boost',
};

function buildProposal(verify, failedChecks) {
  const lines = failedChecks.map((c) => `- ${c.label}：${c.detail || '未达标'}`);
  if (verify.kind === 'write_chapter') {
    lines.push('- 检查章末是否有悬念或未解问题');
    lines.push('- 对照「后续章节」中本章目的是否落实');
  } else {
    lines.push('- 对照修改计划中的执行指令，逐条复核');
    if (verify.metrics_delta) {
      const d = verify.metrics_delta;
      if (d.arc_with_issues > 0) lines.push('- 成长线问题增多，建议补强人物抉择事件');
      if (d.conflict_with_gap > 0) lines.push('- 冲突缺口增多，建议增加正面对抗场景');
    }
  }
  return lines.join('\n');
}

function buildExecutionPrompt(verify, failedChecks, action) {
  return `【验收跟进 · 诊断建议】
来源：创作验收 #${verify.id || '—'}
任务：${verify.subject}

未达标项：
${failedChecks.map((c) => `· ${c.label}（${c.detail || '—'}）`).join('\n')}

建议：
${action.proposal}

请先 Read 相关章节与作品分析，给出 3 条可执行改稿要点，确认后再写入。`;
}

/**
 * 验收 fail/partial → Action（为什么）写回 actions.json
 */
export function createActionFromVerify(projectId, verifyRecord) {
  if (!verifyRecord || verifyRecord.status === 'pass') return null;

  const failedChecks = (verifyRecord.checks || []).filter((c) => !c.pass);
  if (!failedChecks.length) return null;

  const sourceRef = `verify:${verifyRecord.id}`;
  const type = TYPE_MAP[verifyRecord.kind] || 'conflict_boost';

  const action = {
    id: newActionId('act_vf'),
    type,
    source: 'verify',
    source_ref: sourceRef,
    verify_id: verifyRecord.id,
    plan_id: verifyRecord.plan_id || null,
    task_id: verifyRecord.task_id || null,
    chapter: verifyRecord.chapter ?? null,
    title: `验收跟进：${verifyRecord.subject}`,
    diagnosis: failedChecks.map((c) => `${c.label}（${c.detail || '未达标'}）`).join('；'),
    proposal: buildProposal(verifyRecord, failedChecks),
    execution_mode: 'rewrite_plan',
    priority: 92,
    impact_estimate: {
      metric: '验收达标率',
      delta: '待修复',
      risk: verifyRecord.status === 'fail' ? 'high' : 'medium',
    },
    execution_prompt: '',
  };
  action.execution_prompt = buildExecutionPrompt(verifyRecord, failedChecks, action);

  const saved = appendAction(projectId, action, 'verify');
  const created = saved.items.find((a) => a.id === action.id);
  return created || action;
}
