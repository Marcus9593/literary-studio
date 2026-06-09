export const WORK_TYPES = {
  novel_long: { label: '长篇小说', unit: '章', unitPlural: '章' },
  novel_short: { label: '短篇小说', unit: '篇', unitPlural: '篇' },
  webnovel: { label: '网文连载', unit: '章', unitPlural: '章' },
  screenplay_film: { label: '电影剧本', unit: '场', unitPlural: '场' },
  screenplay_series: { label: '剧集剧本', unit: '集', unitPlural: '集' },
  web_short: { label: '短视频脚本', unit: '条', unitPlural: '条' },
  general: { label: '通用创作', unit: '稿', unitPlural: '稿' },
}

export const CREATION_MODES = {
  scratch: { label: '从零开始', description: '新建大纲与正文，逐步搭建' },
  continue: { label: '续写半成品', description: '在已有文稿基础上接着写' },
  rewrite: { label: '重新创作', description: '保留旧稿作参考，新稿写入试验稿' },
}

export const WORK_TYPE_LIST = Object.entries(WORK_TYPES).map(([id, v]) => ({ id, ...v }))
export const CREATION_MODE_LIST = Object.entries(CREATION_MODES).map(([id, v]) => ({ id, ...v }))

export const GENRES_BY_WORK_TYPE = {
  novel_long: ['现实', '历史', '悬疑', '言情', '科幻', '奇幻', '其他'],
  novel_short: ['现实', '悬疑', '科幻', '言情', '其他'],
  webnovel: ['玄幻', '都市', '科幻', '悬疑', '言情', '历史', '仙侠'],
  screenplay_film: ['剧情', '喜剧', '悬疑', '科幻', '爱情', '动作', '其他'],
  screenplay_series: ['都市', '悬疑', '古装', '科幻', '喜剧', '其他'],
  web_short: ['知识', '生活', '搞笑', '情感', '种草', '探店', '剧情', '其他'],
  general: ['通用', '其他'],
}

export function workTypeOf(project) {
  return WORK_TYPES[project?.work_type] || WORK_TYPES.novel_long
}

export function creationModeOf(project) {
  return CREATION_MODES[project?.creation_mode] || CREATION_MODES.scratch
}

export function unitLabel(project, count = 1) {
  const w = workTypeOf(project)
  return count === 1 ? w.unit : w.unitPlural
}

export function quickPromptsFor(project) {
  const wt = project?.work_type || 'novel_long'
  const mode = project?.creation_mode || 'scratch'
  const common = {
    continue: [
      '用 500 字以内总结目前已写剧情线与人物关系',
      '根据最新文稿，讨论接下来最合理的续写方向（先讨论，不要直接写全文）',
      '对照大纲检查已写内容有无偏离或矛盾',
      '列出尚未回收的伏笔 / 悬念',
    ],
    rewrite: [
      '基于现有文稿，建议哪些段落保留、哪些需要重写',
      '指出当前稿的主要结构问题，并给 2 个重写方向',
      '在不动旧稿的前提下，为下一版写一场/一段试验开场',
      '对照大纲，重新规划后续 3-5 个节拍',
    ],
    scratch: [
      '帮我列一个开篇写作计划与第一稿要点',
      '梳理主要人物关系与核心冲突',
      '根据大纲，建议第一个高潮点放在什么位置',
      '我想先聊方向，请问我几个关键问题再动笔',
    ],
  }
  const byType = {
    webnovel: [
      '分析最近几章的节奏与爽点密度',
      '章末钩子可以怎么加强',
      '主角下一步升级/打脸路径建议',
    ],
    screenplay_film: [
      '这一场戏的功能是什么？推进/揭示/转折？',
      '对白是否太直？给更 subtext 的改法',
      '和上一场戏的衔接有没有断裂',
    ],
    screenplay_series: [
      '本集结尾 hook 够不够强',
      'B 线在本集如何与 A 线交织',
      '本场对白是否符合人物声线',
    ],
    web_short: [
      '前3秒钩子够不够吸引人',
      '节奏是否紧凑，有没有拖沓',
      '结尾 CTA 是否自然',
    ],
    novel_short: [
      '短篇结构是否完整？结尾力度够吗',
      '有没有可以删减的冗余段落',
      '标题与核心隐喻是否统一',
    ],
  }
  const base = common[mode] || common.scratch
  const extra = byType[wt] || []
  return [...base, ...extra].slice(0, 6)
}

export function shouldShowTakeover(project, chapters = []) {
  if (project?.onboarding_completed) return false
  if (typeof sessionStorage !== 'undefined') {
    const dismissed = sessionStorage.getItem(`takeover-dismissed-${project?.id}`)
    if (dismissed) return false
  }
  if (project?.creation_mode === 'continue' || project?.creation_mode === 'rewrite') return true
  return chapters.length > 0
}

export function dismissTakeoverForSession(projectId) {
  if (typeof sessionStorage !== 'undefined' && projectId) {
    sessionStorage.setItem(`takeover-dismissed-${projectId}`, '1')
  }
}
