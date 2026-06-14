/**
 * 结构完整性验证器（Structure Verifier）
 *
 * 基于 structural-integrity-checklist.md 的七维度检查标准，
 * 对故事的 arcs / conflicts / valueShifts / turningPoints / emotionCurve
 * 进行自动化结构完整性评分与问题诊断。
 */

// ─── 权重配置 ───────────────────────────────────────────────

const DIMENSION_WEIGHTS = {
  three_act: 0.20,
  truby_22: 0.15,
  snyder_beat: 0.15,
  value_dimension: 0.10,
  turning_points: 0.15,
  gap_depth: 0.10,
  emotion_curve: 0.15,
};

// ─── 三幕结构位置基准 ───────────────────────────────────────

const THREE_ACT_MARKERS = {
  inciting_event: { start: 0.10, end: 0.16 },
  act_one_turn: { start: 0.20, end: 0.26 },
  midpoint: { start: 0.44, end: 0.56 },
  act_two_turn: { start: 0.70, end: 0.82 },
  climax: { start: 0.84, end: 0.96 },
};

// ─── 斯奈德节拍位置基准 ─────────────────────────────────────

const SNYDER_BEATS = [
  { id: 'opening_image', label: '开场画面', start: 0.00, end: 0.02, critical: false },
  { id: 'theme_stated', label: '主题陈述', start: 0.03, end: 0.06, critical: false },
  { id: 'setup', label: '铺垫', start: 0.01, end: 0.10, critical: false },
  { id: 'catalyst', label: '催化剂', start: 0.10, end: 0.13, critical: true },
  { id: 'debate', label: '纠结', start: 0.10, end: 0.13, critical: false },
  { id: 'break_into_two', label: '进入第二幕', start: 0.12, end: 0.14, critical: false },
  { id: 'b_story', label: '副线故事', start: 0.20, end: 0.60, critical: false },
  { id: 'fun_and_games', label: '游戏时间', start: 0.20, end: 0.50, critical: false },
  { id: 'midpoint', label: '中点', start: 0.45, end: 0.55, critical: true },
  { id: 'bad_guys_close_in', label: '坏蛋逼近', start: 0.50, end: 0.75, critical: false },
  { id: 'all_is_lost', label: '一无所有', start: 0.73, end: 0.78, critical: true },
  { id: 'dark_night', label: '灵魂暗夜', start: 0.75, end: 0.80, critical: false },
  { id: 'break_into_three', label: '进入第三幕', start: 0.80, end: 0.83, critical: false },
  { id: 'finale', label: '高潮', start: 0.80, end: 0.99, critical: true },
  { id: 'final_image', label: '终场画面', start: 0.98, end: 1.00, critical: false },
];

// ─── 特鲁比 22 步主结构点 ────────────────────────────────────

const TRUBY_MAIN_STEPS = [
  { id: 'false_self', label: '虚假自我 / 幽灵', position: 0.00, range: [0.00, 0.10] },
  { id: 'desire', label: '欲望', position: 0.10, range: [0.05, 0.15] },
  { id: 'opponent', label: '对手', position: 0.15, range: [0.10, 0.25] },
  { id: 'plan', label: '计划', position: 0.25, range: [0.15, 0.40] },
  { id: 'battle', label: '对决', position: 0.90, range: [0.85, 0.96] },
  { id: 'self_revelation', label: '自我揭示', position: 0.95, range: [0.88, 1.00] },
  { id: 'new_equilibrium', label: '新平衡', position: 1.00, range: [0.95, 1.00] },
];

// ─── 辅助工具 ───────────────────────────────────────────────

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * 将转折点列表映射到 [0, 1] 位置比例
 */
function normalizePositions(items, totalChapters) {
  if (!items?.length || !totalChapters) return [];
  return items.map((tp) => ({
    ...tp,
    ratio: clamp01((tp.chapter ?? tp.position ?? 0) / totalChapters),
  }));
}

