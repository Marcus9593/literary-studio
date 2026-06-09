import { createPlan, getPlan } from '../story-plans/store.js';
import { getTask, updateTaskStatus } from './store.js';
import { loadChapterRoadmap } from '../story-planner/store.js';
import { captureExecutionBaseline } from '../story-verify/baseline.js';

function buildWritePrompt(task, roadmap) {
  const ch = roadmap?.chapters?.find((c) => c.chapter === task.chapter);
  const purpose = ch?.purpose || task.purpose || '推进主线';
  return `【Story OS · 写章任务】
请撰写第 ${task.chapter} 章。

本章目的：${purpose}
${ch?.hooks?.length ? `章末要求：${ch.hooks.join('、')}` : '章末保留悬念钩子。'}

请先 Read 正文目录与大纲，再输出完整章节 Markdown 正文。`;
}

function buildRewritePrompt(task) {
  return `【Story OS · 改稿任务】
${task.title}

关联章节：第 ${task.chapter || '—'} 章
目标：${task.purpose || task.title}

请先 Read 相关章节正文，给出 3 条可执行改稿要点，再按作者确认执行。`;
}

/**
 * Task → 可执行 Plan（Sprint 1 最小闭环）
 */
export function createPlanFromTask(projectId, taskId) {
  const task = getTask(projectId, taskId);
  if (task.plan_id) {
    try {
      const existing = getPlan(projectId, task.plan_id);
      if (existing && ['executing', 'pending_confirm', 'completed'].includes(existing.status)) {
        return existing;
      }
    } catch {
      /* plan missing — recreate below */
    }
  }
  const roadmap = loadChapterRoadmap(projectId);

  if (task.type === 'write_chapter') {
    const plan = createPlan(projectId, {
      type: 'chapter_plan',
      task_id: task.id,
      user_request: task.title,
      chapter: task.chapter,
      steps: [
        { step: 1, action: '读取上下文', detail: '正文、大纲、路线图本章目的' },
        { step: 2, action: '撰写正文', detail: task.purpose },
        { step: 3, action: '章末钩子', detail: '确保悬念与路线图一致' },
      ],
      execution_prompt: buildWritePrompt(task, roadmap),
      summary: task.title,
      execution_mode: 'write_continue',
    });
    updateTaskStatus(projectId, taskId, 'in_progress', { plan_id: plan.id });
    captureExecutionBaseline(projectId, {
      planId: plan.id,
      taskId: task.id,
      chapter: task.chapter,
      kind: 'write_chapter',
    });
    return plan;
  }

  const plan = createPlan(projectId, {
    type: 'rewrite',
    task_id: task.id,
    user_request: task.title,
    chapter: task.chapter,
    steps: [
      { step: 1, action: '定位章节', detail: `第 ${task.chapter} 章` },
      { step: 2, action: '执行改稿', detail: task.purpose || task.title },
    ],
    execution_prompt: buildRewritePrompt(task),
    summary: task.title,
    execution_mode: 'rewrite_plan',
  });
  updateTaskStatus(projectId, taskId, 'in_progress', { plan_id: plan.id });
  captureExecutionBaseline(projectId, {
    planId: plan.id,
    taskId: task.id,
    chapter: task.chapter,
    kind: task.type,
  });
  return plan;
}
