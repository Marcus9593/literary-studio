import { useEffect, useMemo, useState } from 'react'
import { CREATION_MODE_LIST, WORK_TYPE_LIST } from '../lib/projectProfile.js'
import { PROJECT_STATUS_LIST } from '../lib/projectStatus.js'
import { countChipFilters } from '../lib/projectListFilter.js'

function activeFilterTags(filters) {
  const tags = []
  if (filters.creationMode) {
    const m = CREATION_MODE_LIST.find((x) => x.id === filters.creationMode)
    if (m) tags.push({ key: 'creationMode', label: m.label })
  }
  if (filters.workType) {
    const t = WORK_TYPE_LIST.find((x) => x.id === filters.workType)
    if (t) tags.push({ key: 'workType', label: t.label })
  }
  if (filters.status) {
    const s = PROJECT_STATUS_LIST.find((x) => x.id === filters.status)
    if (s) tags.push({ key: 'status', label: s.label })
  }
  if (filters.genre) {
    tags.push({ key: 'genre', label: filters.genre })
  }
  return tags
}

function FilterSection({ title, hint, children }) {
  return (
    <section className="home-filter-section">
      <div className="home-filter-section-head">
        <h4 className="home-filter-section-title">{title}</h4>
        {hint && <p className="home-filter-section-hint">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function FilterChipGroup({ children }) {
  return <div className="home-filter-chips" role="group">{children}</div>
}

export default function HomeProjectFilters({
  filters,
  genres,
  archivedCount = 0,
  onChange,
  onReset,
  children,
}) {
  const [panelOpen, setPanelOpen] = useState(false)
  const set = (key, value) => onChange({ ...filters, [key]: value })
  const pick = (key, value) => set(key, filters[key] === value ? '' : value)
  const chip = (active) => `home-filter-chip ${active ? 'active' : ''}`.trim()
  const activeCount = countChipFilters(filters)
  const activeTags = useMemo(() => activeFilterTags(filters), [filters])
  const genreList = useMemo(
    () => [...genres].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [genres],
  )

  useEffect(() => {
    if (!panelOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen])

  const filterSections = (
    <div className="home-filter-panel-grid">
      <FilterSection title="创作意图" hint="项目当初设定的创作方式">
        <FilterChipGroup>
          <button type="button" className={chip(!filters.creationMode)} onClick={() => set('creationMode', '')}>
            不限
          </button>
          {CREATION_MODE_LIST.map((m) => (
            <button
              key={m.id}
              type="button"
              className={chip(filters.creationMode === m.id)}
              onClick={() => pick('creationMode', m.id)}
            >
              {m.label}
            </button>
          ))}
        </FilterChipGroup>
      </FilterSection>

      <FilterSection title="作品类型">
        <FilterChipGroup>
          <button type="button" className={chip(!filters.workType)} onClick={() => set('workType', '')}>
            不限
          </button>
          {WORK_TYPE_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              className={chip(filters.workType === t.id)}
              onClick={() => pick('workType', t.id)}
            >
              {t.label}
            </button>
          ))}
        </FilterChipGroup>
      </FilterSection>

      <FilterSection title="连载状态">
        <FilterChipGroup>
          <button type="button" className={chip(!filters.status)} onClick={() => set('status', '')}>
            不限
          </button>
          {PROJECT_STATUS_LIST.map((s) => (
            <button
              key={s.id}
              type="button"
              className={chip(filters.status === s.id)}
              onClick={() => pick('status', s.id)}
            >
              {s.label}
            </button>
          ))}
        </FilterChipGroup>
      </FilterSection>

      <FilterSection title="题材标签" hint="仅显示当前库内出现过的题材">
        {genreList.length > 0 ? (
          <FilterChipGroup>
            <button type="button" className={chip(!filters.genre)} onClick={() => set('genre', '')}>
              不限
            </button>
            {genreList.map((g) => (
              <button
                key={g}
                type="button"
                className={chip(filters.genre === g)}
                onClick={() => pick('genre', g)}
              >
                {g}
              </button>
            ))}
          </FilterChipGroup>
        ) : (
          <p className="home-filter-section-empty">暂无题材数据，创建项目后可按题材筛选</p>
        )}
      </FilterSection>
    </div>
  )

  const showToolbarChips = !panelOpen && (
    activeTags.length > 0
    || filters.showArchived
    || (!filters.showArchived && archivedCount > 0)
  )

  const button = (
    <button
      type="button"
      className={`btn btn-secondary btn-sm home-filter-open ${panelOpen ? 'active' : ''}`}
      onClick={() => setPanelOpen((v) => !v)}
      aria-expanded={panelOpen}
      aria-controls="home-filter-panel"
    >
      {panelOpen ? '收起筛选' : '筛选'}
      {!panelOpen && activeCount > 0 && (
        <span className="home-filter-open-badge">{activeCount}</span>
      )}
    </button>
  )

  const toolbarChips = showToolbarChips ? (
    <div className="home-toolbar-chips" aria-label="已选筛选">
      {activeTags.map((tag) => (
        <button
          key={tag.key}
          type="button"
          className="home-filter-active-chip"
          onClick={() => set(tag.key, '')}
          title="移除筛选"
        >
          {tag.label}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      {activeTags.length > 0 && (
        <button type="button" className="btn btn-ghost btn-sm home-filter-reset-inline" onClick={onReset}>
          清除筛选
        </button>
      )}
      {!filters.showArchived && archivedCount > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm home-archive-toggle"
          onClick={() => set('showArchived', true)}
        >
          查看归档 ({archivedCount})
        </button>
      )}
      {filters.showArchived && (
        <button
          type="button"
          className="btn btn-ghost btn-sm home-archive-toggle active"
          onClick={() => set('showArchived', false)}
        >
          返回活跃项目
        </button>
      )}
    </div>
  ) : null

  const panel = panelOpen ? (
    <div id="home-filter-panel" className="home-filter-panel" role="region" aria-label="筛选条件">
      <div className="home-filter-panel-head">
        <p className="home-filter-panel-intro">选择后立即生效；不同维度可组合使用。</p>
        {activeCount > 0 && (
          <div className="home-filter-panel-active" aria-live="polite">
            {activeTags.map((tag) => (
              <span key={tag.key} className="home-filter-panel-active-chip">{tag.label}</span>
            ))}
          </div>
        )}
      </div>
      {filterSections}
      <div className="home-filter-panel-foot">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={activeCount === 0}
          onClick={onReset}
        >
          清除全部
        </button>
        {!filters.showArchived && archivedCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm home-archive-toggle"
            onClick={() => set('showArchived', true)}
          >
            查看归档 ({archivedCount})
          </button>
        )}
        {filters.showArchived && (
          <button
            type="button"
            className="btn btn-ghost btn-sm home-archive-toggle active"
            onClick={() => set('showArchived', false)}
          >
            返回活跃项目
          </button>
        )}
      </div>
    </div>
  ) : null

  if (typeof children === 'function') {
    return <>{children({ button, panel, toolbarChips })}</>
  }

  return (
    <>
      {button}
      {toolbarChips}
      {panel}
    </>
  )
}
