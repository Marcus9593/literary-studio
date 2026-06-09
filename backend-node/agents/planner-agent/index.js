import {
  getTodayCreation,
  startNextTask,
  generateStoryOS,
} from '../../story-tasks/index.js';
import { getNextTask } from '../../story-tasks/scheduler.js';
import { loadTasks, updateTaskStatus } from '../../story-tasks/store.js';
import { loadPreferences, loadChapterRoadmap } from '../../story-planner/store.js';
import { ALLOWED_HORIZONS } from '../../story-planner/paths.js';
import { prepareConfirmedPlan } from '../execution-agent/index.js';
import { captureExecutionBaseline } from '../../story-verify/baseline.js';
import { resolveGoalCurrentStateSummary } from '../../story-schemas/goal.js';
import { loadUnderstandingBundle } from '../../story-understanding/store.js';

function parseHorizon(msg, defaultHorizon = 5) {
  const m = msg.match(/(\d+)\s*章/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (ALLOWED_HORIZONS.includes(n)) return n;
  }
  return defaultHorizon;
}

function formatTodayMessage(today) {
  const lines = today.today.tasks.map(
    (t, i) => `${i + 1}. ${t.title}（约 ${t.estimate_minutes} 分钟）`,
  );
  return [
    `【今日创作】预计 ${today.today.total_hours} 小时（容量 ${today.today.capacity_minutes} 分钟）`,
    today.planner_summary?.summary ? `路线：${today.planner_summary.summary}` : '',
    ...lines,
  ].filter(Boolean).join('\n');
}

function goalDisplayLine(storyGoal, projectId) {
  let understanding = null;
  try {
    understanding = loadUnderstandingBundle(projectId);
  } catch {}
  const summary = resolveGoalCurrentStateSummary(storyGoal, understanding) || '（见作品分析）';
  const target = storyGoal?.target_state || '';
  return `创作目标：${summary.slice(0, 60)}… → ${target.slice(0, 60)}…`;
}

export function routePlannerIntent(projectId, message, intent) {
  const msg = String(message || '').trim();

  switch (intent) {
    case 'plan_today': {
      const today = getTodayCreation(projectId);
      return {
        action: 'tasks_today',
        intent: 'plan_today',
        today,
        message: formatTodayMessage(today),
      };
    }
    case 'plan_next': {
      const prefs = loadPreferences(projectId);
      let tasksDoc = loadTasks(projectId);
      if (!tasksDoc.items?.length) {
        generateStoryOS(projectId, { horizon: prefs.default_horizon });
        tasksDoc = loadTasks(projectId);
      }
      const next = getNextTask(tasksDoc, prefs);
      if (!next) {
        return {
          action: 'notify',
          message: '暂无待办任务，请先说「接下来 N 章」生成创作路线。',
        };
      }
      if (next.type === 'write_chapter') {
        updateTaskStatus(projectId, next.id, 'in_progress');
        captureExecutionBaseline(projectId, {
          taskId: next.id,
          chapter: next.chapter,
          kind: 'write_chapter',
        });
        const roadmap = loadChapterRoadmap(projectId);
        const ch = roadmap?.chapters?.find((c) => c.chapter === next.chapter);
        const purpose = ch?.purpose || next.purpose || '推进主线';
        const hooks = ch?.hooks?.length ? ch.hooks.join('、') : '章末保留悬念钩子';
        return {
          action: 'write',
          intent: 'plan_next',
          chapter: next.chapter,
          title: `第${next.chapter}章`,
          outline: `【Story OS · 写章任务】\n撰写第 ${next.chapter} 章。\n\n本章目的：${purpose}\n章末要求：${hooks}`,
          message: `下一步：${next.title}`,
          task_id: next.id,
        };
      }
      const result = startNextTask(projectId);
      const prep = prepareConfirmedPlan(projectId, result.plan.id);
      return {
        action: 'task_execute',
        intent: 'plan_next',
        task: result.task,
        plan: prep.plan,
        user_message: prep.user_message,
        message: `下一步：${result.task.title}`,
      };
    }
    case 'plan_roadmap':
    case 'rebuild_planner': {
      const prefs = loadPreferences(projectId);
      const horizon = parseHorizon(msg, prefs.default_horizon);
      const generated = generateStoryOS(projectId, { horizon });
      const today = getTodayCreation(projectId);
      return {
        action: 'planner_result',
        intent,
        horizon,
        story_goal: generated.story_goal,
        chapter_roadmap: generated.chapter_roadmap,
        today: today.today,
        message: `已生成第 ${generated.chapter_roadmap.range.from}–${generated.chapter_roadmap.range.to} 章后续章节，并更新今日创作。`,
      };
    }
    case 'plan_goal': {
      const prefs = loadPreferences(projectId);
      const generated = generateStoryOS(projectId, { horizon: prefs.default_horizon });
      return {
        action: 'planner_result',
        intent: 'plan_goal',
        story_goal: generated.story_goal,
        message: goalDisplayLine(generated.story_goal, projectId),
      };
    }
    default:
      return null;
  }
}
