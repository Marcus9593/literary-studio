import fs from 'fs';
import {
  getProject,
  normalizeProjectMeta,
  listChapters,
  resolveManuscriptPath,
  listWorkspaceFiles,
  workspacePath,
} from '../storage.js';
import { loadKnowledgeBundle } from '../story-kb/store.js';

const AI_PHRASES = [
  '不禁', '嘴角微微上扬', '心头一紧', '瞳孔微缩', '目光深邃',
  '仿佛', '宛如', '与此同时', '总而言之', '毋庸置疑',
];

const REVIEW_KEYS = ['节奏密度', '人设一致性', '伏笔回收率', '风格稳定性'];

function now() {
  return new Date().toISOString();
}

function readLatestManuscriptText(projectId) {
  const chapters = listChapters(projectId);
  if (!chapters.length) return '';
  try {
    const filePath = resolveManuscriptPath(projectId, chapters[chapters.length - 1].filename);
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/** 启发式审稿计算（供 Measurement Review Facade 调用） */
export function computeProjectReview(projectId) {
  const meta = normalizeProjectMeta(getProject(projectId));
  const text = readLatestManuscriptText(projectId);
  const plain = text.replace(/\s/g, '');
  const words = plain.length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  const avgPara = paragraphs.length ? Math.round(words / paragraphs.length) : 0;
  const dialogueLines = (text.match(/[「『""]/g) || []).length;
  // 使用 Knowledge 中的角色数据替代 legacy assets
  const kb = loadKnowledgeBundle(projectId);
  const roleAssets = (kb.characters?.items || []).filter((it) => it.name);
  const roleHits = roleAssets.filter((a) => a.name && text.includes(a.name.split('·').pop())).length;
  const outlineCount = listWorkspaceFiles(projectId, 'outline').length;
  const settingsCount = listWorkspaceFiles(projectId, 'settings').length;
  const foreshadowHits = (text.match(/伏笔|悬念|未解|后续|将会/g) || []).length;
  const aiHits = AI_PHRASES.filter((p) => text.includes(p)).length;

  const hints = [];
  if (!words) hints.push('尚无正文可分析，建议先完成至少一章后再审稿。');
  if (avgPara > 280) hints.push('段落偏长，节奏可能偏慢，可考虑拆段或增加对话/动作切换。');
  if (avgPara > 0 && avgPara < 60) hints.push('段落偏短，信息密度可能过高，注意场景过渡是否清晰。');
  if (aiHits >= 3) hints.push(`检测到 ${aiHits} 处常见 AI 套话，建议逐段润色替换。`);
  if (roleAssets.length && roleHits < Math.min(roleAssets.length, 2)) {
    hints.push('正文与「角色」素材关联较弱，检查人物称呼/性格是否前后一致。');
  }
  if (!outlineCount) hints.push('大纲为空，建议补充总纲以便检查剧情偏离。');
  if (foreshadowHits === 0 && words > 1500) hints.push('长文未见明显悬念/伏笔标记，可评估章末钩子是否足够。');

  const paceScore = !words
    ? 0
    : Math.max(55, Math.min(98, 88 - Math.abs(avgPara - 140) / 4 - aiHits * 3));
  const characterScore = !words
    ? 0
    : Math.max(50, Math.min(98, 70 + roleHits * 8 + Math.min(settingsCount, 3) * 4));
  const foreshadowScore = !words
    ? 0
    : Math.max(50, Math.min(95, 62 + foreshadowHits * 6 + (outlineCount ? 10 : 0)));
  const styleScore = !words
    ? 0
    : Math.max(45, Math.min(98, 90 - aiHits * 7 - Math.max(0, dialogueLines - 20)));

  const scores = {
    节奏密度: paceScore,
    人设一致性: characterScore,
    伏笔回收率: foreshadowScore,
    风格稳定性: styleScore,
  };

  const checks = REVIEW_KEYS.map((key) => ({
    key,
    status: words ? 'done' : 'pending',
    score: words ? Math.round(scores[key]) : null,
    updated_at: words ? now() : null,
  }));

  return {
    project_id: projectId,
    project_title: meta.title,
    manuscript_words: words,
    checks,
    hints,
    updated_at: now(),
  };
}

/** 仅计算，不写盘 */
export function computeStudioReview(projectId = '') {
  if (!projectId) throw new Error('project_id 不能为空');
  workspacePath(projectId);
  return computeProjectReview(projectId);
}