/**
 * 检查某个 ratio 是否落在 [start, end] 区间内
 */
function inRange(ratio, start, end) {
  return ratio >= start && ratio <= end;
}

/**
 * 在给定区间内查找匹配的转折点（按最近距离排序）
 */
function findClosest(items, start, end) {
  const mid = (start + end) / 2;
  const matched = items.filter((tp) => inRange(tp.ratio, start - 0.03, end + 0.03));
  if (!matched.length) return null;
  matched.sort((a, b) => Math.abs(a.ratio - mid) - Math.abs(b.ratio - mid));
  return matched[0];
}

// ─── 维度 1：三幕结构 ───────────────────────────────────────

function checkThreeAct(turningPoints, totalChapters) {
  const tps = normalizePositions(turningPoints, totalChapters);
  const checks = [];
  let score = 0;

  const markers = [
    { key: 'inciting_event', label: '激励事件' },
    { key: 'act_one_turn', label: '第一转折点' },
    { key: 'midpoint', label: '中点' },
    { key: 'act_two_turn', label: '第二转折点' },
    { key: 'climax', label: '高潮' },
  ];

  for (const m of markers) {
    const range = THREE_ACT_MARKERS[m.key];
    const found = findClosest(tps, range.start, range.end);
    const pass = !!found;
    if (pass) score += 20;
    checks.push({
      id: `three_act_${m.key}`,
      label: `三幕·${m.label}`,
      pass,
      detail: pass
        ? `在 ${(found.ratio * 100).toFixed(0)}% 处找到`
        : `在 ${(range.start * 100).toFixed(0)}-${(range.end * 100).toFixed(0)}% 区间未找到`,
    });
  }

  return { score, checks };
}

// ─── 维度 2：特鲁比 22 步覆盖度 ─────────────────────────────

function checkTruby22(arcs, turningPoints, totalChapters) {
  const tps = normalizePositions(turningPoints, totalChapters);
  const checks = [];
  let mainHits = 0;
  let supportHits = 0;

  // 7 个主结构点
  for (const step of TRUBY_MAIN_STEPS) {
    const found = tps.some(
      (tp) => inRange(tp.ratio, step.range[0] - 0.03, step.range[1] + 0.03),
    );
    if (found) mainHits++;
    checks.push({
      id: `truby_main_${step.id}`,
      label: `特鲁比·${step.label}`,
      pass: found,
      detail: found ? '已覆盖' : `需要在 ${(step.range[0] * 100).toFixed(0)}-${(step.range[1] * 100).toFixed(0)}% 区间补充`,
    });
  }

  // 15 个支撑节拍 — 通过 arcs 的数量和质量间接评估
  const arcCount = arcs?.length || 0;
  const arcsWithGoals = (arcs || []).filter((a) => a.goal || a.desire).length;
  const arcsWithOpponent = (arcs || []).filter((a) => a.opponent || a.antagonist).length;
  const arcsWithAlly = (arcs || []).filter((a) => a.ally || a.helper).length;
  const arcsWithRevelation = (arcs || []).filter((a) => a.revelation || a.self_revelation).length;

  const supportIndicators = [
    { id: 'ghost_world', hit: arcCount > 0, label: '幽灵与故事世界' },
    { id: 'weakness_need', hit: (arcs || []).some((a) => a.weakness || a.need), label: '缺陷与需求' },
    { id: 'desire_deep', hit: arcsWithGoals > 0, label: '欲望（深化）' },
    { id: 'ally_helper', hit: arcsWithAlly > 0, label: '盟友/助手' },
    { id: 'opponent_plan', hit: arcsWithOpponent > 0, label: '对手及其计划' },
    { id: 'ally_attack', hit: arcsWithAlly > 1, label: '盟友的攻击' },
    { id: 'apparent_defeat', hit: tps.some((tp) => tp.ratio > 0.68 && tp.ratio < 0.82), label: '表面失败' },
    { id: 'second_revelation', hit: arcsWithRevelation > 0, label: '第二次揭示' },
    { id: 'third_revelation', hit: arcsWithRevelation > 1, label: '第三次揭示与抉择' },
    { id: 'gate_dark', hit: tps.some((tp) => tp.ratio > 0.70 && tp.ratio < 0.85), label: '关隘/黑暗时刻' },
    { id: 'protagonist_revelation', hit: arcsWithRevelation > 0, label: '主角的自我揭示' },
    { id: 'moral_decision', hit: (arcs || []).some((a) => a.moral_decision), label: '道德抉择' },
  ];

  for (const si of supportIndicators) {
    if (si.hit) supportHits++;
    checks.push({
      id: `truby_support_${si.id}`,
      label: `特鲁比·${si.label}`,
      pass: si.hit,
      detail: si.hit ? '已有支撑' : '建议补充',
    });
  }

  // 主结构点 70 分 + 支撑节拍 30 分
  const mainScore = (mainHits / 7) * 70;
  const supportScore = (supportHits / supportIndicators.length) * 30;
  const score = Math.round(mainScore + supportScore);

  return { score, checks };
}

