import { scoreProjectHealth } from '../quality/scorer.js';
import { getVerifyBundle } from './index.js';

/**
 * 作品质量页：Verify 聚合 + 章节评分（Health = Verify 视图 + 质量分）
 */
export function buildProjectHealthView(projectId) {
  const quality = scoreProjectHealth(projectId);
  const verify = getVerifyBundle(projectId);
  const aggregate = verify.health_snapshot;

  return {
    project_id: projectId,
    scoring_method: quality.scoring_method,
    overall_health: quality.overall_health,
    chapter_scores: quality.chapter_scores,
    kb_stats: quality.kb_stats,
    generated_at: quality.generated_at,
    verify: {
      latest: verify.latest,
      recent: verify.recent,
      summary: aggregate?.verify_summary || null,
      pass_rate: aggregate?.verify_summary?.pass_rate ?? null,
    },
  };
}
