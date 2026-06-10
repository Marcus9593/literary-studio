/** Story OS 导航：三场景 + 扁平列表（右侧栏兼容） */

export const STORY_NAV_GROUPS = [
  {
    id: 'write',
    label: '写什么',
    hint: '今日任务与创作路线',
    items: [
      { to: 'suggestions', label: '今日建议', shortLabel: '今日', icon: '✦', statKey: 'suggestions' },
      { to: 'roadmap', label: '创作路线', shortLabel: '路线', icon: '↝' },
    ],
  },
  {
    id: 'quality',
    label: '写得好吗',
    hint: '质量、节奏与知识',
    items: [
      { to: 'health', label: '作品质量', shortLabel: '质量', icon: '◆', statKey: 'health' },
      { to: 'suspense', label: '悬念分析', shortLabel: '悬念', icon: '⚡' },
      { to: 'beats', label: '节拍大纲', shortLabel: '节拍', icon: '▣' },
      { to: 'knowledge', label: '作品知识', shortLabel: '知识', icon: '◎', statKey: 'knowledge' },
    ],
  },
  {
    id: 'revise',
    label: '怎么改',
    hint: '计划、角色与编剧室',
    items: [
      { to: 'plans', label: '修改计划', shortLabel: '计划', icon: '◇', statKey: 'plansPending', pending: true },
      { to: 'characters', label: '角色工坊', shortLabel: '角色', icon: '☺' },
      { to: 'bible', label: '设定圣经', shortLabel: '圣经', icon: '✧' },
      { to: 'engine', label: '编剧室', shortLabel: '编剧', icon: '⬡' },
    ],
  },
]

export const STORY_NAV_ITEMS = STORY_NAV_GROUPS.flatMap((g) => g.items)

export function storyNavSegment(pathname, projectId) {
  const prefix = `/projects/${projectId}/`
  if (!pathname.startsWith(prefix)) return ''
  return pathname.slice(prefix.length).split('/')[0] || ''
}

export function storyNavGroupForSegment(segment) {
  if (!segment) return STORY_NAV_GROUPS[0]
  return STORY_NAV_GROUPS.find((g) => g.items.some((i) => i.to === segment)) || STORY_NAV_GROUPS[0]
}

export function storyNavBadge(item, storyStats) {
  if (!item.statKey || !storyStats || storyStats.loading) return null
  if (item.pending) {
    const n = storyStats.plansPending
    return n > 0 ? n : null
  }
  const v = storyStats[item.statKey]
  if (!v || v === '暂无') return null
  return v
}
