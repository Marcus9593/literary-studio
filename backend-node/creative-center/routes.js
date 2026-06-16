import { Router } from 'express';
import { getDashboardStats } from './cockpit-service.js';
import { loadStudioState } from './studio-state.js';

const router = Router();

/** 创作看板 Dashboard — 跨项目今日改稿统计 */
router.get('/overview', (req, res) => {
  try {
    res.json(getDashboardStats(req.user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** @deprecated 兼容旧客户端，同 /overview */
router.get('/dashboard', (req, res) => {
  try {
    res.json(getDashboardStats(req.user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @deprecated V2.8 — 素材已迁入 Knowledge（Story Assets）
 * GET 保留只读兼容，写操作返回 410 Gone
 */
router.get('/assets', (req, res) => {
  try {
    const studio = loadStudioState();
    const projectId = String(req.query.project_id || '');
    const assets = projectId
      ? (studio.assets?.[projectId] || [])
      : Object.values(studio.assets || {}).flatMap((items) => items || []);
    res.json(assets);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/assets', (req, res) => {
  res.status(410).json({
    error: '素材功能已迁移至 Knowledge。请在项目「知识库」页面管理素材。',
    migrated_to: '/projects/:id/story/knowledge',
  });
});

router.delete('/assets/:id', (req, res) => {
  res.status(410).json({
    error: '素材功能已迁移至 Knowledge。请在项目「知识库」页面管理素材。',
    migrated_to: '/projects/:id/story/knowledge',
  });
});

router.put('/assets/:id', (req, res) => {
  res.status(410).json({
    error: '素材功能已迁移至 Knowledge。请在项目「知识库」页面管理素材。',
    migrated_to: '/projects/:id/story/knowledge',
  });
});

export default router;
