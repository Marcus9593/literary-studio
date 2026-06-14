import { randomUUID } from 'crypto';
import { resolveEntity } from '../story-kb/entity-resolver.js';

const CONFLICT_KEYWORDS = /对抗|冲突|战斗|争执|对立|追杀|试炼|失败|危机|反目|挑战|压迫/;

// 鸿沟检测关键词：角色行动后遭遇意外反应的模式
const GAP_ACTION_KEYWORDS = /期望|以为|认为|本以为|原以为|没想到|不料|却|竟然|居然|然而|但是|可是|不料|谁知|岂料/;
const GAP_REACTION_KEYWORDS = /震惊|愕然|愣住|意外|出乎意料|始料未及|万万没想到|大跌眼镜|目瞪口呆|瞠目结舌|惊呆/;
const GAP_PATTERN_VERBS = /打脸|反杀|逆袭|翻盘|反转|打脸|揭穿|戳穿|识破|戳破|拆穿/;
const GAP_DEPTH_INDICATORS = {
  minor: /微微|略微|有些意外|稍感|轻声|微微一愣/,
  moderate: /震惊|大吃一惊|没想到|出乎意料|脸色一变|愣住了|呆住/,
  major: /世界观|信仰|崩塌|崩溃|颠覆|难以置信|天翻地覆|万念俱灰|如遭雷击|五雷轰顶/,
};

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

/**
 * 鸿沟分析（基于麦基《故事》鸿沟理论）
 *
 * 检测场景中"角色行动 → 期望反应 → 实际反应"的落差模式，
 * 评估鸿沟深度（最小/中度/最大），追踪力量转移方向。
 */
