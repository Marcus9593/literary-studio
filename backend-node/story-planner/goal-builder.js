import { CURRENT_STATE_ARTIFACT } from '../story-schemas/conventions.js';
import { resolveEntity } from '../story-kb/entity-resolver.js';

const TARGET_TEMPLATES = [
  '阵营公开分裂，主角完成关键抉择',
  '第二幕中点转折落地，读者明确感受到局势逆转',
  '核心反派动机揭露，主角目标被迫升级',
  '情感线与主线交汇，人物完成阶段性成长',
  '伏笔集中回收，为下一卷埋下新钩子',
];

/**
 * Story Goal — Target State（Current State 真相源在 Understanding）
 * @param {object} ctx
 * @param {{ act1Threshold?: number, act2Threshold?: number }} [ctx.actThresholds]
 *   act1Threshold: chapters below this are Act 1 (default 30)
 *   act2Threshold: chapters below this are Act 2 (default 80)
 */
export function buildStoryGoal(ctx) {
  const { currentChapter, horizon, storyDna, latestChapter, outlineExcerpt, conflicts, arcs } = ctx;

  const oneLiner = storyDna.one_liner?.trim() || '';
  const coreEngine = storyDna.core_engine?.trim() || '';

  const currentStateRef = {
    artifact: CURRENT_STATE_ARTIFACT,
    fields: ['one_liner', 'core_engine', 'core_theme'],
    understanding_files: ['story_dna.json', 'character_arcs.json', 'conflicts.json'],
  };

  /** UI 只读摘要，非第二真相源 */
  let currentStateSummary = oneLiner;
  if (latestChapter.excerpt) {
    currentStateSummary = `${oneLiner || '故事推进中'}（详见作品分析 · 第${latestChapter.index}章进展）`;
  } else if (!currentStateSummary) {
    currentStateSummary = currentChapter > 0
      ? `已完成 ${currentChapter} 章（详见作品分析）`
      : '尚无正文，需确立开篇';
  }

  const mainConflict = conflicts[0]?.conflict || coreEngine || '主线冲突待强化';
  const protagonist = arcs.find((a) => a.label === '主角') || arcs[0];
  let protagonistName = protagonist?.name || '主角';
  if (protagonist?.character_id && ctx.projectId) {
    const resolved = resolveEntity(ctx.projectId, protagonist.character_id);
    if (resolved?.canonicalName) protagonistName = resolved.canonicalName;
  }
  const arcHint = protagonist
    ? `${protagonistName}处于「${protagonist.current_stage || '成长中'}」阶段`
    : '';

  const act1Threshold = ctx.actThresholds?.act1Threshold ?? 30;
  const act2Threshold = ctx.actThresholds?.act2Threshold ?? 80;
  const actIndex = currentChapter < act1Threshold ? 1 : currentChapter < act2Threshold ? 2 : 3;
  const targetState = outlineExcerpt.length > 80
    ? `按总纲推进：${outlineExcerpt.slice(0, 80).replace(/\n/g, ' ')}…`
    : `${TARGET_TEMPLATES[actIndex % TARGET_TEMPLATES.length]}（围绕：${mainConflict}）`;

  const majorChanges = [
    `第 ${currentChapter + 1}–${currentChapter + horizon} 章落实「${mainConflict}」的升级`,
    arcHint ? `${arcHint}，在规划章段内完成至少一个成长节点` : '在规划章段内完成至少一个角色成长节点',
    '章末保留悬念钩子，推动读者继续阅读',
  ].filter(Boolean);

  return {
    version: 1,
    schema: 'story_goal',
    horizon,
    current_chapter: currentChapter,
    current_state_ref: currentStateRef,
    current_state_summary: currentStateSummary,
    target_state: targetState,
    major_changes: majorChanges,
    success_criteria: [
      `未来 ${horizon} 章内读者能感知故事向「${targetState.slice(0, 40)}…」推进`,
      '每章有明确的叙事目的，避免注水',
    ],
    linked_act: actIndex,
    confidence: storyDna.confidence ?? 0.7,
    source: 'heuristic',
  };
}
