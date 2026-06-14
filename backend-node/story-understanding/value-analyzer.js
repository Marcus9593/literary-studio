import { randomUUID } from 'crypto';

/**
 * 价值维度对定义（麦基《故事》Value Shift System）
 *
 * 每对维度包含正极端关键词和负极端关键词，用于启发式匹配。
 */
const VALUE_DIMENSIONS = [
  { dimension: '生/死', positive: ['生存', '康复', '安全', '活下来', '得救'], negative: ['死亡', '重伤', '致命', '濒死', '丧命', '牺牲'] },
  { dimension: '爱/恨', positive: ['爱', '喜欢', '心动', '亲密', '信任', '相恋'], negative: ['恨', '背叛', '仇', '厌恶', '疏离', '分手'] },
  { dimension: '自由/奴役', positive: ['自由', '解放', '自治', '选择', '挣脱'], negative: ['囚禁', '奴役', '控制', '压迫', '束缚', '关押'] },
  { dimension: '正义/不义', positive: ['正义', '公正', '清白', '救赎', '昭雪'], negative: ['冤屈', '腐败', '不义', '冤枉', '陷害'] },
  { dimension: '真相/谎言', positive: ['真相', '发现', '揭示', '醒悟', '揭露'], negative: ['欺骗', '谎言', '蒙蔽', '幻觉', '隐瞒', '造假'] },
  { dimension: '勇气/怯懦', positive: ['勇气', '挺身', '决断', '勇敢', '无畏'], negative: ['怯懦', '退缩', '逃避', '妥协', '畏惧', '胆怯'] },
  { dimension: '希望/绝望', positive: ['希望', '信念', '转机', '重生', '曙光'], negative: ['绝望', '虚无', '毁灭', '崩溃', '无望'] },
  { dimension: '归属/孤立', positive: ['团聚', '认同', '接纳', '归属', '融入'], negative: ['孤独', '排斥', '流放', '孤立', '被逐', '离群'] },
  { dimension: '成功/失败', positive: ['成功', '胜利', '达成', '收获', '赢'], negative: ['失败', '落空', '破产', '败', '输了'] },
  { dimension: '忠诚/背叛', positive: ['忠诚', '信守', '盟约', '守护', '不离不弃'], negative: ['背叛', '叛变', '出卖', '背弃', '倒戈'] },
  { dimension: '知足/贪婪', positive: ['满足', '知足', '节制', '感恩'], negative: ['贪婪', '执念', '沉迷', '贪得无厌'] },
  { dimension: '秩序/混乱', positive: ['秩序', '稳定', '法治', '和平'], negative: ['混乱', '动乱', '失控', '暴政', '战乱'] },
  { dimension: '纯真/世故', positive: ['纯真', '天真', '理想', '赤诚'], negative: ['世故', '圆滑', '算计', '麻木', '老练'] },
  { dimension: '尊严/屈辱', positive: ['尊严', '体面', '荣耀', '尊重'], negative: ['屈辱', '羞辱', '卑微', '践踏', '丢脸'] },
  { dimension: '修炼/停滞', positive: ['突破', '进阶', '领悟', '提升', '精进'], negative: ['停滞', '瓶颈', '退步', '走火入魔'] },
];

/**
 * 从文本中推断价值转变信息。
 *
 * 扫描关键词命中，返回最可能的维度、转变方向和幅度。
 */
