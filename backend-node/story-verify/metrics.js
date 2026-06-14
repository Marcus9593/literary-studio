import { loadUnderstandingBundle } from '../story-understanding/store.js';

/**
 * 从 Understanding 提取可对比的启发式指标（V2.9）
 */
export function extractUnderstandingMetrics(bundle) {
  const arcs = bundle?.arcs?.items || [];
  const conflicts = bundle?.conflicts?.items || [];
  const dna = bundle?.story_dna || {};

  return {
    arc_count: arcs.length,
    arc_with_issues: arcs.filter((a) => (a.breakpoints || []).length > 0).length,
    arc_high_risk: arcs.filter((a) => a.risk_level === 'high').length,
    conflict_count: conflicts.length,
    conflict_with_gap: conflicts.filter((c) => c.gap).length,
    dna_confidence: dna.confidence ?? null,
    has_dna: !!String(dna.one_liner || '').trim(),
  };
}

export function loadCurrentMetrics(projectId) {
  try {
    const bundle = loadUnderstandingBundle(projectId);
    return extractUnderstandingMetrics(bundle);
  } catch {
    return extractUnderstandingMetrics({});
  }
}

/**
 * 对比执行前后 Understanding 指标
 */
export function compareUnderstandingMetrics(before, after, { kind } = {}) {
  if (!before || !after) return { checks: [], delta: null };

  const delta = {
    arc_with_issues: (after.arc_with_issues || 0) - (before.arc_with_issues || 0),
    arc_high_risk: (after.arc_high_risk || 0) - (before.arc_high_risk || 0),
    conflict_with_gap: (after.conflict_with_gap || 0) - (before.conflict_with_gap || 0),
    dna_confidence: (after.dna_confidence ?? 0) - (before.dna_confidence ?? 0),
  };

  const checks = [];

  checks.push({
    id: 'dna_persisted',
    label: '作品画像仍有效',
    pass: after.has_dna,
    detail: after.has_dna ? 'story_dna 可读' : '缺失',
  });

  const isRewrite = kind === 'rewrite_plan' || kind === 'arc_step' || kind === 'rewrite_chapter';
  if (isRewrite) {
    checks.push({
      id: 'arc_issues_not_worse',
      label: '成长线问题数未增加',
      pass: delta.arc_with_issues <= 0,
      detail: `${before.arc_with_issues} → ${after.arc_with_issues}`,
    });
    checks.push({
      id: 'conflict_gaps_not_worse',
      label: '冲突缺口数未增加',
      pass: delta.conflict_with_gap <= 0,
      detail: `${before.conflict_with_gap} → ${after.conflict_with_gap}`,
    });
    const improved = delta.arc_with_issues < 0 || delta.conflict_with_gap < 0;
    if (improved) {
      checks.push({
        id: 'metrics_improved',
        label: '结构指标有改善',
        pass: true,
        detail: `arc Δ${delta.arc_with_issues}, conflict Δ${delta.conflict_with_gap}`,
      });
    }
  }

  return { checks, delta, before, after };
}

export function mergeMetricChecks(verifyResult, metricComparison) {
  if (!metricComparison?.checks?.length) return verifyResult;

  const checks = [...(verifyResult.checks || []), ...metricComparison.checks];
  let status = verifyResult.status;
  // 原始 verify 已 pass 时，不允许 metric checks 降级状态
  if (status === 'pass') {
    const metricAllPass = metricComparison.checks.every((c) => c.pass);
    if (!metricAllPass) {
      // 保留 pass 状态，仅在 checks 中记录 metric 未全部通过
    }
  } else {
    const allPass = checks.every((c) => c.pass);
    const anyPass = checks.some((c) => c.pass);
    if (allPass) status = 'pass';
    else if (anyPass) status = 'partial';
    else status = 'fail';
  }

  return {
    ...verifyResult,
    status,
    checks,
    metrics_delta: metricComparison.delta,
    message: status === 'pass'
      ? verifyResult.message
      : status === 'partial'
        ? `部分达成：${verifyResult.subject}（结构指标需关注）`
        : `验收未通过：${verifyResult.subject}`,
  };
}
