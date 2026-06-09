import { BRAND } from '../lib/brand.js'

const QUICK_START = [
  { id: 'novel', label: '长篇小说', workType: 'novel_long', creationMode: 'scratch' },
  { id: 'script', label: '剧本', workType: 'script', creationMode: 'scratch' },
  { id: 'rewrite', label: '导入续写', workType: 'novel_long', creationMode: 'rewrite' },
]

export default function HomeEmptyPanel({
  variant = 'library',
  searchQuery = '',
  archivedCount = 0,
  cliOk = true,
  onCreate,
  onCreatePreset,
  onViewArchive,
  onClearFilters,
}) {
  if (variant === 'archived-only') {
    return (
      <div className="home-empty-panel">
        <span className="home-empty-icon" aria-hidden="true">📦</span>
        <h3>活跃列表为空</h3>
        <p>
          当前没有进行中的作品，<strong>{archivedCount}</strong> 部已收入归档。
        </p>
        <div className="home-empty-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onViewArchive}>
            查看归档
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCreate}>
            新建项目
          </button>
        </div>
      </div>
    )
  }

  if (variant === 'no-match') {
    return (
      <div className="home-empty-panel">
        <span className="home-empty-icon" aria-hidden="true">🔍</span>
        <h3>没有匹配的项目</h3>
        <p>
          {searchQuery.trim()
            ? <>未找到与「<strong>{searchQuery.trim()}</strong>」相关的作品，试试更短的关键词或调整筛选。</>
            : '当前筛选组合没有结果，可放宽条件或清除筛选后重试。'}
        </p>
        <div className="home-empty-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClearFilters}>
            清除搜索与筛选
          </button>
        </div>
      </div>
    )
  }

  if (variant === 'archive-empty') {
    return (
      <div className="home-empty-panel">
        <span className="home-empty-icon" aria-hidden="true">📦</span>
        <h3>暂无归档</h3>
        <p>完结或搁置的作品归档后会出现在这里，主列表将保持清爽。</p>
        <div className="home-empty-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClearFilters}>
            返回活跃项目
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-empty-panel home-empty-panel-library">
      <span className="home-empty-icon" aria-hidden="true">📖</span>
      <h3>{BRAND.home.emptyTitle}</h3>
      <p>{BRAND.home.emptyDesc}</p>
      {!cliOk && (
        <p className="home-empty-engine-warn">
          Claude Code 未连接，创建后对话与写稿功能暂不可用。可在设置中检查环境。
        </p>
      )}
      <div className="home-empty-actions">
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          {BRAND.home.createCta}
        </button>
      </div>
      <div className="home-empty-templates">
        <span className="home-empty-templates-label">快速开始</span>
        {QUICK_START.map((t) => (
          <button
            key={t.id}
            type="button"
            className="home-empty-template-chip"
            onClick={() => onCreatePreset?.(t)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
