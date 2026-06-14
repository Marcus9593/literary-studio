import { getOverrideBudget, useOverride } from '../storage/sqlite/repos/canon-repo.js';

const HARD_LEVEL = 'HARD';

/**
 * Governor only decides — does not create content.
 * Input: critic report with dimension scores { structure, character, ... } each { level, score, details }
 */
export function decideGovernor(projectId, criticReport, unitIndex = 1) {
  const dimensions = ['structure', 'character', 'scene', 'pressure', 'voice', 'continuity'];
  const hardDims = [];

  for (const name of dimensions) {
    const dim = criticReport?.[name];
    if (dim?.level === HARD_LEVEL) hardDims.push(name);
  }

  const softCount = dimensions.filter((name) => criticReport?.[name]?.level === 'SOFT').length;
  const budget = getOverrideBudget(projectId, unitIndex);

  if (hardDims.length === 0 && softCount <= 2) {
    return {
      decision: 'APPROVE',
      reasoning: '无硬性维度问题，软性建议可忽略。',
      revision_memo: '',
      hard_dimensions: [],
      override_needed: false,
      override_count: budget.used,
    };
  }

  if (hardDims.length >= 3) {
    return {
      decision: 'REJECT',
      reasoning: `硬性维度过多（${hardDims.join(', ')}），建议重写节拍或大纲。`,
      revision_memo: `请优先修复：${hardDims.join('、')}`,
      hard_dimensions: hardDims,
      override_needed: false,
      override_count: budget.used,
    };
  }

  if (budget.used >= budget.max) {
    return {
      decision: 'REJECT',
      reasoning: '修订需要 Override 预算，但本单元预算已用尽。',
      revision_memo: `修复硬性维度：${hardDims.join('、')}`,
      hard_dimensions: hardDims,
      override_needed: true,
      override_count: budget.used,
    };
  }

  const overrideResult = useOverride(projectId, unitIndex);
  if (!overrideResult.ok) {
    return {
      decision: 'REJECT',
      reasoning: '修订需要 Override 预算，但本单元预算已用尽。',
      revision_memo: `修复硬性维度：${hardDims.join('、')}`,
      hard_dimensions: hardDims,
      override_needed: true,
      override_count: budget.used,
    };
  }

  return {
    decision: 'REVISE',
    reasoning: `存在 ${hardDims.length} 个硬性维度问题，允许修订一次。`,
    revision_memo: `修订重点：${hardDims.join('、')}${softCount ? `；另有 ${softCount} 项软性建议` : ''}`,
    hard_dimensions: hardDims,
    override_needed: true,
    override_count: overrideResult.budget.used,
  };
}
