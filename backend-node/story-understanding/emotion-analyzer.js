/**
 * 情感曲线分析器
 *
 * 从章节 summary 推断逐章情感状态，检测情感疲劳区间，
 * 生成 emotion_curve 数据供前端可视化使用。
 *
 * 基于 emotion-psychology.md 九、情感曲线数据模型。
 */

// ── 情绪类型关键词映射（4 级分级） ──

const EMOTION_KEYWORDS = {
  愤怒: {
    1: ['不悦', '不满', '不爽', '微微恼怒'],
    2: ['愤怒', '恼火', '气愤', '怒意', '不忿'],
    3: ['暴怒', '怒火中烧', '咬牙切齿', '怒不可遏', '愤恨'],
    4: ['怒吼', '嘶吼', '杀意', '发誓', '血海深仇', '必灭'],
  },
  悲伤: {
    1: ['惆怅', '失落', '叹息', '黯然'],
    2: ['悲伤', '难过', '心酸', '哀伤', '落泪'],
    3: ['悲痛', '痛哭', '撕心裂肺', '泣不成声', '哀恸'],
    4: ['绝望', '崩溃', '肝肠寸断', '万念俱灰', '心如死灰'],
  },
  恐惧: {
    1: ['不安', '紧张', '忐忑', '隐隐担心'],
    2: ['恐惧', '害怕', '惊恐', '畏惧', '心惊'],
    3: ['惊骇', '毛骨悚然', '不寒而栗', '胆寒', '恐惧万分'],
    4: ['魂飞魄散', '吓破胆', '绝望恐惧', '瘫软在地'],
  },
  喜悦: {
    1: ['微笑', '满意', '舒心', '淡淡笑意'],
    2: ['开心', '高兴', '喜悦', '欣喜', '愉快'],
    3: ['狂喜', '兴奋', '激动', '欣喜若狂', '喜极而泣'],
    4: ['狂喜', '激动万分', '热泪盈眶', '不能自已'],
  },
  惊讶: {
    1: ['意外', '诧异', '微微一愣'],
    2: ['惊讶', '吃惊', '震惊', '愕然', '不敢相信'],
    3: ['大惊', '惊骇', '瞠目结舌', '目瞪口呆'],
    4: ['难以置信', '骇然', '颠覆认知', '世界观崩塌'],
  },
  期待: {
    1: ['好奇', '关注', '留意'],
    2: ['期待', '盼望', '渴望', '向往'],
    3: ['迫不及待', '翘首以盼', '殷切期望'],
    4: ['渴望至极', '望眼欲穿', '梦寐以求'],
  },
  绝望: {
    1: ['无奈', '无力', '叹气'],
    2: ['绝望', '无助', '走投无路', '心灰意冷'],
    3: ['万念俱灰', '生无可恋', '彻底绝望', '放弃'],
    4: ['心如死灰', '行尸走肉', '了无生趣'],
  },
  释然: {
    1: ['平静', '淡然', '坦然'],
    2: ['释然', '放下', '解脱', '如释重负'],
    3: ['彻底释然', '豁然开朗', '幡然醒悟'],
    4: ['大彻大悟', '涅槃重生', '脱胎换骨'],
  },
  紧张: {
    1: ['在意', '警觉', '留意'],
    2: ['紧张', '戒备', '提防', '紧绷'],
    3: ['高度紧张', '剑拔弩张', '一触即发', '如临大敌'],
    4: ['千钧一发', '命悬一线', '生死关头'],
  },
  厌恶: {
    1: ['嫌弃', '反感', '不适'],
    2: ['厌恶', '鄙夷', '不屑', '恶心'],
    3: ['深恶痛绝', '恨之入骨', '咬牙切齿'],
    4: ['不共戴天', '誓不两立', '你死我活'],
  },
};

// ── 价值转变关键词 ──

const VALUE_SHIFT_PATTERNS = [
  { pattern: /认清|看透|发现.*真相|明白|恍然大悟/, direction: 'neutral', label: '认知转变' },
  { pattern: /背叛|欺骗|出卖|利用/, direction: 'negative', label: '信任崩塌' },
  { pattern: /复仇|报复|报仇|以牙还牙/, direction: 'negative', label: '走向复仇' },
  { pattern: /原谅|释怀|和解|接纳|放下/, direction: 'positive', label: '和解脱' },
  { pattern: /希望|觉醒|决心|振作|重新/, direction: 'positive', label: '重燃希望' },
  { pattern: /黑化|堕落|走火入魔|执念/, direction: 'negative', label: '走向黑暗' },
  { pattern: /牺牲|奉献|守护|保护/, direction: 'positive', label: '觉悟升华' },
];

/**
 * 从文本推断情绪强度
 * @param {string} text - 章节摘要或正文片段
 * @param {string} emotionType - 情绪类型
 * @returns {number} 强度 1-4，0 表示未检测到
 */
