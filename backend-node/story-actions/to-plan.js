import { createPlan } from '../story-plans/store.js';
import { getAction } from './store.js';
import { matchActionsForMessage } from './ranker.js';
import { loadActions } from './store.js';
import { loadUnderstandingBundle } from '../story-understanding/store.js';
import { findArcForMessage, buildArcAction } from '../story-understanding/arc-analyzer.js';
import { findConflictForMessage, buildConflictAction } from '../story-understanding/conflict-analyzer.js';

/**
 * Action → Plan 桥梁（公约 2：Action=为什么，Plan=怎么做）
 * 禁止：Action 直接 Execute；禁止：Plan 反向生成 Action 链（除 verify followup）
 */
export function createPlanFromAction(projectId, actionId) {
  const action = getAction(projectId, actionId);
  return createPlan(projectId, {
    type: 'rewrite',
    action_id: action.id,
    action_type: action.type,
    user_request: action.title,
    steps: [
      { step: 1, action: '诊断确认', detail: action.diagnosis },
      { step: 2, action: '方案细化', detail: action.proposal },
      { step: 3, action: '执行改稿', detail: '按 execution_prompt 重写目标章节' },
    ],
    execution_prompt: action.execution_prompt,
    summary: `${action.title} — 确认后执行改稿`,
    impact_estimate: action.impact_estimate,
  });
}

/**
 * 用户自然语言 → 匹配 Action → Plan
 */
export function createPlanFromUserRequest(projectId, message) {
  const actionsDoc = loadActions(projectId);
  let matched = matchActionsForMessage(actionsDoc, message);

  if (!matched.length) {
    const bundle = loadUnderstandingBundle(projectId);
    const arc = findArcForMessage(bundle.arcs, message);
    const arcAction = buildArcAction(arc);
    if (arcAction) matched.push(arcAction);

    const conflict = findConflictForMessage(bundle.conflicts, message);
    const confAction = buildConflictAction(conflict);
    if (/冲突|张力|对抗/.test(message) && confAction) matched.push(confAction);
  }

  const action = matched[0];
  if (!action) return null;

  if (action.id && actionsDoc.items?.some((a) => a.id === action.id)) {
    return createPlanFromAction(projectId, action.id);
  }

  return createPlan(projectId, {
    type: 'rewrite',
    action_type: action.type,
    user_request: message,
    steps: [
      { step: 1, action: '诊断', detail: action.diagnosis },
      { step: 2, action: '执行', detail: action.proposal },
    ],
    execution_prompt: action.execution_prompt,
    summary: action.title,
    impact_estimate: action.impact_estimate,
  });
}
