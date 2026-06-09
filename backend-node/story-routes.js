import { Router } from 'express';
import { loadKnowledgeBundle, patchKnowledge } from './story-kb/store.js';
import { bootstrapFromWorkspace } from './story-kb/sync.js';
import { loadSummaryHierarchy } from './story-summaries/store.js';
import { rebuildAllSummaries } from './story-summaries/cascade.js';
import {
  findCharacter,
  findRelationship,
  findTimeline,
  findForeshadow,
  findLocation,
  queryStory,
} from './story-index/query.js';
import { rebuildStoryIndex } from './story-index/build.js';
import { listPlans, getPlan } from './story-plans/store.js';
import { analyzeStoryDiff } from './story-diff/analyzer.js';
import { createRewritePlan } from './rewrite-engine/engine.js';
import { writeChapterReviewMd } from './quality/scorer.js';
import {
  routeRequest,
  prepareConfirmedPlan,
  completePlan,
} from './agents/chief-editor/index.js';
import { loadUnderstandingBundle } from './story-understanding/store.js';
import { loadActions } from './story-actions/store.js';
import { rankTodayActions } from './story-actions/ranker.js';
import { createPlanFromAction } from './story-actions/to-plan.js';
import { startSyncJob, runQuickSync } from './story-kb/rebuild.js';
import {
  generateStoryOS,
  getTodayCreation,
  startNextTask,
  loadTasks,
  createPlanFromTask,
} from './story-tasks/index.js';
import {
  loadPlannerBundle,
  loadStoryGoal,
  loadChapterRoadmap,
  loadPreferences,
  savePreferences,
} from './story-planner/store.js';
import { getTask } from './story-tasks/store.js';
import {
  verifyAndCompleteTask,
  getVerifyBundle,
  verifyAfterWrite,
  verifyAfterPlanComplete,
} from './story-verify/index.js';
import { getProjectHealthView } from './measurement/health-facade.js';
import { checkSettingsConsistency } from './export/epub-export.js';
import * as store from './storage.js';
import { requireProjectWrite } from './auth/project-access.js';

const router = Router();

function pid(req) {
  return req.params.id;
}

function ensureProject(req, res, next) {
  if (req.projectMeta) return next();
  try {
    store.getProject(pid(req));
    next();
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
}

const base = '/projects/:id/story';

router.use(base, (req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method)) return next();
  return requireProjectWrite(req, res, next);
});

