import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';
import { loadKnowledgeBundle } from '../story-kb/store.js';
import { manuscriptDirForMode } from '../projectProfile.js';

const AI_PHRASES = [
  '不禁', '嘴角微微上扬', '心头一紧', '瞳孔微缩', '目光深邃',
  '仿佛', '宛如', '与此同时', '总而言之', '毋庸置疑',
  '缓缓说道', '淡淡一笑', '眼中闪过一丝', '嘴角勾起一抹',
  '心中暗想', '不由自主', '恍然大悟', '若有所思',
  '波澜不惊', '意味深长', '不言而喻', '一抹不易察觉',
  '微微颔首', '轻叹一声', '暗暗下定决心', '心中五味杂陈',
  '嘴角微微上扬', '眼眸中闪过', '一字一顿地说道',
  '空气中弥漫着', '气氛骤然凝重', '时间仿佛静止',
  '掷地有声', '义正言辞', '斩钉截铁', '语重心长',
];

const DIMENSIONS = [
  '人物塑造',
  '剧情推进',
  '节奏控制',
  '对白质量',
  '情绪张力',
  '设定一致性',
];

function scoreDimension(text, dim) {
  const len = text.length;
  let score = 72;
  const aiHits = AI_PHRASES.filter((p) => text.includes(p)).length;
  score -= aiHits * 4;

  if (dim === '节奏控制') {
    const paras = text.split(/\n\n+/).length;
    if (paras < 3) score -= 10;
    if (paras > 40) score -= 5;
  }
  if (dim === '对白质量') {
    const quotes = (text.match(/[「」""]/g) || []).length;
    if (quotes < 4) score -= 8;
  }
  if (dim === '剧情推进' && len < 800) score -= 15;

  // 人物塑造：检测对话密度、动作描写、称谓多样性
  if (dim === '人物塑造') {
    const dialogueLines = (text.match(/[「」"""].*?[「」"""]/g) || []).length;
    const dialogueDensity = len > 0 ? dialogueLines / (len / 1000) : 0;
    if (dialogueDensity < 1) score -= 6; // 对话太少，人物不立体
    const actionVerbs = ['走', '拿', '看', '站', '跑', '坐', '笑', '哭', '叫', '怒',
      '拿', '递', '推', '拉', '挥', '拍', '点', '摇', '转', '抱'];
    const actionHits = actionVerbs.filter((v) => text.includes(v)).length;
    if (actionHits < 3) score -= 5; // 动作描写不足
    const honorifics = ['先生', '小姐', '老师', '哥', '姐', '爸', '妈', '叔', '婶'];
    const honorificHits = honorifics.filter((h) => text.includes(h)).length;
    if (honorificHits >= 3) score += 3; // 称谓多样说明人物关系丰富
  }

  // 情绪张力：检测情绪词汇密度和对话中的情绪表达
  if (dim === '情绪张力') {
    const emotionWords = ['愤怒', '悲伤', '开心', '恐惧', '惊讶', '厌恶', '焦虑',
      '泪', '哭', '笑', '怒', '怕', '惊', '恨', '爱', '痛',
      'angry', 'sad', 'happy', 'fear', 'surprise', 'cry', 'laugh', 'rage', 'love'];
    const emotionHits = emotionWords.filter((w) => text.toLowerCase().includes(w)).length;
    if (emotionHits < 3) score -= 8; // 情绪表达不足
    else if (emotionHits >= 6) score += 4; // 情绪丰富
    const exclamationCount = (text.match(/[!！]/g) || []).length;
    if (exclamationCount > 2 && exclamationCount < 20) score += 2; // 适度感叹增强张力
  }

  // 设定一致性：检测世界观关键词连续性和专有名词一致性
  if (dim === '设定一致性') {
    // 检查是否有同一专有名词出现拼写不一致的情况
    const properNouns = text.match(/[一-鿿]{2,4}(?:族|国|城|门|派|教|帮|会|殿|山|岛|河|湖)/g) || [];
    const nounSet = new Set(properNouns);
    if (nounSet.size > 0) {
      const uniqueRatio = nounSet.size / (properNouns.length || 1);
      if (uniqueRatio < 0.3) score += 3; // 重复使用设定词说明一致性好
    }
    // 章节太短可能设定交代不清
    if (len < 600) score -= 6;
    // 检查是否有时间/地点描写的锚定
    const timeAnchors = ['早上', '中午', '下午', '傍晚', '晚上', '凌晨', '深夜',
      '第二天', '次日', '几天后', '一年后', '清晨', '黄昏',
      'morning', 'noon', 'evening', 'night', 'dawn'];
    const timeHits = timeAnchors.filter((t) => text.includes(t)).length;
    if (timeHits >= 2) score += 3; // 有时间锚定增加设定一致性
  }

  if (len > 500) score += 3;
  return Math.max(40, Math.min(95, Math.round(score)));
}