export function analyzeGaps({ kb, manifest, projectId = '' }) {
  const items = [];
  const chapters = manifest.chapters || [];
  const total = manifest.chapters_total || chapters.length;

  if (total === 0) {
    return { items };
  }

  const characterNames = (kb.characters?.items || []).map((c) => c.name);

  const scored = chapters.map((ch, i) => {
    const text = ch.text || '';
    const globalIndex = total - chapters.length + i + 1;

    // 计算鸿沟信号密度
    const actionHits = (text.match(GAP_ACTION_KEYWORDS) || []).length;
    const reactionHits = (text.match(GAP_REACTION_KEYWORDS) || []).length;
    const patternHits = (text.match(GAP_PATTERN_VERBS) || []).length;

    // 评估鸿沟深度分布
    const minorHits = (text.match(GAP_DEPTH_INDICATORS.minor) || []).length;
    const moderateHits = (text.match(GAP_DEPTH_INDICATORS.moderate) || []).length;
    const majorHits = (text.match(GAP_DEPTH_INDICATORS.major) || []).length;

    const totalSignals = actionHits + reactionHits + patternHits;
    const density = ch.words > 0 ? (totalSignals / (ch.words / 1000)) : 0;

    // 推断主导鸿沟深度
    let dominantDepth = 'none';
    if (majorHits > 0 && majorHits >= moderateHits) {
      dominantDepth = 'major';
    } else if (moderateHits > 0 && moderateHits >= minorHits) {
      dominantDepth = 'moderate';
    } else if (minorHits > 0 || totalSignals > 0) {
      dominantDepth = 'minor';
    }

    // 检测打脸/逆袭模式
    const hasReversal = patternHits > 0;

    return {
      ...ch,
      globalIndex,
      actionHits,
      reactionHits,
      patternHits,
      minorHits,
      moderateHits,
      majorHits,
      totalSignals,
      density,
      dominantDepth,
      hasReversal,
    };
  });

  // 全局鸿沟密度统计
  const avgDensity = scored.length
    ? scored.reduce((s, c) => s + c.density, 0) / scored.length
    : 0;

  // 鸿沟分布统计
  const depthDistribution = {
    minor: scored.filter((c) => c.dominantDepth === 'minor').length,
    moderate: scored.filter((c) => c.dominantDepth === 'moderate').length,
    major: scored.filter((c) => c.dominantDepth === 'major').length,
    none: scored.filter((c) => c.dominantDepth === 'none').length,
  };

  // 检测鸿沟缺失区间（与冲突密度类似，看中段）
  const midStart = Math.floor(total * 0.35);
  const midEnd = Math.floor(total * 0.65);
  const midChapters = scored.filter(
    (c) => c.globalIndex >= midStart && c.globalIndex <= midEnd,
  );
  const midGapCount = midChapters.filter(
    (c) => c.dominantDepth !== 'none',
  ).length;
  const midGapRate = midChapters.length
    ? midGapCount / midChapters.length
    : 0;

  // 检测高潮区间鸿沟深度（最后 15%）
  const climaxStart = Math.floor(total * 0.85);
  const climaxChapters = scored.filter(
    (c) => c.globalIndex >= climaxStart,
  );
  const climaxMajorCount = climaxChapters.filter(
    (c) => c.dominantDepth === 'major',
  ).length;

  // 评估鸿沟弧光质量
  const gapArcQuality = assessGapArcQuality(scored, total);

  // 生成诊断项
  const intensity = Math.min(95, Math.round(30 + avgDensity * 20 + depthDistribution.major * 5));

  // 主鸿沟分析项
  const mainGap = {
    id: 'gap_main',
    type: 'gap_analysis',
    label: '鸿沟张力',
    depth_distribution: depthDistribution,
    avg_density: Math.round(avgDensity * 100) / 100,
    intensity,
    arc_quality: gapArcQuality,
    gap: null,
    confidence: 0.65,
  };

  // 诊断信息
  if (midGapRate < 0.3 && total >= 10) {
    mainGap.gap = `第 ${midStart}–${midEnd} 章鸿沟信号稀疏，场景中"行动-反应落差"不足，角色行动过于顺利`;
  } else if (climaxMajorCount === 0 && total >= 10) {
    mainGap.gap = `高潮区间（第 ${climaxStart} 章起）缺少最大鸿沟，终局缺乏世界观级别的认知颠覆`;
  } else if (depthDistribution.major === 0 && total >= 5) {
    mainGap.gap = '全文缺少最大鸿沟，角色从未遭遇信念/世界观层面的根本挑战';
  } else if (depthDistribution.minor > depthDistribution.moderate + depthDistribution.major && total >= 10) {
    mainGap.gap = '鸿沟深度偏浅，多为微小意外，缺少中度以上的认知落差来推动情节转折';
  } else if (depthDistribution.none > total * 0.6) {
    mainGap.gap = '超过 60% 的章节缺少鸿沟信号，场景中角色行动过于顺利，缺少意外和落差';
  }

  items.push(mainGap);

  // 打脸/逆袭模式项
  const reversalChapters = scored.filter((c) => c.hasReversal);
  if (reversalChapters.length > 0) {
    items.push({
      id: 'gap_reversal',
      type: 'gap_pattern',
      label: '反转模式',
      pattern: 'reversal',
      count: reversalChapters.length,
      chapters: reversalChapters.map((c) => c.globalIndex).slice(0, 10),
      confidence: 0.6,
    });
  }

  // 鸿沟强度趋势
  if (scored.length >= 5) {
    const firstHalf = scored.slice(0, Math.floor(scored.length / 2));
    const secondHalf = scored.slice(Math.floor(scored.length / 2));
    const firstAvg = firstHalf.reduce((s, c) => s + c.density, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, c) => s + c.density, 0) / secondHalf.length;

    items.push({
      id: 'gap_trend',
      type: 'gap_trend',
      label: '鸿沟趋势',
      trend: secondAvg > firstAvg * 1.2
        ? 'ascending'
        : secondAvg < firstAvg * 0.7
          ? 'descending'
          : 'stable',
      first_half_density: Math.round(firstAvg * 100) / 100,
      second_half_density: Math.round(secondAvg * 100) / 100,
      confidence: 0.55,
    });
  }

  return { items };
}

