import * as store from '../storage.js';
import {
  canManageProject,
  canReadProject,
  canWriteProject,
  enrichProjectMetaForUser,
  getProjectAccess,
} from './permissions.js';

export function projectIdFromReq(req) {
  return req.params.id || req.params.projectId || req.body?.project_id || req.query?.project_id;
}

export function ensureProjectAccess(req, res, next) {
  const projectId = projectIdFromReq(req);
  if (!projectId) {
    res.status(400).json({ error: '缺少 projectId' });
    return;
  }

  let meta;
  try {
    meta = store.getProject(projectId);
  } catch (e) {
    res.status(404).json({ error: e.message || '项目不存在' });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: '请先登录' });
    return;
  }

  if (!canReadProject(req.user, meta)) {
    res.status(403).json({ error: '无权访问此项目' });
    return;
  }

  req.projectId = projectId;
  req.projectMeta = meta;
  req.projectAccess = getProjectAccess(req.user, meta);
  next();
}

export function requireProjectWrite(req, res, next) {
  if (!req.projectMeta || !req.user) {
    console.error('[auth] requireProjectWrite: 项目权限未初始化，缺少 projectMeta 或 user');
    res.status(500).json({ error: '项目权限未初始化' });
    return;
  }
  if (!canWriteProject(req.user, req.projectMeta)) {
    res.status(403).json({ error: '无权修改此项目' });
    return;
  }
  next();
}

export function requireProjectManage(req, res, next) {
  if (!req.projectMeta || !req.user) {
    res.status(500).json({ error: '项目权限未初始化' });
    return;
  }
  if (!canManageProject(req.user, req.projectMeta)) {
    res.status(403).json({ error: '仅项目所有者可执行此操作' });
    return;
  }
  next();
}

export function enrichMetaForResponse(user, meta) {
  return enrichProjectMetaForUser(user, meta);
}