export function scoreChapter(projectId, filename) {
  const ws = storage.workspacePath(projectId);
  const meta = storage.getProject(projectId);
  const primaryDir = manuscriptDirForMode(meta.creation_mode || 'scratch');
  const safe = path.basename(filename);

  let fp = path.join(ws, primaryDir, safe);
  if (!fs.existsSync(fp)) {
    for (const sub of ['正文', '试验稿']) {
      const alt = path.join(ws, sub, safe);
      if (fs.existsSync(alt)) {
        fp = alt;
        break;
      }
    }
  }
  if (!fs.existsSync(fp)) throw new Error('章节不存在');
  const text = decodeBuffer(fs.readFileSync(fp));
  const kb = loadKnowledgeBundle(projectId);

  const dimensions = DIMENSIONS.map((name) => ({
    name,
    score: scoreDimension(text, name),
    note: '',
  }));

  const overall = Math.round(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  );

  const foreshadowTotal = kb.foreshadows?.items?.length || 0;
  const foreshadowOpen = (kb.foreshadows?.items || []).filter(
    (f) => f.status !== 'resolved',
  ).length;

  return {
    filename,
    scoring_method: 'heuristic',
    overall,
    dimensions,
    foreshadow_recovery_rate: foreshadowTotal
      ? Math.round(((foreshadowTotal - foreshadowOpen) / foreshadowTotal) * 100)
      : null,
    character_count: kb.characters?.items?.length || 0,
    word_count: text.length,
    reviewed_at: new Date().toISOString(),
  };
}

export function scoreProjectHealth(projectId) {
  const chapters = storage.listChapters(projectId);
  const scores = [];
  for (const ch of chapters.slice(-12)) {
    try {
      scores.push(scoreChapter(projectId, ch.filename));
    } catch (e) {
      console.error(`[quality] 评分章节 ${ch.filename} 失败:`, e.message);
    }
  }

  const overall = scores.length
    ? Math.round(scores.reduce((s, c) => s + c.overall, 0) / scores.length)
    : null;

  const kb = loadKnowledgeBundle(projectId);

  return {
    project_id: projectId,
    scoring_method: 'heuristic',
    overall_health: overall,
    chapter_scores: scores,
    kb_stats: {
      characters: kb.characters?.items?.length || 0,
      relationships: kb.relationships?.items?.length || 0,
      foreshadows: kb.foreshadows?.items?.length || 0,
      timeline_events: kb.timeline?.events?.length || 0,
    },
    generated_at: new Date().toISOString(),
  };
}

export function writeChapterReviewMd(projectId, filename) {
  const score = scoreChapter(projectId, filename);
  const ws = storage.workspacePath(projectId);
  const reviewDir = path.join(ws, '.webnovel', 'reviews');
  fs.mkdirSync(reviewDir, { recursive: true });
  const base = filename.replace(/\.md$/, '');
  const lines = [
    `# 章节质量报告 · ${base}`,
    '',
    `综合评分：**${score.overall}**`,
    `字数：${score.word_count}`,
    '',
    '## 维度评分',
    ...score.dimensions.map((d) => `- ${d.name}：${d.score}`),
    '',
    `生成时间：${score.reviewed_at}`,
  ];
  const fp = path.join(reviewDir, `${base}-review.md`);
  fs.writeFileSync(fp, lines.join('\n'), 'utf-8');
  return { path: fp, score };
}
