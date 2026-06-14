import { randomUUID } from 'crypto';
import { countNameMentions } from '../story-kb/scan-sources.js';
import { listCharacters } from '../story-kb/entity-resolver.js';

// ---------------------------------------------------------------------------
// 六阶段弧光模型常量
// ---------------------------------------------------------------------------

const ARC_STAGES = [
  { index: 0, name: '谎言', name_en: 'lie', description: 'Character believes a lie' },
  { index: 1, name: '欲望', name_en: 'want', description: 'Character pursues a want' },
  { index: 2, name: '冲突', name_en: 'friction', description: 'Want vs Need creates friction' },
  { index: 3, name: '危机', name_en: 'crisis', description: 'Character faces the truth' },
  { index: 4, name: '高潮抉择', name_en: 'climax', description: 'Character chooses: accept truth or reject it' },
  { index: 5, name: '新平衡', name_en: 'equilibrium', description: 'Character transforms or remains unchanged' },
];

const ARC_TYPES = ['positive', 'negative', 'flat', 'corruption', 'mixed'];

// 弧光阶段转换的事件类型
const ARC_EVENT_TYPES = [
  'arc_stage_changed',
  'lie_challenged',
  'truth_discovered',
  'fatal_flaw_revealed',
  'want_expressed',
  'need_recognized',
  'climax_choice',
];

// 数据源置信度权重
const SOURCE_WEIGHTS = {
  character_notes: 0.9,
  story_events: 0.7,
  heuristic: 0.5,
  mention_pattern: 0.4,
};

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function pickFemaleLead(projectId, characters) {
  const resolved = projectId ? listCharacters(projectId) : [];
  const items = resolved.length
    ? resolved.map((r) => ({ ...r.entity, id: r.canonicalId, name: r.canonicalName }))
    : (characters?.items || []);
  const byRole = items.find((c) => /女主|女一|女主角/.test(c.role || ''));
  if (byRole) return byRole;
  const byName = items.find((c) => /女/.test(c.name || '') && c.role !== 'antagonist');
  return byName || items.find((c) => c.role === 'protagonist') || items[0];
}

function pickProtagonist(projectId, characters) {
  const resolved = projectId ? listCharacters(projectId) : [];
  const items = resolved.length
    ? resolved.map((r) => ({ ...r.entity, id: r.canonicalId, name: r.canonicalName }))
    : (characters?.items || []);
  return items.find((c) => /男主|主角|protagonist/i.test(c.role || '')) || items[0];
}

/**
 * 从 character notes 中提取弧光核心要素
 */
function extractArcElements(char) {
  const notes = char.notes || {};
  const notesText = typeof notes === 'string' ? notes : JSON.stringify(notes);

  return {
    lie: notes.lie || notes.false_belief || extractFromText(notesText, ['谎言', '错误信念', '误解']) || null,
    want: notes.want || notes.desire || notes.goal || extractFromText(notesText, ['想要', '追求', '目标']) || null,
    need: notes.need || notes.requirement || extractFromText(notesText, ['需要', '必须', '真正']) || null,
    fatal_flaw: notes.fatal_flaw || notes.flaw || notes.weakness ||
      extractFromText(notesText, ['缺陷', '弱点', '致命', '致命伤']) || null,
  };
}

/**
 * 从文本中提取关键词附近的内容
 */
function extractFromText(text, keywords) {
  if (!text) return null;
  for (const kw of keywords) {
    const idx = text.indexOf(kw);
    if (idx >= 0) {
      // 提取关键词后的内容（最多 80 字符）
      const after = text.slice(idx + kw.length, idx + kw.length + 80).trim();
      const cleaned = after.replace(/^[：:，,。.\s]+/, '').trim();
      if (cleaned) return cleaned.split(/[。；;]/)[0].trim();
    }
  }
  return null;
}

/**
 * 从 story_events 中提取角色相关的弧光事件
 */
function extractArcEvents(storyEvents, characterName) {
  if (!Array.isArray(storyEvents)) return [];

  const arcEventTypes = new Set(ARC_EVENT_TYPES);
  return storyEvents
    .filter((event) => {
      // 匹配事件类型
      if (arcEventTypes.has(event.event_type)) {
        const subject = (event.subject || '').toLowerCase();
        const name = characterName.toLowerCase();
        return subject.includes(name) || name.includes(subject);
      }
      // 匹配 character_state_changed 中的重大变化
      if (event.event_type === 'character_state_changed') {
        const subject = (event.subject || '').toLowerCase();
        return subject.includes(characterName.toLowerCase());
      }
      return false;
    })
    .sort((a, b) => (a.chapter || 0) - (b.chapter || 0));
}

