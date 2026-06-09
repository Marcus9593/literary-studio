import { randomUUID } from 'crypto';
import { countNameMentions } from '../story-kb/scan-sources.js';
import { listCharacters } from '../story-kb/entity-resolver.js';

const STAGE_LABELS = ['起点', '依赖期', '抉择期', '觉醒期', '蜕变期'];

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

function inferStage(mentionCount, chapterCount) {
  if (chapterCount < 5) return { stage: '起点', index: 0 };
  const ratio = mentionCount / Math.max(chapterCount, 1);
  if (ratio < 0.8) return { stage: '依赖期', index: 1 };
  if (ratio < 2) return { stage: '抉择期', index: 2 };
  if (ratio < 4) return { stage: '觉醒期', index: 3 };
  return { stage: '蜕变期', index: 4 };
}

/**
 * 角色弧光分析（启发式 MVP；后续由 Claude 替换）
 */
export function analyzeArcs({ kb, manifest, projectId = '' }) {
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

    const mentions = countNameMentions(chapters, char.name);
    const { stage, index } = inferStage(mentions, chapters.length || chapterCount);
    const breakpoints = [];

    if (index <= 1 && chapterCount >= 5) {
      breakpoints.push({
        chapter: `约第${Math.max(3, Math.floor(chapterCount * 0.6))}章`,
        issue: `${label}成长线可能停滞，缺少独立抉择事件`,
        severity: chapterCount >= 15 ? 'high' : 'medium',
      });
    }

    const risk = breakpoints.length ? '成长停滞' : index >= 3 ? '平稳推进' : '待加强';
    const riskLevel = breakpoints.length ? 'high' : index >= 2 ? 'low' : 'medium';

    const stableId = char.id || char.name;
    items.push({
      id: `arc_${stableId}`,
      character_id: stableId,
      name: char.name,
      goal: char.notes?.slice(0, 40) || kb.story_summary?.logline?.slice(0, 40) || '待明确',
      fatal_flaw: null,
      growth_arc: 'positive',
      current_stage: stage,
      stage_index: index,
      stage_total_estimate: STAGE_LABELS.length,
      emotion: index <= 1 ? '压抑' : '上升',
      risk,
      risk_level: riskLevel,
      breakpoints,
      evidence_chapters: chapters.slice(-3).map((c) => c.filename),
      confidence: 0.65,
      label,
    });
  }

  return { items };
}

export function findArcForMessage(arcs, message) {
  const msg = String(message || '');
  const items = arcs?.items || [];
  if (/女主|女一|女主角/.test(msg)) {
    return items.find((a) => a.label === '女主') || items[0];
  }
  if (/男主|主角/.test(msg)) {
    return items.find((a) => a.label === '主角') || items[0];
  }
  if (/成长/.test(msg)) return items.find((a) => a.breakpoints?.length) || items[0];
  return items[0];
}

export function buildArcAction(arc) {
  if (!arc) return null;
  const bp = arc.breakpoints?.[0];
  const chapterHint = bp?.chapter || '后续 2–3 章';
  return {
    id: `act_arc_${randomUUID().slice(0, 8)}`,
    type: 'arc_enhance',
    source: 'character_arcs',
    source_id: arc.id,
    title: `${arc.name}成长线：补「抉择事件」`,
    diagnosis: bp?.issue || `${arc.name}当前处于「${arc.current_stage}」，成长推进偏慢`,
    proposal: `在${chapterHint}增加一次独立决策（站队/背叛/牺牲其一），推动进入下一阶段`,
    execution_mode: 'rewrite_plan',
    impact_estimate: {
      metric: '成长线完整度',
      delta: '+12%',
      chapters: arc.evidence_chapters?.slice(0, 2) || [],
      risk: 'medium',
    },
    priority: arc.risk_level === 'high' ? 88 : 72,
    execution_prompt: `【Story Action · 成长线增强】
角色：${arc.name}
当前阶段：${arc.current_stage}
问题：${bp?.issue || arc.risk}
建议：${chapterHint}插入一次让角色主动抉择、承担后果的事件，推动成长线进入「${STAGE_LABELS[Math.min(arc.stage_index + 1, STAGE_LABELS.length - 1)]}」。
请先 Read 相关章节与 knowledge/ 人物设定，输出改稿要点，确认后再写入。`,
  };
}
