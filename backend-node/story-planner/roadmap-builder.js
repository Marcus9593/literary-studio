const PURPOSE_POOL = [
  '铺设线索',
  '发现真相',
  '冲突升级',
  '情感转折',
  '公开对峙',
  '代价落地',
  '悬念钩子',
  '阵营分化',
  '成长节点',
  '伏笔触碰',
];

function pickPurpose(index, total, majorChanges) {
  if (majorChanges?.length) {
    const slot = Math.floor((index / total) * majorChanges.length);
    const base = majorChanges[Math.min(slot, majorChanges.length - 1)] || '';
    const short = base.replace(/^第\s*\d+[^章]*章/, '').slice(0, 24);
    if (short.length > 4) return short;
  }
  return PURPOSE_POOL[index % PURPOSE_POOL.length];
}

/**
 * 依赖 story_goal，生成 chapter_roadmap
 */
export function buildChapterRoadmap(ctx, storyGoal) {
  if (!storyGoal) throw new Error('需要先生成 story_goal');

  const from = (storyGoal.current_chapter || ctx.currentChapter || 0) + 1;
  const horizon = storyGoal.horizon || ctx.horizon || 5;
  const to = from + horizon - 1;

  const chapters = [];
  for (let i = 0; i < horizon; i += 1) {
    const chapter = from + i;
    const purpose = pickPurpose(i, horizon, storyGoal.major_changes);
    chapters.push({
      chapter,
      title_hint: `第${chapter}章`,
      purpose,
      beat: null,
      status: 'planned',
      task_ids: [],
      hooks: i === horizon - 1 ? ['章末悬念'] : [],
    });
  }

  return {
    version: 1,
    schema: 'chapter_roadmap',
    horizon,
    range: { from, to },
    goal_summary: storyGoal.target_state?.slice(0, 120) || '',
    current_chapter: storyGoal.current_chapter,
    chapters,
    stale_after_chapter: null,
    source: 'heuristic',
  };
}