/**
 * 从 value_shift 事件中检测冲突阶段信号
 */
function detectFrictionFromValueShifts(storyEvents, characterName) {
  if (!Array.isArray(storyEvents)) return [];
  return storyEvents
    .filter((event) => {
      if (event.event_type !== 'value_shift_occurred') return false;
      const subject = (event.subject || '').toLowerCase();
      return subject.includes(characterName.toLowerCase());
    })
    .sort((a, b) => (a.chapter || 0) - (b.chapter || 0));
}

/**
 * 推断致命缺陷
 */
function inferFatalFlaw(char, arcElements, arcEvents) {
  // 优先使用已有字段
  if (arcElements.fatal_flaw) return arcElements.fatal_flaw;

  // 从 lie 推断
  if (arcElements.lie) {
    return `相信"${arcElements.lie}"`;
  }

  // 从角色描述推断常见缺陷模式
  const desc = (char.desc || char.notes || '').toString().toLowerCase();
  const flawPatterns = [
    { pattern: /傲慢|自负|自大/, flaw: '傲慢自负' },
    { pattern: /懦弱|胆怯|恐惧/, flaw: '懦弱胆怯' },
    { pattern: /贪婪|自私/, flaw: '贪婪自私' },
    { pattern: /嫉妒|妒忌/, flaw: '嫉妒心强' },
    { pattern: /固执|执拗/, flaw: '固执己见' },
    { pattern: /天真|单纯|幼稚/, flaw: '天真幼稚' },
    { pattern: /多疑|猜忌/, flaw: '多疑猜忌' },
    { pattern: /冲动|暴躁/, flaw: '冲动易怒' },
    { pattern: /冷漠|无情/, flaw: '冷漠无情' },
  ];

  for (const { pattern, flaw } of flawPatterns) {
    if (pattern.test(desc)) return flaw;
  }

  // 从弧光事件推断
  const lieEvents = arcEvents.filter((e) => e.event_type === 'lie_challenged');
  if (lieEvents.length > 0) {
    return lieEvents[0].payload?.lie || '待明确';
  }

  return null;
}

/**
 * 基于 6 阶段模型推断当前弧光阶段
 *
 * 信号优先级：
 * 1. 显式 arc_stage_changed 事件 -> 直接确定
 * 2. character_notes 中的 lie/want/need -> 推断早期阶段
 * 3. story_events 中的 lie_challenged / truth_discovered -> 推断中后期
 * 4. 启发式（mention pattern）-> 兜底
 */
function inferArcStage(char, arcElements, arcEvents, mentionCount, chapterCount) {
  let bestStage = { index: 0, confidence: SOURCE_WEIGHTS.heuristic, source: 'heuristic' };

  // 信号 1：显式 arc_stage_changed 事件
  const stageChangedEvents = arcEvents.filter((e) => e.event_type === 'arc_stage_changed');
  if (stageChangedEvents.length > 0) {
    const latest = stageChangedEvents[stageChangedEvents.length - 1];
    const targetStage = latest.payload?.to_stage ?? latest.payload?.stage_index;
    if (typeof targetStage === 'number' && targetStage >= 0 && targetStage <= 5) {
      bestStage = { index: targetStage, confidence: 1.0, source: 'story_events' };
    }
  }

  // 信号 2：truth_discovered -> 阶段 4 或 5
  if (bestStage.index < 4) {
    const truthEvents = arcEvents.filter((e) => e.event_type === 'truth_discovered');
    if (truthEvents.length > 0) {
      const candidate = { index: 4, confidence: SOURCE_WEIGHTS.story_events, source: 'story_events' };
      if (candidate.confidence > bestStage.confidence || candidate.index > bestStage.index) {
        bestStage = candidate;
      }
    }
  }

  // 信号 3：lie_challenged -> 阶段 3
  if (bestStage.index < 3) {
    const lieChallengedEvents = arcEvents.filter((e) => e.event_type === 'lie_challenged');
    if (lieChallengedEvents.length > 0) {
      const candidate = { index: 3, confidence: SOURCE_WEIGHTS.story_events, source: 'story_events' };
      if (candidate.confidence > bestStage.confidence || candidate.index > bestStage.index) {
        bestStage = candidate;
      }
    }
  }

  // 信号 4：value_shift 事件 -> 阶段 2（冲突）
  if (bestStage.index < 2) {
    const valueShifts = detectFrictionFromValueShifts([], char.name); // events passed separately
    if (valueShifts.length > 0) {
      const candidate = { index: 2, confidence: SOURCE_WEIGHTS.story_events * 0.8, source: 'story_events' };
      if (candidate.confidence > bestStage.confidence) {
        bestStage = candidate;
      }
    }
  }

  // 信号 5：character_notes 中的要素
  if (arcElements.need && bestStage.index < 3) {
    const candidate = { index: 2, confidence: SOURCE_WEIGHTS.character_notes, source: 'character_notes' };
    if (candidate.confidence > bestStage.confidence) {
      bestStage = candidate;
    }
  }
  if (arcElements.want && bestStage.index < 2) {
    const candidate = { index: 1, confidence: SOURCE_WEIGHTS.character_notes, source: 'character_notes' };
    if (candidate.confidence > bestStage.confidence) {
      bestStage = candidate;
    }
  }
  if (arcElements.lie && bestStage.index < 1) {
    const candidate = { index: 0, confidence: SOURCE_WEIGHTS.character_notes, source: 'character_notes' };
    if (candidate.confidence > bestStage.confidence) {
      bestStage = candidate;
    }
  }

  // 信号 6：启发式（mention pattern）作为兜底
  if (bestStage.source === 'heuristic' && chapterCount >= 5) {
    const ratio = mentionCount / Math.max(chapterCount, 1);
    if (ratio >= 4) bestStage.index = 4;
    else if (ratio >= 2) bestStage.index = 3;
    else if (ratio >= 0.8) bestStage.index = 2;
    else bestStage.index = 1;
  }

  return bestStage;
}

