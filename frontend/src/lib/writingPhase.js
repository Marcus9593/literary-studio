/** 推断项目当前创作阶段（展示用，非持久化字段） */
export function inferWritingPhase(project, chapterCount = 0) {
  if (chapterCount === 0) {
    return { id: 'outline', label: '大纲阶段', hint: '先搭结构，再开第一章' }
  }
  if (project?.creation_mode === 'rewrite') {
    return { id: 'rewrite', label: '重写阶段', hint: '试验稿探索，正文定稿' }
  }
  if (project?.status === 'reviewing') {
    return { id: 'revise', label: '修改阶段', hint: '按诊断与计划改稿' }
  }
  if (chapterCount < 3) {
    return { id: 'opening', label: '开篇阶段', hint: '立住人物与钩子' }
  }
  return { id: 'draft', label: '初稿阶段', hint: '按路线持续推进' }
}

export function roadmapProgress(chaptersDone, roadmap) {
  const planned = roadmap?.chapters?.length
    || (roadmap?.range?.to && roadmap?.range?.from
      ? Math.max(0, roadmap.range.to - roadmap.range.from + 1)
      : 0)
  const done = chaptersDone || 0
  if (!planned) {
    return { done, planned: null, percent: null }
  }
  const percent = Math.min(100, Math.round((done / planned) * 100))
  return { done, planned, percent }
}
