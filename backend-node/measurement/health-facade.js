/**
 * Health 聚合视图（UI 名）— 非存储层
 * 拼装 quality scorer + verify bundle；未来并入 measurement/* 只读
 */
import { buildProjectHealthView } from '../story-verify/health-view.js';
import { getReviewLatest } from './review-facade.js';
import { normalizeHealthView } from './schemas.js';

export function getProjectHealthView(projectId) {
  const view = buildProjectHealthView(projectId);
  const normalized = normalizeHealthView(view);
  try {
    normalized.review = getReviewLatest(projectId);
  } catch {
    normalized.review = null;
  }
  return normalized;
}
