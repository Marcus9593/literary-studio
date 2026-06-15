/**
 * @deprecated 请直接使用 creative-center/ 子模块。
 * 保留本文件以兼容 measurement/review-facade 等现有 import。
 */
import { getDashboardStats } from './creative-center/cockpit-service.js';
import {
  listStudioAssets,
  createStudioAsset,
  deleteStudioAsset,
  updateStudioAsset,
} from './creative-center/legacy-assets-service.js';
import { computeStudioReview } from './creative-center/review-compute.js';
import {
  loadStudioState,
  pendingReviewChecks,
} from './creative-center/studio-state.js';

export { getDashboardStats, getDashboardStats as getStudioOverview };
export {
  listStudioAssets,
  createStudioAsset,
  deleteStudioAsset,
  updateStudioAsset,
  computeStudioReview,
};

export function getStudioReview(projectId = '') {
  const state = loadStudioState();
  if (!projectId) {
    return { checks: pendingReviewChecks(), hints: [], project_id: '' };
  }
  const cached = state.review_by_project[projectId];
  if (!cached) {
    return { checks: pendingReviewChecks(), hints: [], project_id: projectId };
  }
  return {
    project_id: projectId,
    checks: cached.checks || pendingReviewChecks(),
    hints: cached.hints || [],
    manuscript_words: cached.manuscript_words || 0,
    updated_at: cached.updated_at || null,
  };
}