/**
 * 评估鸿沟弧光质量：
 * 鸿沟深度是否随故事推进而递增（理想状态：小→中→大）
 */
function assessGapArcQuality(scored, total) {
  if (total < 5) return { score: 0, reason: '章节数不足，无法评估' };

  const thirdSize = Math.floor(total / 3);
  const first = scored.slice(0, thirdSize);
  const middle = scored.slice(thirdSize, thirdSize * 2);
  const last = scored.slice(thirdSize * 2);

  const avgDepth = (chapters) => {
    const weights = { none: 0, minor: 1, moderate: 2, major: 3 };
    const sum = chapters.reduce((s, c) => s + (weights[c.dominantDepth] || 0), 0);
    return chapters.length ? sum / chapters.length : 0;
  };

  const firstAvg = avgDepth(first);
  const midAvg = avgDepth(middle);
  const lastAvg = avgDepth(last);

  // 理想弧光：递增（first < mid < last）
  let score = 0;
  if (lastAvg > midAvg) score += 35;
  if (midAvg > firstAvg) score += 35;
  if (lastAvg > firstAvg) score += 20;
  if (lastAvg >= 2) score += 10; // 高潮段有中度以上鸿沟

  let reason = '';
  if (score >= 80) {
    reason = '鸿沟深度递增良好，符合"小→中→大"的理想弧光';
  } else if (score >= 50) {
    reason = '鸿沟弧光基本合理，但中后段递增可更明显';
  } else if (score >= 25) {
    reason = '鸿沟弧光偏平，后段深度未明显超越前段';
  } else {
    reason = '鸿沟弧光不理想，深度分布无明显递增趋势';
  }

  return {
    score,
    reason,
    depth_curve: {
      act1: Math.round(firstAvg * 100) / 100,
      act2: Math.round(midAvg * 100) / 100,
      act3: Math.round(lastAvg * 100) / 100,
    },
  };
}

// ────────────────────────────────────────────────────────────
// 转折点检测（P1-6 Turning Point Detection）
// ────────────────────────────────────────────────────────────

// 转折信号关键词库
const TP_PLOT_KEYWORDS = /突然|忽然|没想到|不料|谁知|岂料|竟然|居然|万万没想到|天翻地覆|风云突变|急转直下/;
const TP_CHARACTER_KEYWORDS = /决定|选择|发誓|承诺|放弃|觉醒|顿悟|决心|痛下决心|改过自新|洗心革面|幡然醒悟/;
const TP_EMOTION_KEYWORDS = /背叛|出卖|反目|和解|原谅|释怀|心碎|感动|泪流满面|痛彻心扉|肝肠寸断|破涕为笑/;
const TP_INFORMATION_KEYWORDS = /真相|原来|其实|揭示|发现|揭露|秘密|谎言|欺骗|曝光|大白于天下|水落石出/;

// 战略位置百分比（S 级转折的理想位置）
const STRATEGIC_POSITIONS = [0.20, 0.25, 0.50, 0.75, 0.85, 0.90];

/**
 * 检测故事中的转折点
 *
 * 基于 story_events 中多个事件密集出现的章节区域推断转折点，
 * 基于 review_metrics 中 overall_score 的突变辅助定位。
 *
 * @param {Array} storyEvents  - story_events 数组，每项含 chapter / type / description 等
 * @param {Array} reviewMetrics - review_metrics 数组，每项含 chapter / overall_score
 * @returns {{ items: Array }} 转折点列表
 */