/**
 * 推断弧光类型
 */
function inferArcType(arcElements, arcEvents, stageIndex) {
  // 检查是否有明确的弧光类型标记
  const stageChangedEvents = arcEvents.filter((e) => e.event_type === 'arc_stage_changed');
  for (const event of stageChangedEvents) {
    if (event.payload?.arc_type && ARC_TYPES.includes(event.payload.arc_type)) {
      return event.payload.arc_type;
    }
  }

  // 基于当前阶段和要素推断
  if (stageIndex >= 4) {
    const truthEvents = arcEvents.filter((e) => e.event_type === 'truth_discovered');
    if (truthEvents.length > 0) return 'positive';
    const lieEvents = arcEvents.filter((e) => e.event_type === 'lie_challenged');
    if (lieEvents.length > 0) return 'negative';
  }

  // 默认为正向弧光
  return 'positive';
}

/**
 * 构建阶段状态数组
 */
function buildStageStates(stageIndex, arcEvents) {
  return ARC_STAGES.map((stage) => {
    let status = 'pending';
    if (stage.index < stageIndex) status = 'completed';
    else if (stage.index === stageIndex) status = 'active';

    // 从事件中提取进入/完成章节
    const enterEvent = arcEvents.find(
      (e) => e.event_type === 'arc_stage_changed' && e.payload?.to_stage === stage.index
    );
    const completeEvent = arcEvents.find(
      (e) => e.event_type === 'arc_stage_changed' && e.payload?.from_stage === stage.index
    );

    return {
      index: stage.index,
      name: stage.name,
      status,
      chapter_entered: enterEvent?.chapter || null,
      chapter_completed: completeEvent?.chapter || null,
      evidence: arcEvents
        .filter((e) => {
          const payload = e.payload || {};
          return payload.stage === stage.index || payload.to_stage === stage.index;
        })
        .map((e) => e.event_id)
        .slice(0, 5),
    };
  });
}

/**
 * 构建弧光时间线
 */
function buildArcTimeline(arcEvents, stageIndex) {
  const timeline = [];

  for (const event of arcEvents) {
    timeline.push({
      chapter: event.chapter || 0,
      event_type: event.event_type,
      description: event.payload?.description || event.payload?.summary || `${event.event_type} 事件`,
      story_event_id: event.event_id || null,
    });
  }

  // 补充基于阶段推断的里程碑
  const milestones = [
    { stage: 0, type: 'arc_stage_changed', desc: '角色处于谎言阶段' },
    { stage: 1, type: 'want_expressed', desc: '角色表达外在欲望' },
    { stage: 2, type: 'need_recognized', desc: '欲望与需求产生冲突' },
    { stage: 3, type: 'lie_challenged', desc: '谎言被挑战' },
    { stage: 4, type: 'climax_choice', desc: '高潮抉择' },
    { stage: 5, type: 'truth_discovered', desc: '新平衡达成' },
  ];

  for (const ms of milestones) {
    if (ms.stage <= stageIndex) {
      const existing = timeline.find((t) => t.event_type === ms.type);
      if (!existing) {
        timeline.push({
          chapter: 0,
          event_type: ms.type,
          description: ms.desc,
          story_event_id: null,
        });
      }
    }
  }

  return timeline.sort((a, b) => a.chapter - b.chapter);
}

