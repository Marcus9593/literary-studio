import { creationModeOf } from './projectProfile.js'

const EMPTY_HINT = {
  scratch: '暂无简述，开写或补充大纲后自动摘录',
  continue: '暂无摘要，导入或续写后显示',
  rewrite: '暂无简述，可填重写方向或补充大纲',
}

/** 卡片中部简述展示 */
export function getProjectCardBlurb(project) {
  const text = String(project?.card_summary || '').trim()
  if (text) {
    return { text, isEmpty: false, source: project.summary_source || 'custom' }
  }
  const mode = creationModeOf(project).id
  return {
    text: EMPTY_HINT[mode] || EMPTY_HINT.scratch,
    isEmpty: true,
    source: 'empty',
  }
}