router.get(`${base}/knowledge`, ensureProject, (req, res) => {
  try {
    res.json(loadKnowledgeBundle(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put(`${base}/knowledge`, ensureProject, (req, res) => {
  try {
    res.json(patchKnowledge(pid(req), req.body));
    rebuildStoryIndex(pid(req));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/knowledge/rebuild`, ensureProject, (req, res) => {
  try {
    res.json(bootstrapFromWorkspace(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/summaries`, ensureProject, (req, res) => {
  try {
    res.json(loadSummaryHierarchy(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/summaries/rebuild`, ensureProject, (req, res) => {
  try {
    res.json(rebuildAllSummaries(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/query`, ensureProject, (req, res) => {
  try {
    res.json(queryStory(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/character`, ensureProject, (req, res) => {
  try {
    res.json(findCharacter(pid(req), req.query.name || req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/relationship`, ensureProject, (req, res) => {
  try {
    res.json(findRelationship(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/timeline`, ensureProject, (req, res) => {
  try {
    res.json(findTimeline(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/foreshadow`, ensureProject, (req, res) => {
  try {
    res.json(findForeshadow(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/location`, ensureProject, (req, res) => {
  try {
    res.json(findLocation(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/route`, ensureProject, async (req, res) => {
  try {
    res.json(await routeRequest(pid(req), req.body.message || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/plans`, ensureProject, (req, res) => {
  try {
    res.json({ plans: listPlans(pid(req), { status: req.query.status }) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/plans/:planId`, ensureProject, (req, res) => {
  try {
    res.json(getPlan(pid(req), req.params.planId));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.post(`${base}/plans/diff`, ensureProject, (req, res) => {
  try {
    res.json(analyzeStoryDiff(pid(req), req.body.message || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/plans/rewrite`, ensureProject, (req, res) => {
  try {
    res.json(createRewritePlan(pid(req), req.body.message || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/plans/:planId/confirm`, ensureProject, (req, res) => {
  try {
    res.json(prepareConfirmedPlan(pid(req), req.params.planId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/plans/:planId/complete`, ensureProject, async (req, res) => {
  try {
    res.json(await completePlan(pid(req), req.params.planId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/health`, ensureProject, (req, res) => {
  try {
    res.json(getProjectHealthView(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/consistency`, ensureProject, (req, res) => {
  try {
    res.json(checkSettingsConsistency(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/verify`, ensureProject, (req, res) => {
  try {
    res.json(getVerifyBundle(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/verify/run`, ensureProject, (req, res) => {
  try {
    const { taskId, planId, chapter, filename } = req.body || {};
    const projectId = pid(req);
    if (planId) {
      const plan = getPlan(projectId, planId);
      res.json(verifyAfterPlanComplete(projectId, { ...plan, status: 'completed' }));
      return;
    }
    if (taskId) {
      res.json(verifyAndCompleteTask(projectId, taskId));
      return;
    }
    if (chapter != null) {
      res.json(verifyAfterWrite(projectId, { chapter, filename }));
      return;
    }
    res.status(400).json({ error: '需要 taskId、planId 或 chapter' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/health/review`, ensureProject, (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) throw new Error('需要 filename');
    res.json(writeChapterReviewMd(pid(req), filename));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/understanding`, ensureProject, (req, res) => {
  try {
    const bundle = loadUnderstandingBundle(pid(req));
    res.json(bundle);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/actions/today`, ensureProject, (req, res) => {
  try {
    const actions = loadActions(pid(req));
    const dna = loadUnderstandingBundle(pid(req)).story_dna;
    const limit = Math.min(10, parseInt(req.query.limit || '3', 10) || 3);
    res.json({
      project_id: pid(req),
      generated_at: actions.updated_at,
      story_dna: dna,
      suggestions: rankTodayActions(actions, { limit }),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/actions/:actionId/plan`, ensureProject, (req, res) => {
  try {
    res.json(createPlanFromAction(pid(req), req.params.actionId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** 快速同步 / 全书理解 */
router.post(`${base}/sync`, ensureProject, (req, res) => {
  try {
    const mode = req.body?.mode === 'deep' ? 'deep' : 'quick';
    if (mode === 'quick' && !req.body?.async) {
      res.json(runQuickSync(pid(req)));
      return;
    }
    const job = startSyncJob(pid(req), mode);
    res.json({ job_id: job.id, status: job.status, mode });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Story OS Phase 1 — 规划生成 */
router.post(`${base}/planner/generate`, ensureProject, (req, res) => {
  try {
    const horizon = req.body?.horizon;
    const prefs = req.body?.preferences;
    res.json(generateStoryOS(pid(req), { horizon, preferences: prefs }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/planner/bundle`, ensureProject, (req, res) => {
  try {
    res.json(loadPlannerBundle(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/planner/goal`, ensureProject, (req, res) => {
  try {
    const goal = loadStoryGoal(pid(req));
    if (!goal) {
      res.status(404).json({ error: '尚未生成故事目标，请先 POST /planner/generate' });
      return;
    }
    res.json(goal);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/planner/roadmap`, ensureProject, (req, res) => {
  try {
    const roadmap = loadChapterRoadmap(pid(req));
    if (!roadmap) {
      res.status(404).json({ error: '尚未生成章节路线图' });
      return;
    }
    res.json(roadmap);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/planner/preferences`, ensureProject, (req, res) => {
  try {
    res.json(loadPreferences(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put(`${base}/planner/preferences`, ensureProject, (req, res) => {
  try {
    res.json(savePreferences(pid(req), req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Story OS — 今日创作（Scheduler） */
router.get(`${base}/tasks/today`, ensureProject, (req, res) => {
  try {
    res.json(getTodayCreation(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/tasks`, ensureProject, (req, res) => {
  try {
    res.json(loadTasks(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/rebuild`, ensureProject, (req, res) => {
  try {
    const prefs = loadPreferences(pid(req));
    const horizon = req.body?.horizon ?? prefs.default_horizon;
    res.json(generateStoryOS(pid(req), { horizon }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/:taskId/plan`, ensureProject, (req, res) => {
  try {
    const plan = createPlanFromTask(pid(req), req.params.taskId);
    const prep = prepareConfirmedPlan(pid(req), plan.id);
    res.json({ plan: prep.plan, user_message: prep.user_message });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/:taskId/start`, ensureProject, (req, res) => {
  try {
    const plan = createPlanFromTask(pid(req), req.params.taskId);
    const prep = prepareConfirmedPlan(pid(req), plan.id);
    res.json({
      task: getTask(pid(req), req.params.taskId),
      plan: prep.plan,
      user_message: prep.user_message,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/next`, ensureProject, (req, res) => {
  try {
    const result = startNextTask(pid(req));
    const prep = prepareConfirmedPlan(pid(req), result.plan.id);
    res.json({
      task: result.task,
      plan: prep.plan,
      user_message: prep.user_message,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/:taskId/complete`, ensureProject, (req, res) => {
  try {
    res.json(verifyAndCompleteTask(pid(req), req.params.taskId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