/**
 * 计算置信度
 */
function calculateConfidence(source, evidenceCount, chapterCount) {
  const baseConfidence = SOURCE_WEIGHTS[source] || SOURCE_WEIGHTS.heuristic;
  const evidenceBoost = Math.min(evidenceCount * 0.05, 0.2);
  const recencyFactor = chapterCount > 10 ? 1.0 : chapterCount / 10;

  return Math.min(1.0, (baseConfidence + evidenceBoost) * recencyFactor);
}

// ---------------------------------------------------------------------------
// 主分析函数
// ---------------------------------------------------------------------------

/**
 * 角色弧光分析（基于 6 阶段理论模型）
 *
 * 替代原有基于 mention count 的启发式方法，
 * 从 knowledge bundle 的 character notes 中提取 lie/want/need，
 * 从 story_events 中追踪角色状态变化作为弧光阶段转换信号。
 */
export function analyzeArcs({ kb, manifest, projectId = '', storyEvents = [] }) {
  const items = [];
  const chapters = manifest.chapters || [];
  const chapterCount = manifest.chapters_total || chapters.length;

  const targets = [
    { char: pickFemaleLead(projectId, kb.characters), label: '女主' },
    { char: pickProtagonist(projectId, kb.characters), label: '主角' },
  ].filter((t) => t.char?.name);

  const seen = new Set();
  for (const { char, label } of targets) {
    if (seen.has(char.name)) continue;
    seen.add(char.name);

    // 提取弧光核心要素
    const arcElements = extractArcElements(char);

    // 从 story_events 提取角色相关弧光事件
    const arcEvents = extractArcEvents(storyEvents, char.name);

    // 推断致命缺陷
    const fatalFlaw = inferFatalFlaw(char, arcElements, arcEvents);

    // 计算 mention count（用于启发式兜底）
    const mentions = countNameMentions(chapters, char.name);

    // 推断当前弧光阶段
    const stageResult = inferArcStage(char, arcElements, arcEvents, mentions, chapters.length || chapterCount);

    // 推断弧光类型
    const arcType = inferArcType(arcElements, arcEvents, stageResult.index);

    // 构建阶段状态
    const stages = buildStageStates(stageResult.index, arcEvents);

    // 构建时间线
    const timeline = buildArcTimeline(arcEvents, stageResult.index);

    // 计算置信度
    const confidence = calculateConfidence(
      stageResult.source,
      arcEvents.length,
      chapters.length || chapterCount
    );

    // 构建断点/风险提示
    const breakpoints = [];
    if (stageResult.index <= 1 && chapterCount >= 5) {
      breakpoints.push({
        chapter: `约第${Math.max(3, Math.floor(chapterCount * 0.6))}章`,
        issue: `${label}弧光推进停滞，缺少从「${ARC_STAGES[stageResult.index].name}」到下一阶段的触发事件`,
        severity: chapterCount >= 15 ? 'high' : 'medium',
      });
    }
    if (!arcElements.lie && stageResult.index === 0) {
      breakpoints.push({
        chapter: '当前',
        issue: `${label}的「谎言」（核心错误信念）尚未定义，弧光缺少根基`,
        severity: 'high',
      });
    }
    if (!arcElements.want && stageResult.index <= 1) {
      breakpoints.push({
        chapter: '当前',
        issue: `${label}的「欲望」（外在目标）尚未明确，弧光缺少驱动力`,
        severity: 'medium',
      });
    }

    // 风险评估
    const risk = breakpoints.length
      ? breakpoints.some((bp) => bp.severity === 'high') ? '高风险' : '待加强'
      : stageResult.index >= 4 ? '弧光完成' : '平稳推进';
    const riskLevel = breakpoints.some((bp) => bp.severity === 'high')
      ? 'high'
      : breakpoints.length > 0
        ? 'medium'
        : 'low';

    const stableId = char.id || char.name;
    const currentStage = ARC_STAGES[stageResult.index];

    items.push({
      id: `arc_${stableId}`,
      character_id: stableId,
      name: char.name,
      label,

      // 弧光核心要素
      fatal_flaw: fatalFlaw,
      arc_type: arcType,
      lie: arcElements.lie,
      want: arcElements.want,
      need: arcElements.need,

      // 阶段状态
      current_stage: currentStage.name,
      current_stage_en: currentStage.name_en,
      stage_index: stageResult.index,
      stage_total: ARC_STAGES.length,
      stages,

      // 时间线
      timeline,

      // 元数据
      emotion: stageResult.index <= 1 ? '压抑' : stageResult.index <= 3 ? '挣扎' : '升华',
      risk,
      risk_level: riskLevel,
      breakpoints,
      evidence_chapters: chapters.slice(-3).map((c) => c.filename),
      confidence: Math.round(confidence * 100) / 100,
      source: stageResult.source,

      // 兼容旧字段
      goal: arcElements.want || char.notes?.slice(0, 40) || kb.story_summary?.logline?.slice(0, 40) || '待明确',
      growth_arc: arcType,
    });
  }

  return { items };
}