// ─── 维度 3：斯奈德 Beat Sheet ──────────────────────────────

function checkSnyderBeatSheet(turningPoints, totalChapters) {
  const tps = normalizePositions(turningPoints, totalChapters);
  const checks = [];
  let totalDeduction = 0;

  for (const beat of SNYDER_BEATS) {
    const found = findClosest(tps, beat.start, beat.end);
    const pass = !!found;
    const deduction = !pass ? (beat.critical ? 12 : 5) : 0;
    totalDeduction += deduction;

    // 位置偏移检查
    let offset = false;
    if (found) {
      const expectedMid = (beat.start + beat.end) / 2;
      if (Math.abs(found.ratio - expectedMid) > 0.05) {
        offset = true;
        totalDeduction += 2;
      }
    }

    checks.push({
      id: `snyder_${beat.id}`,
      label: `斯奈德·${beat.label}`,
      pass,
      detail: pass
        ? offset
          ? `在 ${(found.ratio * 100).toFixed(0)}% 处找到（位置偏移）`
          : `在 ${(found.ratio * 100).toFixed(0)}% 处命中`
        : `在 ${(beat.start * 100).toFixed(0)}-${(beat.end * 100).toFixed(0)}% 区间未找到${beat.critical ? '（关键节拍）' : ''}`,
    });
  }

  const score = Math.max(0, Math.round(100 - totalDeduction));
  return { score, checks };
}

// ─── 维度 4：价值维度覆盖 ────────────────────────────────────

function checkValueDimensions(valueShifts) {
  const checks = [];
  const shifts = valueShifts || [];

  // 提取唯一维度对
  const dimensions = new Set();
  for (const vs of shifts) {
    const dim = vs.dimension || vs.value_pair || vs.type;
    if (dim) dimensions.add(dim);
  }

  const dimCount = dimensions.size;
  const dimScore = Math.min(dimCount, 5) * 10;

  checks.push({
    id: 'value_dim_diversity',
    label: '价值维度多样性',
    pass: dimCount >= 3,
    detail: `涉及 ${dimCount} 个维度对（需 >= 3）`,
  });

  // 检查正负极摆动
  let shiftsWithOscillation = 0;
  const dimGroups = {};
  for (const vs of shifts) {
    const dim = vs.dimension || vs.value_pair || vs.type || 'unknown';
    if (!dimGroups[dim]) dimGroups[dim] = [];
    dimGroups[dim].push(vs);
  }
  for (const [, group] of Object.entries(dimGroups)) {
    const directions = new Set(group.map((g) => g.direction || g.shift_direction).filter(Boolean));
    if (directions.size >= 2 || group.length >= 2) shiftsWithOscillation++;
  }

  const oscillationScore = Math.min(shiftsWithOscillation, 3) * 10;
  checks.push({
    id: 'value_dim_oscillation',
    label: '价值维度摆动',
    pass: shiftsWithOscillation >= 1,
    detail: `${shiftsWithOscillation} 个维度有正负摆动`,
  });

  // 高潮维度汇聚
  const climaxShifts = shifts.filter((s) => {
    const pos = s.position_ratio ?? s.chapter_ratio ?? null;
    return pos !== null && pos >= 0.80 && pos <= 0.98;
  });
  const climaxDimCount = new Set(
    climaxShifts.map((s) => s.dimension || s.value_pair || s.type).filter(Boolean),
  ).size;
  const climaxScore = climaxDimCount >= 2 ? 10 : 0;

  checks.push({
    id: 'value_dim_climax',
    label: '高潮维度汇聚',
    pass: climaxDimCount >= 2,
    detail: `高潮区域涉及 ${climaxDimCount} 个维度（需 >= 2）`,
  });

  // 一致性
  const consistencyScore = dimCount > 0 ? 10 : 0;
  checks.push({
    id: 'value_dim_consistency',
    label: '价值维度一致性',
    pass: dimCount > 0,
    detail: dimCount > 0 ? '主题维度已贯穿' : '未检测到价值维度',
  });

  const score = Math.min(100, dimScore + oscillationScore + climaxScore + consistencyScore);
  return { score, checks };
}

