import { Router } from 'express';
import { getDashboardStats } from './cockpit-service.js';

const router = Router();

/** 创作看板 Dashboard — 跨项目今日改稿统计 */
router.get('/overview', (req, res) => {
  try {
    res.json(getDashboardStats(req.user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
