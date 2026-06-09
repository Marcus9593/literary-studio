import { Router } from 'express';
import { getDashboardStats } from './cockpit-service.js';
import {
  listStudioAssets,
  createStudioAsset,
  deleteStudioAsset,
  updateStudioAsset,
} from './legacy-assets-service.js';
import { getReviewLatest, runReview } from '../measurement/review-facade.js';
import {
  listVersions,
  createVersion,
  deleteVersion,
  getVersionDiff,
  restoreVersion,
} from '../versions/version-service.js';

const router = Router();

function markDeprecatedRoute(res, successorPath) {
  res.set('Deprecation', 'true');
  res.set('Link', `<${successorPath}>; rel="successor-version"`);
  res.set('X-Architecture-Note', 'V2.8: use measurement/ or knowledge/; see docs/v2.8-data-boundaries.md');
}

function markSnapshotDeprecated(res) {
  markDeprecatedRoute(res, '/api/projects/{id}/versions');
  res.set('X-Legacy-Source', 'redirected-to-versions-domain');
}

/** 创作看板 Dashboard — 跨项目今日改稿统计 */
router.get('/overview', (req, res) => {
  try {
    res.json(getDashboardStats(req.user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/dashboard', (req, res) => {
  try {
    res.json(getDashboardStats(req.user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** @deprecated 重定向至 versions 域 */
router.get('/snapshots', (req, res) => {
  try {
    const projectId = String(req.query.project_id || '');
    if (!projectId) return res.status(400).json({ error: '缺少 project_id' });
    markSnapshotDeprecated(res);
    res.json(listVersions(projectId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/snapshots', (req, res) => {
  try {
    const projectId = String(req.body?.project_id || '').trim();
    if (!projectId) return res.status(400).json({ error: '缺少 project_id' });
    markSnapshotDeprecated(res);
    res.json(createVersion(projectId, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/snapshots/:id', (req, res) => {
  try {
    const projectId = String(req.query.project_id || '');
    if (!projectId) return res.status(400).json({ error: '缺少 project_id' });
    markSnapshotDeprecated(res);
    res.json(deleteVersion(projectId, req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/snapshots/:id/diff', (req, res) => {
  try {
    const projectId = String(req.query.project_id || '');
    if (!projectId) return res.status(400).json({ error: '缺少 project_id' });
    markSnapshotDeprecated(res);
    res.json(getVersionDiff(projectId, req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/snapshots/:id/restore', (req, res) => {
  try {
    const projectId = String(req.body?.project_id || '');
    if (!projectId) return res.status(400).json({ error: '缺少 project_id' });
    markSnapshotDeprecated(res);
    res.json(restoreVersion(projectId, req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** @deprecated V2.8 — 素材 → Knowledge */
router.get('/assets', (req, res) => {
  try {
    markDeprecatedRoute(res, '/api/projects/{id}/story/knowledge');
    const projectId = String(req.query.project_id || '');
    if (!projectId) return res.status(400).json({ error: '缺少 project_id' });
    res.json(listStudioAssets(projectId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/assets', (req, res) => {
  try {
    markDeprecatedRoute(res, '/api/projects/{id}/story/knowledge');
    res.json(createStudioAsset(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/assets/:id', (req, res) => {
  try {
    markDeprecatedRoute(res, '/api/projects/{id}/story/knowledge');
    const projectId = String(req.query.project_id || '');
    if (!projectId) return res.status(400).json({ error: '缺少 project_id' });
    res.json(deleteStudioAsset(req.params.id, projectId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/assets/:id', (req, res) => {
  try {
    markDeprecatedRoute(res, '/api/projects/{id}/story/knowledge');
    res.json(updateStudioAsset(req.params.id, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** @deprecated V2.8 — 审稿 → Measurement / Health */
router.get('/review', (req, res) => {
  try {
    markDeprecatedRoute(res, '/api/projects/{id}/measurement/review');
    const projectId = String(req.query.project_id || '');
    res.json(getReviewLatest(projectId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/review/run', (req, res) => {
  try {
    markDeprecatedRoute(res, '/api/projects/{id}/measurement/review/run');
    const projectId = String(req.body?.project_id || '');
    if (!projectId) return res.status(400).json({ error: '缺少 project_id' });
    res.json(runReview(projectId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
