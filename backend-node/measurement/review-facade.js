/**
 * Review Engine facade — 写 measurement/review/latest.json；读优先新路径
 * @deprecated studio.review_by_project 只读回退（Cleanup B 后移除）
 */
import fs from 'fs';
import path from 'path';
import { computeStudioReview } from '../creative-center/review-compute.js';
import { getStudioReview, pendingReviewChecks } from '../creative-center/studio-state.js';
import { reviewLatestPath } from './paths.js';
import { normalizeReviewLatest } from './schemas.js';

function readReviewLatestFile(projectId) {
  const fp = reviewLatestPath(projectId);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

function writeReviewLatestFile(projectId, payload) {
  const fp = reviewLatestPath(projectId);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(payload, null, 2), 'utf8');
}

export function getReviewLatest(projectId = '') {
  if (!projectId) {
    return normalizeReviewLatest({ checks: pendingReviewChecks(), hints: [], project_id: '' });
  }

  const fromMeasurement = readReviewLatestFile(projectId);
  if (fromMeasurement) {
    return normalizeReviewLatest({ ...fromMeasurement, project_id: projectId });
  }

  const legacy = getStudioReview(projectId);
  if (legacy?.updated_at) {
    return normalizeReviewLatest({ ...legacy, project_id: projectId });
  }

  try {
    const computed = computeStudioReview(projectId);
    if (computed.manuscript_words > 0) {
      const normalized = normalizeReviewLatest({
        schema: 'measurement_review_latest',
        project_id: projectId,
        checks: computed.checks,
        hints: computed.hints,
        manuscript_words: computed.manuscript_words,
        updated_at: computed.updated_at,
      });
      writeReviewLatestFile(projectId, normalized);
      return normalized;
    }
  } catch {
    /* 项目不存在或无正文时保持 pending */
  }

  return normalizeReviewLatest({
    checks: pendingReviewChecks(),
    hints: legacy?.hints || [],
    project_id: projectId,
  });
}

/** 仅写 measurement；不再写 studio.review_by_project（Cleanup A） */
export function runReview(projectId) {
  if (!projectId) throw new Error('project_id 不能为空');
  const result = computeStudioReview(projectId);
  const normalized = normalizeReviewLatest({
    schema: 'measurement_review_latest',
    project_id: projectId,
    checks: result.checks,
    hints: result.hints,
    manuscript_words: result.manuscript_words,
    updated_at: result.updated_at,
  });
  writeReviewLatestFile(projectId, normalized);
  return normalized;
}