function inferShiftFromText(text) {
  const normalized = String(text || '');
  let bestMatch = null;
  let bestScore = 0;

  for (const dim of VALUE_DIMENSIONS) {
    let posHits = 0;
    let negHits = 0;
    for (const kw of dim.positive) {
      if (normalized.includes(kw)) posHits++;
    }
    for (const kw of dim.negative) {
      if (normalized.includes(kw)) negHits++;
    }
    const score = posHits + negHits;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { dimension: dim.dimension, posHits, negHits };
    }
  }

  if (!bestMatch || bestScore === 0) return null;

  const { dimension, posHits, negHits } = bestMatch;

  // 推断转变方向
  let shiftType = 'lateral';
  let fromValue = '';
  let toValue = '';

  if (posHits > 0 && negHits > 0) {
    // 同时命中正负关键词 → 讽刺转变或剧烈转变
    shiftType = 'ironic';
    fromValue = VALUE_DIMENSIONS.find(d => d.dimension === dimension)?.negative[0] || '';
    toValue = VALUE_DIMENSIONS.find(d => d.dimension === dimension)?.positive[0] || '';
  } else if (negHits > 0) {
    shiftType = 'negative';
    fromValue = VALUE_DIMENSIONS.find(d => d.dimension === dimension)?.positive[0] || '';
    toValue = VALUE_DIMENSIONS.find(d => d.dimension === dimension)?.negative[0] || '';
  } else if (posHits > 0) {
    shiftType = 'positive';
    fromValue = VALUE_DIMENSIONS.find(d => d.dimension === dimension)?.negative[0] || '';
    toValue = VALUE_DIMENSIONS.find(d => d.dimension === dimension)?.positive[0] || '';
  }

  // 推断幅度
  let magnitude = 'micro';
  if (bestScore >= 3) {
    magnitude = '颠覆';
  } else if (bestScore >= 2) {
    magnitude = 'significant';
  }

  return { dimension, fromValue, toValue, shiftType, magnitude, score: bestScore };
}

/**
 * 从故事事件列表中提取价值转变事件。
 *
 * 优先使用已有的 value_shift_occurred 事件（来自 Python 端提取），
 * 其次从其他事件的 payload/text 中启发式推断。
 */
export function analyzeValueShifts({ kb, manifest, storyEvents = [] }) {
  const items = [];

  // 1. 收集已有的 value_shift_occurred 事件
  for (const evt of storyEvents) {
    if (evt.event_type === 'value_shift_occurred') {
      const p = evt.payload || {};
      items.push({
        id: evt.event_id || `vs_${randomUUID().slice(0, 8)}`,
        chapter: evt.chapter,
        subject: evt.subject || '',
        dimension: p.dimension || '未知',
        from_value: p.from_value || '',
        to_value: p.to_value || '',
        shift_type: p.shift_type || 'lateral',
        magnitude: p.magnitude || 'micro',
        source: 'event',
      });
    }
  }

  // 2. 从章节文本中启发式推断（当没有事件数据时）
  const chapters = manifest.chapters || [];
  const existingChapters = new Set(items.map(i => i.chapter));

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const chapterNum = ch.globalIndex || (manifest.chapters_total - chapters.length + i + 1);

    // 跳过已有事件的章节
    if (existingChapters.has(chapterNum)) continue;

    const text = ch.text || '';
    const inferred = inferShiftFromText(text);
    if (inferred) {
      items.push({
        id: `vs_ch${chapterNum}_${randomUUID().slice(0, 8)}`,
        chapter: chapterNum,
        subject: '',
        dimension: inferred.dimension,
        from_value: inferred.fromValue,
        to_value: inferred.toValue,
        shift_type: inferred.shiftType,
        magnitude: inferred.magnitude,
        source: 'inferred',
      });
    }
  }

  // 按章节排序
  items.sort((a, b) => (a.chapter || 0) - (b.chapter || 0));

  return { items };
}

/**
 * 构建逐章价值曲线。
 *
 * 将价值转变事件按章节聚合，计算每章的价值变化密度和最大幅度，
 * 输出可用于可视化的曲线数据。
 */
export function buildValueCurve(items) {
  const chapterMap = new Map();

  for (const item of items || []) {
    const ch = item.chapter || 0;
    if (!chapterMap.has(ch)) {
      chapterMap.set(ch, { chapter: ch, shifts: [], maxMagnitude: 'micro', shiftCount: 0 });
    }
    const entry = chapterMap.get(ch);
    entry.shifts.push(item);
    entry.shiftCount++;

    // 更新最大幅度
    const magOrder = { micro: 0, significant: 1, '颠覆': 2 };
    if ((magOrder[item.magnitude] || 0) > (magOrder[entry.maxMagnitude] || 0)) {
      entry.maxMagnitude = item.magnitude;
    }
  }

  // 转换为有序数组
  const curve = [];
  for (const [, entry] of chapterMap) {
    const magnitudeScore = entry.maxMagnitude === '颠覆' ? 3
      : entry.maxMagnitude === 'significant' ? 2
        : 1;

    // 计算方向性得分：positive=+1, negative=-1, ironic=0, lateral=0
    let directionScore = 0;
    for (const shift of entry.shifts) {
      if (shift.shift_type === 'positive') directionScore += 1;
      else if (shift.shift_type === 'negative') directionScore -= 1;
    }

    curve.push({
      chapter: entry.chapter,
      shift_count: entry.shiftCount,
      max_magnitude: entry.maxMagnitude,
      magnitude_score: magnitudeScore,
      direction_score: directionScore,
      dimensions: [...new Set(entry.shifts.map(s => s.dimension))],
    });
  }

  curve.sort((a, b) => a.chapter - b.chapter);
  return curve;
}