// ─── 维度 5：转折点分布 ───────────────────────────────────────

function checkTurningPointDistribution(turningPoints, totalChapters) {
  const tps = normalizePositions(turningPoints, totalChapters);
  const checks = [];
  let score = 0;

  // 按强度分组
  const byLevel = { S: [], A: [], B: [], C: [] };
  for (const tp of tps) {
    const level = (tp.strength || tp.level || 'B').toUpperCase();
    if (byLevel[level]) byLevel[level].push(tp);
    else byLevel.B.push(tp);
  }

  // S 级数量检查（2-3 个）
  const sCount = byLevel.S.length;
  const sCountOk = sCount >= 2 && sCount <= 3;
  checks.push({
    id: 'tp_s_count',
    label: 'S 级转折点数量',
    pass: sCountOk,
    detail: `${sCount} 个（需 2-3 个）`,
  });

  // S 级位置检查
  const sPositions = byLevel.S.map((tp) => tp.ratio).sort((a, b) => a - b);
  const sPositionRanges = [
    { start: 0.18, end: 0.28, label: '第一幕转折' },
    { start: 0.42, end: 0.58, label: '中点' },
    { start: 0.82, end: 0.96, label: '高潮' },
  ];
  let sPositionScore = 0;
  for (const range of sPositionRanges) {
    const found = sPositions.some((r) => inRange(r, range.start, range.end));
    if (found) sPositionScore += 10;
    checks.push({
      id: `tp_s_pos_${range.label}`,
      label: `S 级位置·${range.label}`,
      pass: found,
      detail: found
        ? '位置合理'
        : `需要在 ${(range.start * 100).toFixed(0)}-${(range.end * 100).toFixed(0)}% 处`,
    });
  }

  // A 级数量检查（4-8 个）
  const aCount = byLevel.A.length;
  const aCountOk = aCount >= 4 && aCount <= 8;
  checks.push({
    id: 'tp_a_count',
    label: 'A 级转折点数量',
    pass: aCountOk,
    detail: `${aCount} 个（需 4-8 个）`,
  });

  // A 级间距检查
  const aPositions = byLevel.A.map((tp) => tp.ratio).sort((a, b) => a - b);
  let aSpacingOk = true;
  let aSpacingIssues = 0;
  for (let i = 1; i < aPositions.length; i++) {
    const gap = aPositions[i] - aPositions[i - 1];
    if (gap < 0.12 || gap > 0.28) aSpacingIssues++;
  }
  aSpacingOk = aSpacingIssues <= 1;
  const aSpacingScore = aSpacingOk ? 15 : Math.max(0, 15 - aSpacingIssues * 5);
  checks.push({
    id: 'tp_a_spacing',
    label: 'A 级转折点间距',
    pass: aSpacingOk,
    detail: aSpacingOk ? '间距合理' : `${aSpacingIssues} 处间距异常`,
  });

  // 转折递进趋势
  const allPositions = tps.map((tp) => ({
    ratio: tp.ratio,
    strength: (tp.strength || tp.level || 'B').toUpperCase(),
  }));
  const strengthValue = { S: 4, A: 3, B: 2, C: 1 };
  let ascending = true;
  let prevMax = 0;
  const bins = [
    [0, 0.33],
    [0.33, 0.66],
    [0.66, 1.0],
  ];
  for (const [start, end] of bins) {
    const binTps = allPositions.filter((tp) => inRange(tp.ratio, start, end));
    const maxStrength = binTps.length
      ? Math.max(...binTps.map((tp) => strengthValue[tp.strength] || 2))
      : 0;
    if (maxStrength < prevMax) ascending = false;
    prevMax = Math.max(prevMax, maxStrength);
  }
  const trendScore = ascending ? 20 : 8;
  checks.push({
    id: 'tp_ascending_trend',
    label: '转折递进趋势',
    pass: ascending,
    detail: ascending ? '强度递增' : '部分区间强度倒退',
  });

  // B/C 密度合理性
  const bcCount = byLevel.B.length + byLevel.C.length;
  const bcOk = bcCount >= 10 && bcCount <= 30;
  checks.push({
    id: 'tp_bc_density',
    label: 'B/C 级转折密度',
    pass: bcOk,
    detail: `${bcCount} 个（需 10-30 个）`,
  });
  const bcScore = bcOk ? 20 : Math.max(0, 20 - Math.abs(bcCount - 20));

  score = Math.min(100, sPositionScore + (sCountOk ? 0 : -10) + (aCountOk ? 0 : -10) + aSpacingScore + trendScore + bcScore);
  score = Math.max(0, score);

  return { score, checks };
}

