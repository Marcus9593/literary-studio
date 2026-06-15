import { Router } from 'express';
import * as store from '../storage.js';
import { ensureProjectAccess, requireProjectManage, requireProjectWrite } from '../auth/project-access.js';
import { invalidateProjectContext } from '../ai-runtime/orchestrator.js';
import { notifyProjectContentChanged } from '../event-bus/manuscript-events.js';
import {
  listVersions,
  getVersion,
  createVersion,
  deleteVersion,
  getVersionDiff,
  restoreVersion,
} from '../versions/version-service.js';

const router = Router();

function pid(req) {
  return req.params.id;
}

const base = '/projects/:id/versions';

router.use(base, ensureProjectAccess);
router.use(base, (req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method)) return next();
  if (req.method === 'DELETE') return requireProjectManage(req, res, next);
  return requireProjectWrite(req, res, next);
});

router.get(base, (req, res) => {
  try {
    res.json(listVersions(pid(req)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/create`,  (req, res) => {
  try {
    res.json(createVersion(pid(req), req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/:versionId/diff`,  (req, res) => {
  try {
    res.json(getVersionDiff(pid(req), req.params.versionId));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.post(`${base}/:versionId/restore`,  (req, res) => {
  try {
    const projectId = pid(req);
    const result = restoreVersion(projectId, req.params.versionId);
    invalidateProjectContext(projectId);
    notifyProjectContentChanged(projectId, {
      kind: 'version_restore',
      version_id: result.version_id,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/:versionId`,  (req, res) => {
  try {
    const includeFiles = req.query.include_files === '1';
    res.json(getVersion(pid(req), req.params.versionId, { includeFiles }));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.delete(`${base}/:versionId`,  (req, res) => {
  try {
    res.json(deleteVersion(pid(req), req.params.versionId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
