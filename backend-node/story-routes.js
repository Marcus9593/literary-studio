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
import { listPlans, getPlan, updatePlanStatus } from './story-plans/store.js';
import { analyzeStoryDiff } from './story-diff/analyzer.js';
import { createRewritePlan } from './rewrite-engine/engine.js';
import { writeChapterReviewMd } from './quality/scorer.js';
import {
  routeRequest,
  prepareConfirmedPlan,
  completePlan,
} from './agents/chief-editor/index.js';
import { loadUnderstandingBundle } from './story-understanding/store.js';
import { diagnosis, planner, measurement } from './story-os/index.js';
import { startSyncJob, runQuickSync } from './story-kb/rebuild.js';

const {
  loadActions,
  rankTodayActions,
  createPlanFromAction,
} = diagnosis;

const {
  generateStoryOS,
  getTodayCreation,
  startNextTask,
  loadTasks,
  createPlanFromTask,
  getTask,
  loadPlannerBundle,
  loadStoryGoal,
  loadChapterRoadmap,
  loadPreferences,
  savePreferences,
} = planner;

const {
  verifyAndCompleteTask,
  getVerifyBundle,
  verifyAfterWrite,
  verifyAfterPlanComplete,
  getProjectHealthView,
} = measurement;
import { checkSettingsConsistency } from './export/epub-export.js';
import * as store from './storage.js';
import { ensureProjectAccess, requireProjectWrite } from './auth/project-access.js';

const router = Router();

function pid(req) {
  return req.params.id;
}

const base = '/projects/:id/story';

router.use(base, ensureProjectAccess);
router.use(base, (req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method)) return next();
  return requireProjectWrite(req, res, next);
});

router.get(`${base}/knowledge`, (req, res) => {
  try {
    res.json(loadKnowledgeBundle(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put(`${base}/knowledge`, (req, res) => {
  try {
    res.json(patchKnowledge(pid(req), req.body));
    rebuildStoryIndex(pid(req));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/knowledge/rebuild`, (req, res) => {
  try {
    res.json(bootstrapFromWorkspace(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/summaries`, (req, res) => {
  try {
    res.json(loadSummaryHierarchy(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/summaries/rebuild`, (req, res) => {
  try {
    res.json(rebuildAllSummaries(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/query`, (req, res) => {
  try {
    res.json(queryStory(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/character`, (req, res) => {
  try {
    res.json(findCharacter(pid(req), req.query.name || req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/relationship`, (req, res) => {
  try {
    res.json(findRelationship(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/timeline`, (req, res) => {
  try {
    res.json(findTimeline(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/foreshadow`, (req, res) => {
  try {
    res.json(findForeshadow(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/index/location`, (req, res) => {
  try {
    res.json(findLocation(pid(req), req.query.q || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/route`, async (req, res) => {
  try {
    res.json(await routeRequest(pid(req), req.body.message || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/plans`, (req, res) => {
  try {
    res.json({ plans: listPlans(pid(req), { status: req.query.status }) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/plans/:planId`, (req, res) => {
  try {
    res.json(getPlan(pid(req), req.params.planId));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.post(`${base}/plans/diff`, (req, res) => {
  try {
    res.json(analyzeStoryDiff(pid(req), req.body.message || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/plans/rewrite`, (req, res) => {
  try {
    res.json(createRewritePlan(pid(req), req.body.message || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/plans/:planId/confirm`, (req, res) => {
  try {
    res.json(prepareConfirmedPlan(pid(req), req.params.planId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/plans/:planId/complete`, async (req, res) => {
  try {
    res.json(await completePlan(pid(req), req.params.planId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/health`, (req, res) => {
  try {
    res.json(getProjectHealthView(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/consistency`, (req, res) => {
  try {
    res.json(checkSettingsConsistency(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/verify`, (req, res) => {
  try {
    res.json(getVerifyBundle(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/verify/run`, (req, res) => {
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

router.post(`${base}/health/review`, (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) throw new Error('需要 filename');
    res.json(writeChapterReviewMd(pid(req), filename));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/understanding`, (req, res) => {
  try {
    const bundle = loadUnderstandingBundle(pid(req));
    res.json(bundle);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/actions/today`, (req, res) => {
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

router.post(`${base}/actions/:actionId/plan`, (req, res) => {
  try {
    res.json(createPlanFromAction(pid(req), req.params.actionId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** 快速同步 / 全书理解 */
router.post(`${base}/sync`, (req, res) => {
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
router.post(`${base}/planner/generate`, (req, res) => {
  try {
    const horizon = req.body?.horizon;
    const prefs = req.body?.preferences;
    res.json(generateStoryOS(pid(req), { horizon, preferences: prefs }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/planner/bundle`, (req, res) => {
  try {
    res.json(loadPlannerBundle(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/planner/goal`, (req, res) => {
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

router.get(`${base}/planner/roadmap`, (req, res) => {
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

router.get(`${base}/planner/preferences`, (req, res) => {
  try {
    res.json(loadPreferences(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put(`${base}/planner/preferences`, (req, res) => {
  try {
    res.json(savePreferences(pid(req), req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Story OS — 今日创作（Scheduler） */
router.get(`${base}/tasks/today`, (req, res) => {
  try {
    res.json(getTodayCreation(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/tasks`, (req, res) => {
  try {
    res.json(loadTasks(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/rebuild`, (req, res) => {
  try {
    const prefs = loadPreferences(pid(req));
    const horizon = req.body?.horizon ?? prefs.default_horizon;
    res.json(generateStoryOS(pid(req), { horizon }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/:taskId/plan`, (req, res) => {
  const projectId = pid(req);
  const taskId = req.params.taskId;
  let plan = null;
  try {
    plan = createPlanFromTask(projectId, taskId);
    const prep = prepareConfirmedPlan(projectId, plan.id);
    res.json({ plan: prep.plan, user_message: prep.user_message });
  } catch (e) {
    if (plan?.id) {
      try {
        updatePlanStatus(projectId, plan.id, 'rolled_back', { error: e.message });
      } catch { /* 回滚失败不掩盖原始错误 */ }
    }
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/:taskId/start`, (req, res) => {
  const projectId = pid(req);
  const taskId = req.params.taskId;
  let plan = null;
  try {
    plan = createPlanFromTask(projectId, taskId);
    const prep = prepareConfirmedPlan(projectId, plan.id);
    res.json({
      task: getTask(projectId, taskId),
      plan: prep.plan,
      user_message: prep.user_message,
    });
  } catch (e) {
    // 回滚已创建的 plan，避免孤立数据
    if (plan?.id) {
      try {
        updatePlanStatus(projectId, plan.id, 'rolled_back', { error: e.message });
      } catch { /* 回滚失败不掩盖原始错误 */ }
    }
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/next`, (req, res) => {
  const projectId = pid(req);
  let result = null;
  try {
    result = startNextTask(projectId);
    const prep = prepareConfirmedPlan(projectId, result.plan.id);
    res.json({
      task: result.task,
      plan: prep.plan,
      user_message: prep.user_message,
    });
  } catch (e) {
    if (result?.plan?.id) {
      try {
        updatePlanStatus(projectId, result.plan.id, 'rolled_back', { error: e.message });
      } catch { /* 回滚失败不掩盖原始错误 */ }
    }
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/tasks/:taskId/complete`, (req, res) => {
  try {
    res.json(verifyAndCompleteTask(pid(req), req.params.taskId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
