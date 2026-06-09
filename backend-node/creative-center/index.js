/**
 * 创作中心（Creative Center）模块
 *
 * V2.8 目标形态：仅 Cockpit + Versions（Versions 路由在 versions-routes.js）
 * 本模块挂载于 /api/studio
 */
export { getDashboardStats, getCockpitOverview } from './cockpit-service.js';
export {
  listStudioAssets,
  createStudioAsset,
  deleteStudioAsset,
  updateStudioAsset,
} from './legacy-assets-service.js';
export { computeStudioReview, computeProjectReview } from './review-compute.js';
export { loadStudioState, saveStudioState, pendingReviewChecks } from './studio-state.js';
export { default as creativeCenterRoutes } from './routes.js';