// ─── 维度 6：鸿沟深度分布 ────────────────────────────────────

function checkGapDepth(conflicts, totalChapters) {
  const checks = [];
  const items = conflicts || [];

  // 鸿沟存在性
  const withGap = items.filter((c) => c.gap || c.gap_depth || c.expected_vs_actual);
  const gapRatio = items.length > 0 ? withGap.length / items.length : 0;
  const existencePass = gapRatio >= 0.5;
  const existenceScore = Math.min(25, Math.round(gapRatio * 25 / 0.6));

  checks.push({
    id: 'gap_existence',
    label: '鸿沟存在性',
    pass: existencePass,
    detail: `${withGap.length}/${items.length} 个冲突含鸿沟（需 >= 50%）`,
  });

  // 深度递进
  const depths = withGap
    .map((c) => ({
      depth: c.gap_depth ?? c.depth ?? 1,
      chapter: c.chapter ?? c.position ?? 0,
    }))
    .sort((a, b) => a.chapter - b.chapter);

  let depthAscending = true;
  for (let i = 1; i < depths.length; i++) {
    if (depths[i].depth < depths[i - 1].depth - 1) {
      depthAscending = false;
      break;
    }
  }
  const depthScore = depthAscending ? 25 : 10;

  checks.push({
    id: 'gap_depth_ascending',
    label: '鸿沟深度递进',
    pass: depthAscending,
    detail: depthAscending ? '深度逐步升级' : '存在深度回退',
  });

  // 最大鸿沟位置
  const maxDepthItem = depths.length
    ? depths.reduce((max, d) => (d.depth > max.depth ? d : max), depths[0])
    : null;
  const maxChapter = maxDepthItem?.chapter || 0;
  const maxRatio = totalChapters ? maxChapter / totalChapters : 0;
  const maxPositionPass = maxRatio >= 0.75 || maxDepthItem === null;
  const maxPositionScore = maxPositionPass ? 20 : 5;

  checks.push({
    id: 'gap_max_position',
    label: '最大鸿沟位置',
    pass: maxPositionPass,
    detail: maxDepthItem
      ? `最大鸿沟在第 ${maxChapter} 章 (${(maxRatio * 100).toFixed(0)}%)，需在 75%+ 处`
      : '未检测到鸿沟',
  });

  // 类型多样性
  const gapTypes = new Set(withGap.map((c) => c.gap_type || c.type).filter(Boolean));
  const typeScore = gapTypes.size >= 2 ? 15 : gapTypes.size * 7;

  checks.push({
    id: 'gap_type_diversity',
    label: '鸿沟类型多样性',
    pass: gapTypes.size >= 2,
    detail: `${gapTypes.size} 种类型（需 >= 2）`,
  });

  // 密度合理性
  const earlyGaps = withGap.filter((c) => (c.chapter ?? 0) / (totalChapters || 1) < 0.3).length;
  const lateGaps = withGap.filter((c) => (c.chapter ?? 0) / (totalChapters || 1) >= 0.3).length;
  const densityOk = lateGaps >= earlyGaps || withGap.length === 0;
  const densityScore = densityOk ? 15 : 5;

  checks.push({
    id: 'gap_density',
    label: '鸿沟密度分布',
    pass: densityOk,
    detail: `前30% ${earlyGaps} 个，后70% ${lateGaps} 个`,
  });

  const score = Math.min(100, existenceScore + depthScore + maxPositionScore + typeScore + densityScore);
  return { score, checks };
}

