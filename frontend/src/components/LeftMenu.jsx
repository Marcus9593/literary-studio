const BASE_ITEMS = [
  { id: 'manuscripts', icon: '☰', label: '文稿', title: '章节与正文列表' },
  { id: 'outline', icon: '◇', label: '大纲', title: '故事大纲文件', needsChapters: false },
  { id: 'settings', icon: '◎', label: '设定', title: '世界观与人物设定', needsChapters: true },
]

const FILE_ITEMS = [
  { id: 'export', icon: '↓', label: '导出', isExport: true, title: '导出项目（可选 Word）' },
]

export default function LeftMenu({
  activePanel,
  onToggle,
  onExportProject,
  project,
  chapterCount = 0,
}) {
  const extra = project?.creation_mode === 'rewrite'
    ? [
        { id: 'draft', icon: '✎', label: '试验', title: '试验稿', needsChapters: true },
        { id: 'archive', icon: '⊟', label: '旧稿', title: '归档旧稿', needsChapters: true },
      ]
    : []

  const renderBtn = (item) => {
    const dimmed = chapterCount === 0
      && item.needsChapters !== false
      && ['settings', 'draft', 'archive'].includes(item.id)

    if (item.isExport) {
      return (
        <button
          key={item.id}
          type="button"
          className="left-menu-btn left-menu-btn-labeled"
          onClick={() => onExportProject?.()}
          title={item.title}
          aria-label="导出项目"
        >
          <span className="left-menu-icon">{item.icon}</span>
          <span className="left-menu-label">{item.label}</span>
        </button>
      )
    }
    return (
      <button
        key={item.id}
        type="button"
        className={`left-menu-btn left-menu-btn-labeled ${activePanel === item.id ? 'active' : ''} ${dimmed ? 'left-menu-btn-dimmed' : ''}`}
        onClick={() => !dimmed && onToggle(item.id)}
        title={dimmed ? '先有文稿后可管理设定与旧稿' : (item.title || item.label)}
        aria-label={item.label}
        aria-pressed={activePanel === item.id}
        disabled={dimmed}
      >
        <span className="left-menu-icon" aria-hidden="true">{item.icon}</span>
        <span className="left-menu-label">{item.label}</span>
      </button>
    )
  }

  return (
    <aside className="left-menu">
      <button
        type="button"
        className="left-menu-brand"
        onClick={() => onToggle('manuscripts')}
        title="打开文稿列表"
        aria-label="文稿列表"
      >
        文
      </button>

      <div className="left-menu-items">
        {BASE_ITEMS.map(renderBtn)}
        {extra.length > 0 && <div className="left-menu-divider" />}
        {extra.map(renderBtn)}
        <div className="left-menu-divider" />
        {FILE_ITEMS.map(renderBtn)}
      </div>
    </aside>
  )
}
