/**
 * 聚合 Arc / Conflict / Foreshadow → story_dna.json
 */
export function buildStoryDna({ kb, arcs, conflicts, actions }) {
  const arcItems = arcs?.items || [];
  const conflictItems = conflicts?.items || [];
  const actionItems = actions?.items || actions || [];

  const arcCompleteness = arcItems.length
    ? arcItems.reduce((s, a) => s + (a.stage_index + 1) / (a.stage_total_estimate || 5), 0)
      / arcItems.length
    : 0.5;

  const foreshadowTotal = kb.foreshadows?.items?.length || 0;
  const foreshadowResolved = (kb.foreshadows?.items || []).filter(
    (f) => f.status === 'resolved',
  ).length;
  const foreshadowRate = foreshadowTotal
    ? foreshadowResolved / foreshadowTotal
    : 0;

  const mainConflict = conflictItems[0];
  const midDensity = mainConflict?.density_window?.score ?? 50;

  const topPriorities = [...actionItems]
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, 5)
    .map((a) => ({
      action_id: a.id,
      title: a.title,
      type: a.type,
      priority: a.priority,
    }));

  return {
    one_liner: kb.story_summary?.logline || '',
    core_engine: inferCoreEngine(kb, conflictItems),
    primary_conflict_id: mainConflict?.id || null,
    protagonist_arc_id: arcItems.find((a) => a.label === '主角')?.id
      || arcItems[0]?.id
      || null,
    health_signals: {
      arc_completeness: Math.round(arcCompleteness * 100) / 100,
      foreshadow_recovery_rate: Math.round(foreshadowRate * 100) / 100,
      conflict_density_mid: Math.round(midDensity) / 100,
    },
    top_priorities: topPriorities,
    confidence: 0.75,
  };
}

function inferCoreEngine(kb, conflicts) {
  if (conflicts[0]?.conflict) return conflicts[0].conflict;
  if (kb.story_summary?.themes?.length) return kb.story_summary.themes.join(' · ');
  return '待分析';
}

export function getUnderstandingPromptBlock(bundle, actionsDoc, { maxChars = 4000 } = {}) {
  const compact = {
    story_dna: bundle.story_dna,
    arcs: (bundle.arcs?.items || []).slice(0, 6).map((a) => ({
      name: a.name,
      current_stage: a.current_stage,
      risk: a.risk,
      breakpoints: a.breakpoints?.slice(0, 2),
    })),
    conflicts: (bundle.conflicts?.items || []).slice(0, 5).map((c) => ({
      conflict: c.conflict,
      intensity: c.intensity,
      gap: c.gap,
    })),
    today_actions: (actionsDoc?.items || []).slice(0, 3).map((a) => ({
      id: a.id,
      title: a.title,
      diagnosis: a.diagnosis,
      proposal: a.proposal,
    })),
  };

  let text = `【作品理解 Story Understanding — 优先于 KB 细节】\n${JSON.stringify(compact, null, 2)}`;
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}…`;
  return `\n\n---\n\n${text}`;
}