// ─── 维度 7：情感曲线健康度 ──────────────────────────────────

function checkEmotionCurve(emotionCurve) {
  const checks = [];
  const curve = emotionCurve || [];
  const points = curve.map((p) => (typeof p === 'number' ? p : p.tension ?? p.value ?? 5));

  if (points.length < 3) {
    checks.push({
      id: 'emotion_data',
      label: '情感曲线数据',
      pass: false,
      detail: `仅 ${points.length} 个数据点（需 >= 3）`,
    });
    return { score: 0, checks };
  }

  // 波动检测：找峰和谷
  const peaks = [];
  const valleys = [];
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i] > points[i - 1] && points[i] > points[i + 1]) peaks.push(i);
    if (points[i] < points[i - 1] && points[i] < points[i + 1]) valleys.push(i);
  }

  const waveOk = peaks.length >= 3 && valleys.length >= 2;
  checks.push({
    id: 'emotion_wave',
    label: '曲线波动',
    pass: waveOk,
    detail: `${peaks.length} 个峰, ${valleys.length} 个谷（需 >= 3 峰, >= 2 谷）`,
  });
  const waveScore = waveOk ? 20 : Math.min(20, peaks.length * 4 + valleys.length * 4);

  // 整体趋势：后期峰值应高于前期
  const firstHalfPeaks = peaks.filter((p) => p < points.length / 2).map((p) => points[p]);
  const secondHalfPeaks = peaks.filter((p) => p >= points.length / 2).map((p) => points[p]);
  const firstMax = firstHalfPeaks.length ? Math.max(...firstHalfPeaks) : 0;
  const secondMax = secondHalfPeaks.length ? Math.max(...secondHalfPeaks) : 0;
  const trendOk = secondMax >= firstMax;
  checks.push({
    id: 'emotion_trend',
    label: '整体递增趋势',
    pass: trendOk,
    detail: trendOk ? '后期峰值 >= 前期' : `前期峰值 ${firstMax} > 后期 ${secondMax}`,
  });
  const trendScore = trendOk ? 20 : 5;

  // 高潮峰值
  const maxVal = Math.max(...points);
  const maxIdx = points.indexOf(maxVal);
  const maxRatio = maxIdx / (points.length - 1);
  const climaxOk = maxRatio >= 0.75;
  checks.push({
    id: 'emotion_climax_peak',
    label: '高潮峰值',
    pass: climaxOk,
    detail: climaxOk
      ? `最高张力在 ${(maxRatio * 100).toFixed(0)}% 处`
      : `最高张力在 ${(maxRatio * 100).toFixed(0)}% 处（需 >= 75%）`,
  });
  const climaxScore = climaxOk ? 20 : 5;

  // 张力谷连续检查
  let consecutiveValleys = 0;
  let maxConsecutive = 0;
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i] < points[i - 1] && points[i] < points[i + 1]) {
      consecutiveValleys++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveValleys);
    } else {
      consecutiveValleys = 0;
    }
  }
  const valleyOk = maxConsecutive <= 2;
  checks.push({
    id: 'emotion_valley_run',
    label: '张力谷分布',
    pass: valleyOk,
    detail: valleyOk ? '无连续低谷堆积' : `连续 ${maxConsecutive} 个低谷`,
  });
  const valleyScore = valleyOk ? 15 : 5;

  // 开场张力
  const startTension = points[0];
  const midRange = (maxVal + Math.min(...points)) / 2;
  const startOk = startTension > Math.min(...points) && startTension < maxVal;
  checks.push({
    id: 'emotion_start',
    label: '开场张力',
    pass: startOk,
    detail: `开场张力 ${startTension.toFixed(1)}（需适中）`,
  });
  const startScore = startOk ? 10 : 3;

  // 结尾回落
  const lastVal = points[points.length - 1];
  const secondLast = points[points.length - 2];
  const drop = secondLast - lastVal;
  const endOk = drop >= 0 && drop <= (maxVal - Math.min(...points)) * 0.6;
  checks.push({
    id: 'emotion_end_drop',
    label: '结尾回落',
    pass: endOk,
    detail: endOk ? '结尾适度回落' : '结尾张力骤降或未回落',
  });
  const endScore = endOk ? 10 : 3;

  // 节奏平滑度
  const maxRange = maxVal - Math.min(...points);
  let jerky = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i] - points[i - 1]) > maxRange * 0.4) jerky++;
  }
  const smoothOk = jerky <= 1;
  checks.push({
    id: 'emotion_smooth',
    label: '节奏平滑度',
    pass: smoothOk,
    detail: smoothOk ? '过渡平滑' : `${jerky} 处突变`,
  });
  const smoothScore = smoothOk ? 10 : 3;

  const score = Math.min(100, waveScore + trendScore + climaxScore + valleyScore + startScore + endScore + smoothScore);
  return { score, checks };
}

