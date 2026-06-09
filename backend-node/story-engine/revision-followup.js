import { appendAction, newActionId } from '../story-actions/store.js';
import { createPlan } from '../story-plans/store.js';

function buildTaskExecutionPrompt(task, governor, workspaceRef) {
  return `【规则审稿修订任务】
目标：${task.target || 'overall'}
原因：${task.reason}
动作：${task.action}
${governor?.revision_memo ? `\nGovernor 备忘录：${governor.revision_memo}` : ''}
${workspaceRef ? `\n文稿：${workspaceRef}` : ''}

请基于系统已注入的正文节选执行改稿，保持设定与人设一致。`;
}

function buildPlanExecutionPrompt({ governor, revisionTasks, workspaceRef }) {
  const lines = (revisionTasks || []).map(
    (t, i) => `${i + 1}. [${t.target || 'overall'}] ${t.action}（${t.reason}）`,
  );
  return `【编剧室修订计划 · Governor ${governor?.decision || 'REVISE'}】
${governor?.revision_memo ? `总指令：${governor.revision_memo}\n` : ''}
修订任务：
${lines.join('\n')}
${workspaceRef ? `\n目标文稿：${workspaceRef}` : ''}

请逐条落实以上修订，完成后保存正文。`;
}

export function createActionsFromRevisionTasks(projectId, {
  reportId,
  revisionTasks = [],
  governor,
  workspaceRef,
  unitIndex,
}) {
  const actions = [];
  for (const task of revisionTasks) {
    const action = {
      id: newActionId('act_cr'),
      type: 'conflict_boost',
      source: 'critic',
      source_ref: `critic:${reportId}:p${task.priority}`,
      critic_report_id: reportId,
      unit_index: unitIndex,
      workspace_ref: workspaceRef,
      title: `审稿修订 · ${task.target || 'overall'}`,
      diagnosis: task.reason,
      proposal: task.action,
      execution_mode: 'rewrite_plan',
      priority: 88 - (task.priority || 0),
      impact_estimate: {
        metric: '审稿达标',
        delta: '待修订',
        risk: governor?.decision === 'REJECT' ? 'high' : 'medium',
      },
      execution_prompt: buildTaskExecutionPrompt(task, governor, workspaceRef),
    };
    const saved = appendAction(projectId, action, 'critic');
    const created = saved.items.find((a) => a.id === action.id);
    if (created) actions.push(created);
  }
  return actions;
}

export function createRevisionPlan(projectId, {
  reportId,
  pipelineId,
  governor,
  revisionTasks = [],
  workspaceRef,
  unitIndex,
}) {
  const steps = revisionTasks.map((t, i) => ({
    step: i + 1,
    action: t.action,
    detail: t.reason,
  }));

  if (!steps.length && governor?.revision_memo) {
    steps.push({
      step: 1,
      action: '按 Governor 备忘录修订',
      detail: governor.revision_memo,
    });
  }

  return createPlan(projectId, {
    type: 'rewrite',
    source: 'engine_revision',
    critic_report_id: reportId,
    pipeline_id: pipelineId,
    chapter: unitIndex,
    chapter_filename: workspaceRef,
    user_request: governor?.revision_memo || '规则审稿修订',
    steps,
    execution_prompt: buildPlanExecutionPrompt({ governor, revisionTasks, workspaceRef }),
    summary: `编剧室修订 · ${governor?.decision || 'REVISE'}`,
    impact_estimate: {
      metric: 'Governor 决策',
      delta: governor?.decision,
      risk: governor?.decision === 'REJECT' ? 'high' : 'medium',
    },
  });
}

/**
 * Critic REVISE/REJECT → Actions；剧本模式可自动建 Plan。
 */
export function syncRevisionFollowup(projectId, engineResult, { createPlan: shouldCreatePlan = true, workType } = {}) {
  const governor = engineResult?.governor;
  const tasks = engineResult?.critic?.professional_review?.revision_tasks || [];

  if (!governor || !['REVISE', 'REJECT'].includes(governor.decision)) {
    return { actions: [], plan: null, skipped: true };
  }

  const actions = createActionsFromRevisionTasks(projectId, {
    reportId: engineResult.report_id,
    revisionTasks: tasks,
    governor,
    workspaceRef: engineResult.workspace_ref,
    unitIndex: engineResult.unit_index,
  });

  const isScreenplay = String(workType || '').startsWith('screenplay') || workType === 'web_short';
  let plan = null;
  if (shouldCreatePlan && isScreenplay && governor.decision === 'REVISE') {
    plan = createRevisionPlan(projectId, {
      reportId: engineResult.report_id,
      pipelineId: engineResult.pipeline_id,
      governor,
      revisionTasks: tasks,
      workspaceRef: engineResult.workspace_ref,
      unitIndex: engineResult.unit_index,
    });
  }

  return { actions, plan, skipped: false };
}
