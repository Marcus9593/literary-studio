import { sortByPlannerOrder } from './queue-order.js';

/** @deprecated 使用 sortByPlannerOrder（Planner 队列，非 Scheduler 决策） */
export function rankTasks(items, opts = {}) {
  return sortByPlannerOrder(items, opts);
}

export function rankTasksByChapter(items) {
  return [...(items || [])]
    .filter((t) => t.status === 'todo')
    .sort((a, b) => (a.chapter || 999) - (b.chapter || 999));
}