// ─── 主验证函数 ──────────────────────────────────────────────

/**
 * 验证故事结构完整性
 *
 * @param {Object} params
 * @param {Array}  params.arcs           - 成长线列表
 * @param {Array}  params.conflicts      - 冲突列表
 * @param {Array}  params.valueShifts    - 价值转变列表
 * @param {Array}  params.turningPoints  - 转折点列表（含 chapter, strength/level 字段）
 * @param {Array}  params.emotionCurve   - 情感曲线（数字数组或 {tension} 对象数组）
 * @param {number} params.totalChapters  - 总章节数（用于位置归一化）
 * @returns {{ score: number, dimensionScores: Object, checks: Array, gaps: Array, suggestions: Array }}
 */
export function verifyStructure({
  arcs = [],
  conflicts = [],
  valueShifts = [],
  turningPoints = [],
  emotionCurve = [],
  totalChapters = 0,
} = {}) {
  const d1 = checkThreeAct(turningPoints, totalChapters);
  const d2 = checkTruby22(arcs, turningPoints, totalChapters);
  const d3 = checkSnyderBeatSheet(turningPoints, totalChapters);
  const d4 = checkValueDimensions(valueShifts);
  const d5 = checkTurningPointDistribution(turningPoints, totalChapters);
  const d6 = checkGapDepth(conflicts, totalChapters);
  const d7 = checkEmotionCurve(emotionCurve);

  const dimensionScores = {
    three_act: d1.score,
    truby_22: d2.score,
    snyder_beat: d3.score,
    value_dimension: d4.score,
    turning_points: d5.score,
    gap_depth: d6.score,
    emotion_curve: d7.score,
  };

  // 加权总分
  const score = Math.round(
    Object.entries(DIMENSION_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + (dimensionScores[key] || 0) * weight,
      0,
    ),
  );

  // 汇总所有 checks
  const allChecks = [
    ...d1.checks,
    ...d2.checks,
    ...d3.checks,
    ...d4.checks,
    ...d5.checks,
    ...d6.checks,
    ...d7.checks,
  ];

  // 提取 gaps（未通过的检查项）
  const gaps = allChecks
    .filter((c) => !c.pass)
    .map((c) => ({
      check_id: c.id,
      label: c.label,
      detail: c.detail,
    }));

  // 生成修复建议
  const suggestions = buildSuggestions(gaps, dimensionScores);

  return {
    score,
    dimensionScores,
    checks: allChecks,
    gaps,
    suggestions,
  };
}