export function detectTurningPoints(storyEvents = [], reviewMetrics = []) {
  const items = [];

  // 如果没有任何事件数据，无法检测
  if (storyEvents.length === 0 && reviewMetrics.length === 0) {
    return { items };
  }

  // ── 步骤 1：确定章节范围 ──
  const allChapters = [
    ...storyEvents.map((e) => e.chapter || 0),
    ...reviewMetrics.map((m) => m.chapter || 0),
  ].filter((c) => c > 0);
  const maxChapter = allChapters.length ? Math.max(...allChapters) : 0;
  if (maxChapter === 0) return { items };

  // ── 步骤 2：事件密集区检测（滑动窗口） ──
  const WINDOW_SIZE = 5;
  const eventBucket = new Map();
  for (const ev of storyEvents) {
    const ch = ev.chapter || 0;
    if (ch <= 0) continue;
    eventBucket.set(ch, (eventBucket.get(ch) || 0) + 1);
  }

  // 每个窗口的事件总数
  const windowScores = [];
  for (let start = 1; start <= maxChapter; start++) {
    let total = 0;
    for (let ch = start; ch < start + WINDOW_SIZE && ch <= maxChapter; ch++) {
      total += eventBucket.get(ch) || 0;
    }
    windowScores.push({ start, end: Math.min(start + WINDOW_SIZE - 1, maxChapter), eventCount: total });
  }

  const avgEventCount = windowScores.length
    ? windowScores.reduce((s, w) => s + w.eventCount, 0) / windowScores.length
    : 0;
  const eventThreshold = Math.max(avgEventCount * 1.5, 2);

  const denseWindows = windowScores.filter((w) => w.eventCount >= eventThreshold);

  // ── 步骤 3：评分突变检测 ──
  const scoreMap = new Map();
  for (const m of reviewMetrics) {
    const ch = m.chapter || 0;
    const score = m.overall_score ?? m.score ?? null;
    if (ch > 0 && score != null) {
      scoreMap.set(ch, Number(score));
    }
  }

  // 计算相邻章节评分差
  const scoreChapters = [...scoreMap.keys()].sort((a, b) => a - b);
  const SCORE_JUMP_THRESHOLD = 1.5;
  const scoreMutationPoints = [];
  for (let i = 1; i < scoreChapters.length; i++) {
    const prev = scoreMap.get(scoreChapters[i - 1]);
    const curr = scoreMap.get(scoreChapters[i]);
    const diff = Math.abs(curr - prev);
    if (diff >= SCORE_JUMP_THRESHOLD) {
      scoreMutationPoints.push({
        chapter: scoreChapters[i],
        prevScore: prev,
        currScore: curr,
        diff,
      });
    }
  }

  // ── 步骤 4：信号合并 & 转折点候选生成 ──
  // 为每个密集窗口生成候选转折点
  const candidates = new Map(); // chapter → candidate object

  for (const win of denseWindows) {
    const midChapter = Math.round((win.start + win.end) / 2);
    if (!candidates.has(midChapter)) {
      candidates.set(midChapter, {
        chapter: midChapter,
        windowStart: win.start,
        windowEnd: win.end,
        eventDensityScore: Math.min(50, Math.round((win.eventCount / Math.max(eventThreshold, 1)) * 25)),
        scoreMutationScore: 0,
        signals: [],
        eventTypes: [],
      });
    }
  }

  // 叠加评分突变信号
  for (const mut of scoreMutationPoints) {
    // 找最近的候选
    let closest = null;
    let minDist = Infinity;
    for (const [ch, cand] of candidates) {
      const dist = Math.abs(ch - mut.chapter);
      if (dist < minDist) {
        minDist = dist;
        closest = cand;
      }
    }

    if (closest && minDist <= WINDOW_SIZE) {
      closest.scoreMutationScore += Math.min(30, Math.round(mut.diff * 10));
      closest.signals.push('score_mutation');
    } else {
      // 创建新的候选
      candidates.set(mut.chapter, {
        chapter: mut.chapter,
        windowStart: mut.chapter,
        windowEnd: mut.chapter,
        eventDensityScore: 0,
        scoreMutationScore: Math.min(30, Math.round(mut.diff * 10)),
        signals: ['score_mutation'],
        eventTypes: [],
      });
    }
  }

  // ── 步骤 5：类型推断 ──
  // 收集每个候选窗口内的事件类型
  for (const ev of storyEvents) {
    const ch = ev.chapter || 0;
    if (ch <= 0) continue;
    const desc = String(ev.description || ev.text || ev.summary || '');

    // 找到最近的候选
    for (const [, cand] of candidates) {
      if (ch >= cand.windowStart && ch <= cand.windowEnd) {
        if (TP_PLOT_KEYWORDS.test(desc)) cand.eventTypes.push('plot');
        if (TP_CHARACTER_KEYWORDS.test(desc)) cand.eventTypes.push('character');
        if (TP_EMOTION_KEYWORDS.test(desc)) cand.eventTypes.push('emotional');
        if (TP_INFORMATION_KEYWORDS.test(desc)) cand.eventTypes.push('information');

        // 也从事件类型字段推断
        const evType = String(ev.type || '').toLowerCase();
        if (/plot|event|incident|conflict/.test(evType)) cand.eventTypes.push('plot');
        if (/character|arc|growth|choice/.test(evType)) cand.eventTypes.push('character');
        if (/emotion|relationship|bond/.test(evType)) cand.eventTypes.push('emotional');
        if (/reveal|info|secret|truth/.test(evType)) cand.eventTypes.push('information');
      }
    }
  }

  // ── 步骤 6：强度计算与等级映射 ──
  for (const [, cand] of candidates) {
    let baseScore = cand.eventDensityScore + cand.scoreMutationScore;

    // 去重事件类型
    const uniqueTypes = [...new Set(cand.eventTypes)];

    // 类型交叉加成：多种转折类型叠加
    if (uniqueTypes.length >= 3) baseScore += 20;
    else if (uniqueTypes.length >= 2) baseScore += 10;

    // 战略位置加成
    const positionRatio = cand.chapter / maxChapter;
    const isStrategic = STRATEGIC_POSITIONS.some(
      (pos) => Math.abs(positionRatio - pos) <= 0.05,
    );
    if (isStrategic) baseScore += 15;

    // 信号多样性加成
    const uniqueSignals = [...new Set(cand.signals)];
    if (uniqueSignals.length >= 2) baseScore += 10;

    // 强度等级映射
    let strength;
    if (baseScore >= 80) strength = 'S';
    else if (baseScore >= 60) strength = 'A';
    else if (baseScore >= 40) strength = 'B';
    else if (baseScore >= 20) strength = 'C';
    else continue; // 分数过低，不标记

    // 主类型推断
    const typeCounts = {};
    for (const t of uniqueTypes) {
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const primaryType = uniqueTypes.length > 0
      ? uniqueTypes.reduce((a, b) => (typeCounts[a] || 0) >= (typeCounts[b] || 0) ? a : b)
      : 'plot';

    items.push({
      id: `tp_ch${cand.chapter}`,
      type: 'turning_point',
      chapter: cand.chapter,
      window: { start: cand.windowStart, end: cand.windowEnd },
      primary_type: primaryType,
      all_types: uniqueTypes,
      strength,
      score: baseScore,
      signals: {
        event_density: cand.eventDensityScore,
        score_mutation: cand.scoreMutationScore,
        type_diversity_bonus: uniqueTypes.length >= 2 ? (uniqueTypes.length >= 3 ? 20 : 10) : 0,
        strategic_position_bonus: isStrategic ? 15 : 0,
      },
      confidence: Math.min(0.9, 0.4 + (baseScore / 200) + (uniqueTypes.length * 0.05)),
    });
  }

  // ── 步骤 7：间距验证 & 过密转折处理 ──
  // 按章节排序
  items.sort((a, b) => a.chapter - b.chapter);

  // 检查 S 级间距（>= 20% 篇幅）
  const sLevelItems = items.filter((t) => t.strength === 'S');
  const minSDistance = Math.max(Math.floor(maxChapter * 0.2), 5);
  for (let i = 1; i < sLevelItems.length; i++) {
    const gap = sLevelItems[i].chapter - sLevelItems[i - 1].chapter;
    if (gap < minSDistance) {
      // 降级较弱的那个
      const weaker = sLevelItems[i].score <= sLevelItems[i - 1].score ? sLevelItems[i] : sLevelItems[i - 1];
      weaker.strength = 'A';
      weaker.confidence *= 0.8;
    }
  }

  // 检查 A 级间距（>= 10 章）
  const aLevelItems = items.filter((t) => t.strength === 'A');
  for (let i = 1; i < aLevelItems.length; i++) {
    const gap = aLevelItems[i].chapter - aLevelItems[i - 1].chapter;
    if (gap < 10) {
      const weaker = aLevelItems[i].score <= aLevelItems[i - 1].score ? aLevelItems[i] : aLevelItems[i - 1];
      weaker.strength = 'B';
      weaker.confidence *= 0.8;
    }
  }

  // 最终按章节排序
  items.sort((a, b) => a.chapter - b.chapter);

  return { items };
}

/**
 * 根据鸿沟分析构建建议 Action
 */
export function buildGapAction(gapItem) {
  if (!gapItem?.gap) return null;

  const arcQ = gapItem.arc_quality || {};
  const dist = gapItem.depth_distribution || {};

  let proposal = '';
  let executionPrompt = '';

  if (dist.major === 0) {
    proposal = '在故事高潮前设计一个最大鸿沟：角色的核心信念或世界观被根本颠覆';
    executionPrompt = `【Story Action · 鸿沟增强 — 最大鸿沟缺失】
诊断：${gapItem.gap}
建议：在高潮段设计一次"世界观颠覆"级别的鸿沟——角色发现其一直坚信的某个前提完全错误。
操作：
1. 确定角色当前最核心的信念/认知
2. 设计一个事件彻底颠覆该信念
3. 展示角色面对鸿沟的反应（崩溃→重建）
请先 Read 高潮段附近正文，给出 3 条可执行改稿要点。`;
  } else if (arcQ.score < 50) {
    proposal = '调整鸿沟深度分布，使前段小鸿沟逐步升级为后段大鸿沟';
    executionPrompt = `【Story Action · 鸿沟弧光优化】
诊断：${arcQ.reason || gapItem.gap}
建议：重新分配各段鸿沟深度——
  - 前 1/3：以最小鸿沟为主（角色试探世界，小意外积累）
  - 中 1/3：中度鸿沟出现（角色策略被挑战，被迫改变路线）
  - 后 1/3：最大鸿沟爆发（世界观被颠覆，角色被迫重塑自我）
请检查全文鸿沟分布，列出需要调整的具体章节。`;
  } else {
    proposal = '在鸿沟稀疏区间增加"行动-期望-实际反应"的落差设计';
    executionPrompt = `【Story Action · 鸿沟密度提升】
诊断：${gapItem.gap}
建议：在鸿沟稀疏的章节中，为角色的每次关键行动增加期望与实际反应的落差。
操作：
1. 找到角色行动顺利的场景
2. 在行动后插入一个意外反应（最小或中度鸿沟即可）
3. 让角色从鸿沟中"发现"某些新信息
请先 Read 诊断区间正文，给出 3 条可执行改稿要点。`;
  }

  return {
    id: `act_gap_${randomUUID().slice(0, 8)}`,
    type: 'gap_enhancement',
    source: 'gaps',
    source_id: gapItem.id,
    title: dist.major === 0 ? '增加最大鸿沟' : arcQ.score < 50 ? '优化鸿沟弧光' : '提升鸿沟密度',
    diagnosis: gapItem.gap,
    proposal,
    execution_mode: 'rewrite_plan',
    impact_estimate: {
      metric: '鸿沟张力',
      delta: '+15%',
      chapters: [],
      risk: 'medium',
    },
    priority: dist.major === 0 ? 80 : arcQ.score < 50 ? 70 : 60,
    execution_prompt: executionPrompt,
  };
}
