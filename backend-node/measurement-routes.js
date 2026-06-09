import { Router } from 'express';
import * as store from './storage.js';
import { requireProjectWrite } from './auth/project-access.js';
import { getReviewLatest, runReview } from './measurement/review-facade.js';
import { getProjectHealthView } from './measurement/health-facade.js';

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

const base = '/projects/:id/measurement';

router.use(base, (req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method)) return next();
  return requireProjectWrite(req, res, next);
});

router.get(`${base}/review`, ensureProject, (req, res) => {
  try {
    res.json(getReviewLatest(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/review/run`, ensureProject, (req, res) => {
  try {
    res.json(runReview(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Health = measurement 聚合视图（非独立存储层） */
router.get(`${base}/health`, ensureProject, (req, res) => {
  try {
    res.json(getProjectHealthView(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