// ─── 修复建议生成 ────────────────────────────────────────────

const SUGGESTION_MAP = {
  three_act_inciting_event: '在大纲前 12-15% 处补充激励事件——一个打破主角日常状态的外部冲击。',
  three_act_act_one_turn: '在 20-25% 处增加第一转折点——主角做出不可逆的选择或被迫进入新世界。',
  three_act_midpoint: '在 45-55% 处设计中点转折——假胜利或假失败，翻转力量对比。',
  three_act_act_two_turn: '在 70-80% 处增加第二转折点——至暗时刻，主角陷入最低谷。',
  three_act_climax: '在 85-95% 处设计终极高潮——所有主题线索汇聚的终极对抗。',
  tp_s_count: 'S 级转折点需要 2-3 个，分别对应第一幕转折、中点、高潮。',
  tp_a_count: 'A 级转折点需要 4-8 个，均匀分布在全文中。',
  tp_ascending_trend: '转折强度应呈递增趋势，避免前期高潮超过后期。',
  value_dim_diversity: '至少涉及 3 个不同的价值维度对（如生/死、爱/恨、自由/奴役）。',
  emotion_wave: '情感曲线需要至少 3 个张力峰和 2 个张力谷，保持读者注意力。',
  emotion_climax_peak: '全文最高张力应在 75% 之后，通常在高潮场景。',
  gap_existence: '至少 50% 的关键场景应包含"期望与现实的落差"（鸿沟）。',
};

function buildSuggestions(gaps, dimensionScores) {
  const suggestions = [];

  // 按维度分数排序，优先处理最弱维度
  const sorted = Object.entries(dimensionScores)
    .sort(([, a], [, b]) => a - b)
    .filter(([, score]) => score < 70);

  for (const [dim, dimScore] of sorted) {
    const dimGaps = gaps.filter((g) => g.check_id.startsWith(dim === 'three_act' ? 'three_act' : dim));
    if (dimGaps.length > 0) {
      suggestions.push({
        dimension: dim,
        current_score: dimScore,
        priority: dimScore < 40 ? 'high' : 'medium',
        gaps: dimGaps.slice(0, 3).map((g) => g.label),
        action: SUGGESTION_MAP[dimGaps[0].check_id] || `优化 ${dim} 维度（当前 ${dimScore} 分）`,
      });
    }
  }

  // 补充特定高频问题的建议
  for (const gap of gaps) {
    if (SUGGESTION_MAP[gap.check_id] && !suggestions.find((s) => s.action === SUGGESTION_MAP[gap.check_id])) {
      // 仅补充最关键的前 2 条
      if (suggestions.length < 5) {
        suggestions.push({
          dimension: gap.check_id.split('_').slice(0, 2).join('_'),
          priority: 'medium',
          gaps: [gap.label],
          action: SUGGESTION_MAP[gap.check_id],
        });
      }
    }
  }

  return suggestions;
}
