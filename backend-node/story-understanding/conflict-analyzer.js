import { randomUUID } from 'crypto';
import { resolveEntity } from '../story-kb/entity-resolver.js';

const CONFLICT_KEYWORDS = /对抗|冲突|战斗|争执|对立|追杀|试炼|失败|危机|反目|挑战|压迫/;

/**
 * 冲突密度分析（启发式）
 */
function resolvePartyNames(projectId, kb) {
  const raw = (kb.characters?.items || []).slice(0, 2);
  if (!projectId) return raw.map((c) => c.name);
  return raw.map((c) => {
    const hit = resolveEntity(projectId, c.id || c.name) || resolveEntity(projectId, c.name);
    return hit?.canonicalName || c.name;
  });
}

export function analyzeConflicts({ kb, manifest, projectId = '' }) {
  const items = [];
  const chapters = manifest.chapters || [];
  const total = manifest.chapters_total || chapters.length;

  if (total === 0) {
    return { items };
  }

  const scored = chapters.map((ch, i) => {
    const hits = (ch.text.match(CONFLICT_KEYWORDS) || []).length;
    const density = ch.words > 0 ? (hits / (ch.words / 1000)) : 0;
    return { ...ch, hits, density, globalIndex: total - chapters.length + i + 1 };
  });

  const avgDensity = scored.length
    ? scored.reduce((s, c) => s + c.density, 0) / scored.length
    : 0;

  const midStart = Math.floor(total * 0.35);
  const midEnd = Math.floor(total * 0.65);
  const midChapters = scored.filter(
    (c) => c.globalIndex >= midStart && c.globalIndex <= midEnd,
  );
  const midAvg = midChapters.length
    ? midChapters.reduce((s, c) => s + c.density, 0) / midChapters.length
    : avgDensity;

  const intensity = Math.min(95, Math.round(40 + avgDensity * 25));
  const mainConflict = kb.story_summary?.main_conflict
    || kb.story_summary?.logline?.slice(0, 60)
    || '主线对立';

  items.push({
    id: 'conf_main',
    conflict: mainConflict,
    type: 'external',
    parties: resolvePartyNames(projectId, kb),
    intensity,
    intensity_trend: midAvg < avgDensity * 0.7 ? 'falling' : 'stable',
    status: 'ongoing',
    density_window: {
      from: midStart,
      to: midEnd,
      score: Math.round(midAvg * 100),
    },
    gap: midAvg < avgDensity * 0.65 && total >= 20
      ? `第 ${midStart}–${midEnd} 章冲突密度偏低，缺少正面对抗`
      : total > 0 && total < 20 && intensity < 58
        ? `开篇 ${total} 章，整体冲突张力偏弱，建议强化目标与阻碍的碰撞`
        : null,
    confidence: 0.7,
  });

  const factions = kb.story_summary?.factions || [];
  for (const fac of factions.slice(0, 2)) {
    items.push({
      id: `conf_${fac.id || fac.name}`,
      conflict: `vs ${fac.name}`,
      type: 'faction',
      parties: [fac.name],
      intensity: Math.round(intensity * 0.85),
      status: 'ongoing',
      confidence: 0.6,
    });
  }

  return { items };
}

export function findConflictForMessage(conflicts, message) {
  const msg = String(message || '');
  const items = conflicts?.items || [];
  if (/冲突|张力|对抗|中期/.test(msg)) {
    return items.find((c) => c.gap) || items[0];
  }
  return items[0];
}

export function buildConflictAction(conflict) {
  if (!conflict?.gap) return null;
  const win = conflict.density_window || {};
  const isOpening = (win.from || 0) < 5;
  return {
    id: `act_conf_${randomUUID().slice(0, 8)}`,
    type: 'conflict_boost',
    source: 'conflicts',
    source_id: conflict.id,
    title: isOpening ? '强化开篇冲突与钩子' : '提高中期冲突感',
    diagnosis: conflict.gap,
    proposal: isOpening
      ? '在最新章节增加一次明确的对立事件或失败代价，并在章末留下悬念'
      : `在第 ${win.from || 40}–${(win.to || 55) + 3} 章增加一次「正面对抗/试炼失败」事件，拉升冲突密度`,
    execution_mode: 'rewrite_plan',
    impact_estimate: {
      metric: '冲突密度',
      delta: '+18%',
      chapters: [],
      risk: 'medium',
    },
    priority: 85,
    execution_prompt: `【Story Action · 冲突增强】
问题：${conflict.gap}
建议：在中段章节设计一次可见的正面对抗（宗门试炼失败、公开对峙、利益冲突爆发等），让读者感受到压力升级。
请先 Read 第 ${win.from}–${win.to} 章附近正文，给出 3 条可执行改稿要点，再按作者确认执行。`,
  };
}