function inferIntensity(text, emotionType) {
  const levels = EMOTION_KEYWORDS[emotionType];
  if (!levels) return 0;

  // 从高到低扫描，命中即返回
  for (let level = 4; level >= 1; level--) {
    for (const kw of levels[level]) {
      if (text.includes(kw)) return level;
    }
  }
  return 0;
}

/**
 * 从文本推断所有情绪
 * @param {string} text - 章节摘要文本
 * @returns {Array<{ type: string, intensity: number }>}
 */
function detectEmotions(text) {
  const results = [];
  for (const type of Object.keys(EMOTION_KEYWORDS)) {
    const intensity = inferIntensity(text, type);
    if (intensity > 0) {
      results.push({ type, intensity });
    }
  }
  // 按强度降序排列
  results.sort((a, b) => b.intensity - a.intensity);
  return results;
}

/**
 * 检测价值转变
 * @param {string} text - 章节摘要
 * @param {number} chapter - 章节号
 * @returns {object|null}
 */
function detectValueShift(text, chapter) {
  for (const { pattern, direction, label } of VALUE_SHIFT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        direction,
        label,
        chapter,
        trigger: text.slice(0, 60),
      };
    }
  }
  return null;
}

/**
 * 分析单章情感
 * @param {object} chapter - { filename, text, number?, summary? }
 * @param {number} index - 在 chapters 数组中的索引
 * @param {number} total - 总章节数
 * @returns {object} 章节情感标注
 */
function analyzeChapter(chapter, index, total) {
  const text = chapter.summary || chapter.text || '';
  const chapterNum = chapter.number || (total - (total - index)) + 1;

  const emotions = detectEmotions(text);
  const maxIntensity = emotions.length ? emotions[0].intensity : 1;
  const dominantEmotion = emotions.length ? emotions[0].type : '平静';
  const valueShift = detectValueShift(text, chapterNum);

  return {
    chapter: chapterNum,
    filename: chapter.filename || `第${String(chapterNum).padStart(4, '0')}章`,
    emotions: emotions.slice(0, 3), // 最多记录 3 种情绪
    dominant_emotion: dominantEmotion,
    max_intensity: maxIntensity,
    value_shift: valueShift,
  };
}

/**
 * 检测情感疲劳区间
 * @param {Array} curveData - 逐章情感标注数组
 * @returns {Array<{ ruleId, name, severity, from, to, detail }>}
 */
function detectFatigue(curveData) {
  const warnings = [];

  if (curveData.length < 3) return warnings;

  // FATIGUE_01: 连续 3+ 章高强度 (>=3)
  for (let i = 0; i <= curveData.length - 3; i++) {
    let run = 0;
    while (i + run < curveData.length && curveData[i + run].max_intensity >= 3) {
      run++;
    }
    if (run >= 3) {
      warnings.push({
        ruleId: 'FATIGUE_01',
        name: '连续高强度',
        severity: 'high',
        from: curveData[i].chapter,
        to: curveData[i + run - 1].chapter,
        detail: `连续 ${run} 章情感强度 >= 3，读者可能产生疲劳`,
      });
      i += run - 1; // skip ahead
    }
  }

  // FATIGUE_02: 连续 5+ 章低强度 (<=1)
  for (let i = 0; i <= curveData.length - 5; i++) {
    let run = 0;
    while (i + run < curveData.length && curveData[i + run].max_intensity <= 1) {
      run++;
    }
    if (run >= 5) {
      warnings.push({
        ruleId: 'FATIGUE_02',
        name: '连续低强度',
        severity: 'medium',
        from: curveData[i].chapter,
        to: curveData[i + run - 1].chapter,
        detail: `连续 ${run} 章情感强度 <= 1，节奏偏平缓`,
      });
      i += run - 1;
    }
  }

  // FATIGUE_03: 连续 4+ 章同一主导情绪
  for (let i = 0; i <= curveData.length - 4; i++) {
    const emotion = curveData[i].dominant_emotion;
    let run = 0;
    while (i + run < curveData.length && curveData[i + run].dominant_emotion === emotion) {
      run++;
    }
    if (run >= 4) {
      warnings.push({
        ruleId: 'FATIGUE_03',
        name: '情绪单一',
        severity: 'high',
        from: curveData[i].chapter,
        to: curveData[i + run - 1].chapter,
        detail: `连续 ${run} 章主导情绪均为「${emotion}」，情绪过于单调`,
      });
      i += run - 1;
    }
  }

  // FATIGUE_04: 10 章内无价值转变
  const shiftChapters = curveData
    .filter((d) => d.value_shift)
    .map((d) => d.chapter);

  if (curveData.length >= 10) {
    const windowSize = 10;
    for (let i = 0; i <= curveData.length - windowSize; i++) {
      const windowStart = curveData[i].chapter;
      const windowEnd = curveData[i + windowSize - 1].chapter;
      const hasShift = shiftChapters.some((ch) => ch >= windowStart && ch <= windowEnd);
      if (!hasShift) {
        warnings.push({
          ruleId: 'FATIGUE_04',
          name: '缺少转折',
          severity: 'medium',
          from: windowStart,
          to: windowEnd,
          detail: `第 ${windowStart}-${windowEnd} 章无价值转变，角色成长可能停滞`,
        });
        break; // 只报一次
      }
    }
  }

  // FATIGUE_05: 5 章内出现 3+ 次 4 级爆发
  for (let i = 0; i <= curveData.length - 5; i++) {
    const window = curveData.slice(i, i + 5);
    const burstCount = window.filter((d) => d.max_intensity >= 4).length;
    if (burstCount >= 3) {
      warnings.push({
        ruleId: 'FATIGUE_05',
        name: '高频爆发',
        severity: 'high',
        from: window[0].chapter,
        to: window[4].chapter,
        detail: `5 章内出现 ${burstCount} 次 4 级情感爆发，过度刺激`,
      });
    }
  }

  return warnings;
}

