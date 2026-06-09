import { sortByPlannerOrder, getMandatoryNextTask } from './queue-order.js';

/**
 * Scheduler：仅在 Planner 已排好序的队列上装箱（公约 3 — 不决策、不重排）
 */
export function scheduleTodayTasks(tasksDoc, preferences) {
  const prefs = preferences || {};
  const capacity = prefs.daily_capacity_minutes ?? 120;
  const maxCount = prefs.preferred_task_count ?? 3;

  const candidates = sortByPlannerOrder(tasksDoc?.items || [], { status: 'todo' });
  const scheduled = [];
  let usedMinutes = 0;

  for (const task of candidates) {
    const est = task.estimate_minutes || 60;
    if (scheduled.length >= maxCount) break;
    if (usedMinutes + est > capacity && scheduled.length > 0) continue;
    if (usedMinutes + est > capacity && scheduled.length === 0) {
      scheduled.push(task);
      usedMinutes += est;
      break;
    }
    scheduled.push(task);
    usedMinutes += est;
  }

  if (scheduled.length === 0 && candidates.length > 0) {
    scheduled.push(candidates[0]);
    usedMinutes = candidates[0].estimate_minutes || 60;
  }

  return {
    tasks: scheduled,
    total_minutes: usedMinutes,
    total_hours: Math.round((usedMinutes / 60) * 10) / 10,
    capacity_minutes: capacity,
    remaining_todo: candidates.length - scheduled.length,
  };
}

export function getNextTask(tasksDoc, _preferences) {
  return getMandatoryNextTask(tasksDoc);
}
