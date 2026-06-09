/**
 * Measurement Layer JSON schemas（P3.1）
 * @see docs/schemas/measurement-*.schema.json
 * Phase C 前：API 响应按此形状 normalize；文件仍写在 verify/ / studio.json
 */

export const SCHEMA_REVIEW_LATEST = 'measurement_review_latest';
export const SCHEMA_VERIFY_LOG = 'measurement_verify_log';
export const SCHEMA_METRICS_PROJECT = 'measurement_metrics_project';
export const SCHEMA_TRENDS_SERIES = 'measurement_trends_series';
export const SCHEMA_HEALTH_VIEW = 'measurement_health_view';

/** @typedef {{ key: string, status: string, score: number|null, updated_at: string|null }} ReviewCheck */
/** @typedef {{ project_id: string, checks: ReviewCheck[], hints: string[], manuscript_words?: number, updated_at?: string|null, schema: string }} ReviewLatest */

/**
 * @param {object} raw studio.getStudioReview / runStudioReview 返回值
 * @returns {ReviewLatest}
 */
export function normalizeReviewLatest(raw = {}) {
  return {
    schema: SCHEMA_REVIEW_LATEST,
    project_id: raw.project_id || '',
    manuscript_words: raw.manuscript_words ?? 0,
    checks: (raw.checks || []).map((c) => ({
      key: c.key,
      status: c.status,
      score: c.score ?? null,
      updated_at: c.updated_at ?? null,
    })),
    hints: raw.hints || [],
    updated_at: raw.updated_at ?? null,
    _storage: 'legacy:studio.review_by_project',
  };
}

/**
 * @param {object} healthView buildProjectHealthView 返回值
 */
export function normalizeHealthView(healthView = {}) {
  return {
    schema: SCHEMA_HEALTH_VIEW,
    project_id: healthView.project_id,
    overall_health: healthView.overall_health,
    scoring_method: healthView.scoring_method,
    chapter_scores: healthView.chapter_scores || [],
    kb_stats: healthView.kb_stats || {},
    generated_at: healthView.generated_at,
    verify: healthView.verify || null,
    review: null,
    _storage: {
      metrics: 'legacy:quality/scorer + verify/health_snapshot',
      note: 'Health is aggregation only; not a datastore root',
    },
  };
}

export function emptyTrendsSeries(projectId) {
  return {
    schema: SCHEMA_TRENDS_SERIES,
    project_id: projectId,
    points: [],
    updated_at: null,
  };
}
