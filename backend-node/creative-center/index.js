/**
 * 创作中心（Creative Center）模块
 *
 * V2.8 目标形态：仅 Cockpit + Versions（Versions 路由在 versions-routes.js）
 * 素材已迁入 Knowledge（Story Assets）
 * 审稿已迁入 Health → Review Engine → Actions
 * 本模块挂载于 /api/studio
 */
export { getDashboardStats, getCockpitOverview } from './cockpit-service.js';
export { loadStudioState, saveStudioState } from './studio-state.js';
export { default as creativeCenterRoutes } from './routes.js';
