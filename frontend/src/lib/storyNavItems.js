/** Shared Story OS navigation items (workspace right rail + subnav). */
export const STORY_NAV_ITEMS = [
  { to: 'suggestions', label: '今日建议', shortLabel: '今日', icon: '✦', statKey: 'suggestions' },
  { to: 'beats', label: '节拍大纲', shortLabel: '节拍', icon: '▣' },
  { to: 'characters', label: '角色工坊', shortLabel: '角色', icon: '☺' },
  { to: 'bible', label: '设定圣经', shortLabel: '圣经', icon: '✧' },
  { to: 'suspense', label: '悬念分析', shortLabel: '悬念', icon: '⚡' },
  { to: 'roadmap', label: '创作路线', shortLabel: '路线', icon: '↝' },
  { to: 'knowledge', label: '作品知识', shortLabel: '知识', icon: '◎', statKey: 'knowledge' },
  { to: 'plans', label: '修改计划', shortLabel: '计划', icon: '◇', statKey: 'plansPending', pending: true },
  { to: 'health', label: '作品质量', shortLabel: '质量', icon: '◆', statKey: 'health' },
  { to: 'engine', label: '编剧室', shortLabel: '编剧', icon: '⬡' },
]

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
