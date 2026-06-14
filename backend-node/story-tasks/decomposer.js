import { newTaskId, saveTasks, loadTasks } from './store.js';
import { assignPlannerOrder } from './queue-order.js';

function taskMergeKey(t) {
  return `${t.type}:${t.source_ref}`;
}

/** 重建路线时保留已完成 / 进行中的任务状态 */
function mergePreservedStatuses(oldItems, newItems) {
  const oldByKey = new Map((oldItems || []).map((t) => [taskMergeKey(t), t]));
  return newItems.map((t) => {
    const old = oldByKey.get(taskMergeKey(t));
    if (!old) return t;
    if (old.status === 'done') {
      return {
        ...t,
        status: 'done',
        plan_id: old.plan_id,
        completed_at: old.completed_at,
        planner_order: old.planner_order ?? t.planner_order,
      };
    }
    if (old.status === 'in_progress') {
      return {
        ...t,
        status: 'in_progress',
        plan_id: old.plan_id,
        planner_order: old.planner_order ?? t.planner_order,
      };
    }
    return t;
  });
}

const ARC_KEYWORDS = /成长|独立|弧光|蜕变|觉醒|背叛|抉择/;
const CONFLICT_KEYWORDS = /冲突|对峙|升级|对抗|张力/;

function estimateWriteMinutes(chapterPurpose) {
  if (/重写|改稿/.test(chapterPurpose)) return 75;
  return 90;
}

function estimateArcMinutes() {
  return 45;
}

/**
 * Roadmap → Task 队列（Task Generation Engine 核心）
 */
export function decomposeTasksFromRoadmap(projectId, roadmap, storyGoal, ctx) {
  const items = [];
  const arcName = ctx.arcs?.[0]?.name;

  for (const original of roadmap.chapters || []) {
    const ch = { ...original };
    const writeId = newTaskId();
    items.push({
      id: writeId,
      title: `撰写第 ${ch.chapter} 章：${ch.purpose}`,
      type: 'write_chapter',
      source: 'roadmap',
      source_ref: `chapter:${ch.chapter}`,
      chapter: ch.chapter,
      purpose: ch.purpose,
      status: 'todo',
      priority: 95 - (ch.chapter - roadmap.range.from),
      estimate_minutes: estimateWriteMinutes(ch.purpose),
      plan_id: null,
      completed_at: null,
    });
    ch.task_ids = [writeId];

    if (ARC_KEYWORDS.test(ch.purpose) || (arcName && ch.chapter % 2 === 0)) {
      const arcId = newTaskId();
      items.push({
        id: arcId,
        title: arcName
          ? `补强${arcName}成长节点（第 ${ch.chapter} 章）`
          : `补强人物成长节点（第 ${ch.chapter} 章）`,
        type: 'arc_step',
        source: 'roadmap',
        source_ref: `chapter:${ch.chapter}:arc`,
        chapter: ch.chapter,
        purpose: ch.purpose,
        status: 'todo',
        priority: 80 - (ch.chapter - roadmap.range.from),
        estimate_minutes: estimateArcMinutes(),
        plan_id: null,
        completed_at: null,
      });
      ch.task_ids.push(arcId);
    }

    if (CONFLICT_KEYWORDS.test(ch.purpose)) {
      const confId = newTaskId();
      items.push({
        id: confId,
        title: `强化冲突场景（第 ${ch.chapter} 章）`,
        type: 'rewrite_chapter',
        source: 'roadmap',
        source_ref: `chapter:${ch.chapter}:conflict`,
        chapter: ch.chapter,
        purpose: ch.purpose,
        status: 'todo',
        priority: 75 - (ch.chapter - roadmap.range.from),
        estimate_minutes: 60,
        plan_id: null,
        completed_at: null,
      });
      ch.task_ids.push(confId);
    }
  }

  if (storyGoal?.major_changes?.length) {
    items.push({
      id: newTaskId(),
      title: `对齐故事目标：${storyGoal.major_changes[0].slice(0, 36)}`,
      type: 'align_goal',
      source: 'story_goal',
      source_ref: 'goal:0',
      chapter: null,
      status: 'todo',
      estimate_minutes: 30,
      plan_id: null,
      completed_at: null,
    });
  }

  const ordered = assignPlannerOrder(items);

  const existing = loadTasks(projectId);
  const merged = existing.items?.length
    ? mergePreservedStatuses(existing.items, ordered)
    : ordered;

  return saveTasks(projectId, { items: merged });
}

export { saveTasks };
