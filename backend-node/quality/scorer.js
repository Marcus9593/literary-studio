import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';
import { loadKnowledgeBundle } from '../story-kb/store.js';
import { manuscriptDirForMode } from '../projectProfile.js';

const AI_PHRASES = [
  '不禁', '嘴角微微上扬', '心头一紧', '瞳孔微缩', '目光深邃',
  '仿佛', '宛如', '与此同时', '总而言之', '毋庸置疑',
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
    } catch {}
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
