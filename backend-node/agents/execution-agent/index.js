import { getPlan, updatePlanStatus, listPlans } from '../../story-plans/store.js';
import { runQuickSync } from '../../story-kb/rebuild.js';
import { verifyAfterPlanComplete } from '../../story-verify/index.js';
import { captureExecutionBaseline } from '../../story-verify/baseline.js';
import { updateSummariesAfterChapter } from '../../story-summaries/cascade.js';
import * as storage from '../../storage.js';
import { buildStoryContextBlocks } from '../chief-editor/context.js';
import { continuePipelineAfterRevision } from '../../story-engine/auto-pipeline.js';

function adaptExecutionPromptForHttp(prompt) {
  return String(prompt || '')
    .replace(/请先 Read[^\n，。]*[，。]?/g, '请基于系统上下文中已提供的文稿节选，')
    .replace(/不能读写本地文件系统/g, '请仅基于已注入的文稿节选');
}

function formatPlanBlock(plan, { httpMode = false } = {}) {
  const stepsText = (plan.steps || [])
    .map((s) => `${s.step}. ${s.action}${s.detail ? ` — ${s.detail}` : ''}`)
    .join('\n');
  const execPrompt = httpMode
    ? adaptExecutionPromptForHttp(plan.execution_prompt)
    : (plan.execution_prompt || '');
  return [
    `\n\n---\n\n【改稿计划 · ${plan.id} · 已确认执行】`,
    `类型：${plan.type || 'rewrite'}`,
    `目标：${plan.user_request || plan.summary || ''}`,
    plan.summary ? `摘要：${plan.summary}` : '',
    stepsText ? `步骤：\n${stepsText}` : '',
    `\n--- 执行指令 ---\n${execPrompt}`,
    `\n【总编辑说明】以上即为计划 #${plan.id} 的全部内容。请直接执行改稿任务，勿再向用户索取计划 ID 或计划正文。`,
  ].filter(Boolean).join('\n');
}

export function buildPlanExecuteRoute(projectId, plan, userMessage) {
  const userMsg = userMessage
    || `请执行上述改稿计划：${plan.user_request || plan.summary || ''}`;
  return {
    action: 'chat',
    intent: 'plan_execute',
    planId: plan.id,
    plan,
    contextBlocks: [
      ...buildStoryContextBlocks(projectId),
      formatPlanBlock(plan),
    ],
    user_message: userMsg,
  };
}

export function buildPlanExecuteRouteForHttp(projectId, plan, userMessage) {
  const userMsg = userMessage
    || `请执行上述改稿计划：${plan.user_request || plan.summary || ''}`;
  const planBlock = formatPlanBlock(plan, { httpMode: true });
  return {
    action: 'chat',
    intent: 'plan_execute',
    planId: plan.id,
    plan,
    contextBlocks: buildStoryContextBlocks(projectId),
    httpUserPrefix: planBlock,
    user_message: userMsg,
  };
}

export function prepareConfirmedPlan(projectId, planId) {
  const plan = getPlan(projectId, planId);
  if (plan.status === 'executing') {
    const route = buildPlanExecuteRoute(projectId, plan);
    captureExecutionBaseline(projectId, {
      planId: plan.id,
      taskId: plan.task_id,
      chapter: plan.chapter,
      kind: plan.type === 'chapter_plan' ? 'write_chapter' : 'rewrite_plan',
    });
    return { ...route, plan, user_message: route.user_message };
  }
  if (plan.status !== 'pending_confirm') {
    throw new Error('计划状态不可执行');
  }
  const executing = updatePlanStatus(projectId, planId, 'executing');
  captureExecutionBaseline(projectId, {
    planId: executing.id,
    taskId: executing.task_id,
    chapter: executing.chapter,
    kind: executing.type === 'chapter_plan' ? 'write_chapter' : 'rewrite_plan',
  });
  const route = buildPlanExecuteRoute(projectId, executing);
  return { ...route, plan: executing, user_message: route.user_message };
}

export function resolvePlanExecuteRoute(projectId, planId, userMessage, { httpMode = false } = {}) {
  const plan = getPlan(projectId, planId);
  if (!plan.execution_prompt) throw new Error('计划缺少执行指令');
  if (!['executing', 'pending_confirm'].includes(plan.status)) {
    throw new Error('计划状态不可执行');
  }
  return httpMode
    ? buildPlanExecuteRouteForHttp(projectId, plan, userMessage)
    : buildPlanExecuteRoute(projectId, plan, userMessage);
}

export async function completePlan(projectId, planId) {
  const plan = updatePlanStatus(projectId, planId, 'completed', {
    completed_at: new Date().toISOString(),
  });
  runQuickSync(projectId);
  const verifyWrap = verifyAfterPlanComplete(projectId, plan);
  let pipeline_continue = null;
  if (plan.source === 'engine_revision') {
    try {
      pipeline_continue = await continuePipelineAfterRevision(projectId, plan);
    } catch {
      pipeline_continue = null;
    }
  }
  return { plan, ...verifyWrap, pipeline_continue };
}

export async function afterChapterWritten(projectId, { filename, title, content }) {
  updateSummariesAfterChapter(projectId, { filename, title, content });
  try {
    runQuickSync(projectId);
  } catch {}
}

/** 计划 ID 直链执行（不经意图分类） */
export function resolvePlanExecutionFromMessage(projectId, message) {
  const msg = String(message || '').trim();
  const planExec = msg.match(/请执行已确认计划\s*#([a-zA-Z0-9-]+)/);
  if (planExec?.[1]) {
    try {
      const plan = getPlan(projectId, planExec[1]);
      if (plan.execution_prompt && (plan.status === 'executing' || plan.status === 'pending_confirm')) {
        return buildPlanExecuteRoute(projectId, plan, msg);
      }
    } catch {}
  }
  if (/请执行上述改稿计划/.test(msg)) {
    try {
      const executing = listPlans(projectId, { status: 'executing' });
      const plan = executing.find((p) => msg.includes(p.user_request || p.summary || ''))
        || executing[0];
      if (plan?.execution_prompt) {
        return buildPlanExecuteRoute(projectId, plan, msg);
      }
    } catch {}
  }
  return null;
}

export function routeExecutionIntent(projectId, message, intent) {
  const chapters = storage.listChapters(projectId);
  const msg = String(message || '').trim();

  if (intent === 'write_continue') {
    const numMatch = msg.match(/第\s*(\d+)\s*[章节场篇稿]|写第\s*(\d+)/);
    const cnMatch = msg.match(/第([一二三四五六七八九十百]+)[章节场篇稿]/);
    let next = chapters.length + 1;
    if (numMatch) {
      next = parseInt(numMatch[1] || numMatch[2], 10) || next;
    } else if (cnMatch) {
      const cn = cnMatch[1];
      const cnMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      next = cn.length === 1 ? (cnMap[cn] || next) : next;
    }
    return {
      action: 'write',
      chapter: next,
      title: `第${next}章`,
      outline: message,
      contextBlocks: buildStoryContextBlocks(projectId),
    };
  }

  return null;
}