/**
 * 生成摘要统计
 * @param {Array} curveData - 逐章情感标注
 * @returns {object}
 */
function buildCurveSummary(curveData) {
  if (!curveData.length) {
    return { avg_intensity: 0, emotion_distribution: {}, value_shifts: 0, chapter_count: 0 };
  }

  const totalIntensity = curveData.reduce((sum, d) => sum + d.max_intensity, 0);
  const distribution = {};
  for (const d of curveData) {
    distribution[d.dominant_emotion] = (distribution[d.dominant_emotion] || 0) + 1;
  }
  const valueShifts = curveData.filter((d) => d.value_shift).length;

  return {
    avg_intensity: Math.round((totalIntensity / curveData.length) * 100) / 100,
    emotion_distribution: distribution,
    value_shifts: valueShifts,
    chapter_count: curveData.length,
    peak_intensity: Math.max(...curveData.map((d) => d.max_intensity)),
    lowest_intensity: Math.min(...curveData.map((d) => d.max_intensity)),
  };
}

/**
 * 主分析函数
 * @param {object} params
 * @param {object} params.kb - 知识库 bundle
 * @param {object} params.manifest - 章节扫描结果
 * @param {Array}  params.storyEvents - 可选的故事事件列表
 * @returns {object} emotion_curve 数据
 */
export function analyzeEmotions({ kb, manifest, storyEvents = [] }) {
  const chapters = manifest.chapters || [];
  const total = manifest.chapters_total || chapters.length;

  if (total === 0) {
    return {
      version: 1,
      schema: 'emotion_curve',
      updated_at: new Date().toISOString(),
      source: 'emotion_analyzer',
      curve: [],
      fatigue_warnings: [],
      summary: buildCurveSummary([]),
    };
  }

  // 逐章分析
  const curve = chapters.map((ch, i) => analyzeChapter(ch, i, total));

  // 如果有 storyEvents，尝试补充信息
  if (storyEvents.length > 0) {
    for (const event of storyEvents) {
      const chapterIdx = (event.chapter || 1) - 1;
      if (chapterIdx >= 0 && chapterIdx < curve.length) {
        const entry = curve[chapterIdx];
        // 如果事件中有更高级别的情绪，更新
        if (event.emotion && event.intensity) {
          const existing = entry.emotions.find((e) => e.type === event.emotion);
          if (existing) {
            existing.intensity = Math.max(existing.intensity, event.intensity);
          } else {
            entry.emotions.push({ type: event.emotion, intensity: event.intensity });
          }
          if (event.intensity > entry.max_intensity) {
            entry.max_intensity = event.intensity;
            entry.dominant_emotion = event.emotion;
          }
        }
      }
    }
  }

  // 重新排序情绪并更新
  for (const entry of curve) {
    entry.emotions.sort((a, b) => b.intensity - a.intensity);
    if (entry.emotions.length) {
      entry.max_intensity = entry.emotions[0].intensity;
      entry.dominant_emotion = entry.emotions[0].type;
    }
  }

  // 检测情感疲劳
  const fatigueWarnings = detectFatigue(curve);

  // 构建摘要
  const summary = buildCurveSummary(curve);

  return {
    version: 1,
    schema: 'emotion_curve',
    updated_at: new Date().toISOString(),
    source: 'emotion_analyzer',
    curve,
    fatigue_warnings: fatigueWarnings,
    summary,
  };
}

/**
 * 获取当前情感曲线（从 understanding 存储读取，若无则为空）
 */
export function emptyEmotionCurve() {
  return {
    version: 1,
    schema: 'emotion_curve',
    updated_at: null,
    source: null,
    curve: [],
    fatigue_warnings: [],
    summary: {
      avg_intensity: 0,
      emotion_distribution: {},
      value_shifts: 0,
      chapter_count: 0,
      peak_intensity: 0,
      lowest_intensity: 0,
    },
  };
}