/**
 * 检测无价值转变的平坦区间。
 *
 * 扫描价值曲线，找出连续 N 章（threshold）没有显著价值转变的区间。
 * 返回平坦区间列表，每个包含起止章节和建议。
 */
export function detectFlatScenes(items, threshold = 3) {
  const curve = buildValueCurve(items);
  const flatRanges = [];

  if (curve.length === 0) return flatRanges;

  // 构建章节集合，快速查找
  const curveChapters = new Set(curve.map(c => c.chapter));
  const allChapters = curve.map(c => c.chapter).sort((a, b) => a - b);
  const minCh = allChapters[0];
  const maxCh = allChapters[allChapters.length - 1];

  let flatStart = null;
  let consecutiveFlat = 0;

  for (let ch = minCh; ch <= maxCh; ch++) {
    const entry = curve.find(c => c.chapter === ch);
    const isFlat = !entry || entry.shift_count === 0
      || (entry.max_magnitude === 'micro' && entry.shift_count <= 1);

    if (isFlat) {
      if (flatStart === null) flatStart = ch;
      consecutiveFlat++;
    } else {
      if (consecutiveFlat >= threshold) {
        flatRanges.push({
          from_chapter: flatStart,
          to_chapter: flatStart + consecutiveFlat - 1,
          length: consecutiveFlat,
          suggestion: `第 ${flatStart}–${flatStart + consecutiveFlat - 1} 章连续 ${consecutiveFlat} 章缺乏价值转变，建议插入一个显著或颠覆性转变事件`,
        });
      }
      flatStart = null;
      consecutiveFlat = 0;
    }
  }

  // 处理尾部平坦区间
  if (consecutiveFlat >= threshold) {
    flatRanges.push({
      from_chapter: flatStart,
      to_chapter: flatStart + consecutiveFlat - 1,
      length: consecutiveFlat,
      suggestion: `第 ${flatStart}–${flatStart + consecutiveFlat - 1} 章连续 ${consecutiveFlat} 章缺乏价值转变，建议插入一个显著或颠覆性转变事件`,
    });
  }

  return flatRanges;
}

/**
 * 基于价值分析结果生成行动建议。
 */
export function buildValueShiftActions({ valueCurve, flatRanges }) {
  const actions = [];

  // 为每个平坦区间生成行动建议
  for (const range of (flatRanges || []).slice(0, 2)) {
    actions.push({
      id: `act_vs_${randomUUID().slice(0, 8)}`,
      type: 'value_shift_boost',
      source: 'value_shifts',
      source_id: `flat_${range.from_chapter}_${range.to_chapter}`,
      title: `价值转变补强：第 ${range.from_chapter}–${range.to_chapter} 章`,
      diagnosis: range.suggestion,
      proposal: `在第 ${range.from_chapter}–${Math.min(range.to_chapter, range.from_chapter + 2)} 章安排一次显著价值转变（如角色面临重大抉择导致价值维度跨越中线），拉升叙事张力`,
      execution_mode: 'rewrite_plan',
      impact_estimate: {
        metric: '价值曲线密度',
        delta: '+15%',
        chapters: [],
        risk: 'medium',
      },
      priority: 75,
      execution_prompt: `【Story Action · 价值转变补强】
问题：${range.suggestion}
建议：在该区间设计一次跨越价值中线的转变事件（如从"安全"到"危险"、从"希望"到"绝望"），让读者感受到叙事推进。
请先 Read 相关章节正文，给出 3 条可执行改稿要点，再按作者确认执行。`,
    });
  }

  return actions;
}
