export const PROJECT_STATUS_LIST = [
  { id: 'writing', label: '连载中' },
  { id: 'completed', label: '已完结' },
  { id: 'paused', label: '搁置' },
  { id: 'reviewing', label: '审稿中' },
]

export function projectStatusOf(project) {
  const id = project?.status || 'writing'
  return PROJECT_STATUS_LIST.find((s) => s.id === id) || PROJECT_STATUS_LIST[0]
}
