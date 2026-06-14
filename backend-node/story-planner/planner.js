import { buildPlannerContext } from './context-builder.js';
import { buildStoryGoal } from './goal-builder.js';
import { buildChapterRoadmap } from './roadmap-builder.js';
import {
  loadPreferences,
  savePreferences,
  saveManifest,
  saveStoryGoal,
  saveChapterRoadmap,
  loadPlannerBundle,
} from './store.js';
import { decomposeTasksFromRoadmap, saveTasks } from '../story-tasks/decomposer.js';
import { ALLOWED_HORIZONS } from './paths.js';

function normalizeHorizon(h) {
  const n = parseInt(h, 10);
  return ALLOWED_HORIZONS.includes(n) ? n : 5;
}

/**
 * Story OS Phase 1 生成链：Goal → Roadmap → Tasks
 */
export function generateStoryOS(projectId, opts = {}) {
  const prefs = loadPreferences(projectId);
  const horizon = normalizeHorizon(opts.horizon ?? prefs.default_horizon);

  if (opts.preferences) {
    savePreferences(projectId, opts.preferences);
  }

  const ctx = buildPlannerContext(projectId, { horizon });
  // Propagate act thresholds from preferences if configured
  if (prefs.act1_threshold || prefs.act2_threshold) {
    ctx.actThresholds = {
      act1Threshold: prefs.act1_threshold || undefined,
      act2Threshold: prefs.act2_threshold || undefined,
    };
  }
  const storyGoal = buildStoryGoal(ctx);
  saveStoryGoal(projectId, storyGoal);

  const roadmap = buildChapterRoadmap(ctx, storyGoal);
  const tasksDoc = decomposeTasksFromRoadmap(projectId, roadmap, storyGoal, ctx);
  saveChapterRoadmap(projectId, roadmap);

  saveTasks(projectId, tasksDoc);

  const manifest = saveManifest(projectId, {
    version: 1,
    schema: 'planner_manifest',
    story_os_phase: 1,
    current_chapter: ctx.currentChapter,
    default_horizon: horizon,
    generation_chain: ['story_goal', 'chapter_roadmap', 'tasks'],
    artifacts: {
      story_goal: true,
      chapter_roadmap: true,
      tasks: true,
      act_beats: false,
    },
    source: 'heuristic',
  });

  return {
    manifest,
    story_goal: storyGoal,
    chapter_roadmap: roadmap,
    tasks: tasksDoc,
  };
}

export function getPlannerSummary(projectId) {
  const bundle = loadPlannerBundle(projectId);
  const roadmap = bundle.chapter_roadmap;
  if (!roadmap?.chapters?.length) return null;
  const lines = roadmap.chapters.map(
    (c) => `${c.chapter}：${c.purpose}`,
  );
  return {
    goal: bundle.story_goal?.target_state?.slice(0, 80),
    range: roadmap.range,
    horizon: roadmap.horizon,
    chapter_lines: lines,
    summary: `第${roadmap.range.from}–${roadmap.range.to}章 · ${bundle.story_goal?.target_state?.slice(0, 40) || '创作路线'}`,
  };
}
