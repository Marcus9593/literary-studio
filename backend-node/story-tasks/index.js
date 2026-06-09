import { loadTasks, saveTasks } from './store.js';
import { assignPlannerOrder } from './queue-order.js';
import { loadPreferences, loadPlannerBundle } from '../story-planner/store.js';
import { scheduleTodayTasks, getNextTask } from './scheduler.js';
import { generateStoryOS, getPlannerSummary } from '../story-planner/planner.js';
import { createPlanFromTask } from './to-plan.js';

export {
  loadTasks,
  scheduleTodayTasks,
  getNextTask,
  createPlanFromTask,
};

function ensurePlannerQueue(projectId, tasksDoc) {
  if (!tasksDoc.items?.length) return tasksDoc;
  if (tasksDoc.items.every((t) => t.planner_order != null)) return tasksDoc;
  const ordered = assignPlannerOrder(tasksDoc.items);
  return saveTasks(projectId, { items: ordered });
}

export function getTodayCreation(projectId) {
  const prefs = loadPreferences(projectId);
  let bundle = loadPlannerBundle(projectId);
  let tasksDoc = ensurePlannerQueue(projectId, loadTasks(projectId));

  if (!bundle.chapter_roadmap?.chapters?.length || !tasksDoc.items?.length) {
    generateStoryOS(projectId, { horizon: prefs.default_horizon });
    bundle = loadPlannerBundle(projectId);
    tasksDoc = loadTasks(projectId);
  }

  const scheduled = scheduleTodayTasks(tasksDoc, prefs);
  const plannerSummary = getPlannerSummary(projectId);

  return {
    project_id: projectId,
    story_os_phase: 1,
    preferences: prefs,
    planner_summary: plannerSummary,
    story_goal: bundle.story_goal,
    roadmap: bundle.chapter_roadmap,
    today: scheduled,
    tasks_total_todo: tasksDoc.items.filter((t) => t.status === 'todo').length,
  };
}

export function startNextTask(projectId) {
  const prefs = loadPreferences(projectId);
  let tasksDoc = loadTasks(projectId);

  if (!tasksDoc.items?.length) {
    generateStoryOS(projectId, { horizon: prefs.default_horizon });
    tasksDoc = loadTasks(projectId);
  }

  const next = getNextTask(tasksDoc, prefs);
  if (!next) throw new Error('暂无待办任务，请先生成创作路线');

  const plan = createPlanFromTask(projectId, next.id);

  return {
    task: next,
    plan,
    action: 'execute',
  };
}

export { generateStoryOS, getPlannerSummary };