// ---------------------------------------------------------------------------
// 辅助导出函数
// ---------------------------------------------------------------------------

export function findArcForMessage(arcs, message) {
  const msg = String(message || '');
  const items = arcs?.items || [];
  if (/女主|女一|女主角/.test(msg)) {
    return items.find((a) => a.label === '女主') || items[0];
  }
  if (/男主|主角/.test(msg)) {
    return items.find((a) => a.label === '主角') || items[0];
  }
  if (/成长|弧光|转变/.test(msg)) return items.find((a) => a.breakpoints?.length) || items[0];
  if (/谎言|错误信念/.test(msg)) return items.find((a) => a.lie) || items[0];
  if (/缺陷|弱点/.test(msg)) return items.find((a) => a.fatal_flaw) || items[0];
  return items[0];
}

export function buildArcAction(arc) {
  if (!arc) return null;

  const bp = arc.breakpoints?.[0];
  const nextStageIndex = Math.min(arc.stage_index + 1, ARC_STAGES.length - 1);
  const nextStage = ARC_STAGES[nextStageIndex];
  const chapterHint = bp?.chapter || '后续 2–3 章';

  // 根据当前阶段生成不同的行动建议
  const stageActions = {
    0: {
      title: `${arc.name}弧光：定义「谎言」`,
      proposal: `在${chapterHint}通过角色内心独白或他人反馈，明确${arc.name}相信的核心错误信念`,
    },
    1: {
      title: `${arc.name}弧光：明确「欲望」`,
      proposal: `在${chapterHint}让${arc.name}明确表达外在目标，这个目标应是谎言的延伸`,
    },
    2: {
      title: `${arc.name}弧光：激化「冲突」`,
      proposal: `在${chapterHint}设计一个场景，让${arc.name}的外在追求与内在需求产生直接冲突`,
    },
    3: {
      title: `${arc.name}弧光：面对「危机」`,
      proposal: `在${chapterHint}让${arc.name}直面谎言的虚假性，经历故事最低点`,
    },
    4: {
      title: `${arc.name}弧光：「高潮抉择」`,
      proposal: `在${chapterHint}设计高潮场景，让${arc.name}做出决定性选择：接受或拒绝真相`,
    },
    5: {
      title: `${arc.name}弧光：建立「新平衡」`,
      proposal: `在${chapterHint}展示${arc.name}在新世界观下的行为模式变化`,
    },
  };

  const action = stageActions[arc.stage_index] || stageActions[0];

  return {
    id: `act_arc_${randomUUID().slice(0, 8)}`,
    type: 'arc_enhance',
    source: 'character_arcs',
    source_id: arc.id,
    title: action.title,
    diagnosis: bp?.issue || `${arc.name}当前处于「${arc.current_stage}」，弧光推进偏慢`,
    proposal: action.proposal,
    execution_mode: 'rewrite_plan',
    impact_estimate: {
      metric: '弧光完整度',
      delta: '+15%',
      chapters: arc.evidence_chapters?.slice(0, 2) || [],
      risk: 'medium',
    },
    priority: arc.risk_level === 'high' ? 90 : arc.risk_level === 'medium' ? 78 : 65,
    execution_prompt: `【Story Action · 角色弧光增强】
角色：${arc.name}
弧光类型：${arc.arc_type}
当前阶段：${arc.current_stage}（第 ${arc.stage_index + 1}/${ARC_STAGES.length} 阶段）
谎言：${arc.lie || '待定义'}
欲望：${arc.want || '待定义'}
需求：${arc.need || '待定义'}
致命缺陷：${arc.fatal_flaw || '待推断'}
问题：${bp?.issue || arc.risk}
建议：${action.proposal}
请先 Read 相关章节与 knowledge/ 人物设定，确认弧光阶段判断后，输出改稿要点。`,
  };
}
