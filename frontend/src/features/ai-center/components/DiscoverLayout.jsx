/**
 * Shared layout primitives for Skills / MCP discovery panels.
 */

export function DiscoverSection({ children, className = '', as: Tag = 'section' }) {
  const cls = [
    Tag === 'section' ? 'tools-section' : '',
    'ai-discover-section',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <Tag className={cls}>{children}</Tag>
}

export function DiscoverAdminNotice({ title = '只读模式', children }) {
  return (
    <div className="ai-admin-notice" role="status">
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  )
}

export function DiscoverHero({ title, description, badgeLabel, badgeValue }) {
  return (
    <div className="tools-discover-hero">
      <div>
        <h3>{title}</h3>
        {description && <p className="muted">{description}</p>}
      </div>
      {(badgeLabel || badgeValue != null) && (
        <div className="tools-discover-hero-badge">
          {badgeLabel && <span>{badgeLabel}</span>}
          {badgeValue != null && <strong>{badgeValue}</strong>}
        </div>
      )}
    </div>
  )
}

export function DiscoverSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel = '搜索',
  submitting = false,
  children,
  trailing,
}) {
  return (
    <div className="tools-search-bar">
      <label className="tools-search-input-wrap">
        <span className="tools-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          value={value}
          onChange={onChange}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
          placeholder={placeholder}
        />
      </label>
      {children}
      <button type="button" className="btn btn-primary" disabled={submitting} onClick={onSubmit}>
        {submitting ? '搜索中…' : submitLabel}
      </button>
      {trailing}
    </div>
  )
}

export function DiscoverMeta({ children }) {
  return <div className="tools-discover-meta muted">{children}</div>
}

export function DiscoverEmpty({ icon = '◎', title, description, action, guidance }) {
  return (
    <div className="empty-state ai-discover-empty">
      <div className="empty-state-icon">{icon}</div>
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {action}
      {guidance}
    </div>
  )
}

export function DiscoverCustomInstall({
  value,
  onChange,
  placeholder,
  onInstall,
  disabled,
  installLabel = '安装',
}) {
  return (
    <div className="tools-inline-form tools-custom-install">
      <input type="text" value={value} onChange={onChange} placeholder={placeholder} />
      <button type="button" className="btn btn-secondary" disabled={disabled} onClick={onInstall}>
        {installLabel}
      </button>
    </div>
  )
}

export function DiscoverList({ children }) {
  return <div className="tools-discover-list">{children}</div>
}

export function DiscoverCard({
  title,
  subtitle,
  description = '无描述',
  kind,
  headExtras,
  tags,
  actions,
  index = 0,
}) {
  return (
    <article className="tool-discover-card" style={{ '--item-delay': `${index * 35}ms` }}>
      <div className="tool-discover-head">
        <h3>{title}</h3>
        <div className="tool-discover-head-right">
          {headExtras}
          {kind && <span className="tool-discover-kind">{kind}</span>}
        </div>
      </div>
      {subtitle && <p className="muted ai-discover-subtitle">{subtitle}</p>}
      <p>{description}</p>
      {tags && <div className="tool-discover-tags">{tags}</div>}
      {actions && <div className="tool-discover-actions">{actions}</div>}
    </article>
  )
}

export function DiscoverNoResults({ message = '无匹配结果，请换关键词重试。' }) {
  return <p className="empty-hint">{message}</p>
}

export function DiscoverPagination({
  mode = 'pages',
  busy,
  page,
  limit = 20,
  total = 0,
  onPrev,
  onNext,
  hasMore,
  onLoadMore,
  loadMoreLabel = '加载更多',
}) {
  if (mode === 'cursor') {
    if (!hasMore) return null
    return (
      <div className="tools-pagination">
        <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={onLoadMore}>
          {busy ? '加载中…' : loadMoreLabel}
        </button>
      </div>
    )
  }

  if (total <= limit) return null
  return (
    <div className="tools-pagination">
      <button type="button" className="btn btn-ghost" disabled={page <= 1 || !!busy} onClick={onPrev}>
        上一页
      </button>
      <span>第 {page} 页</span>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={page * limit >= total || !!busy}
        onClick={onNext}
      >
        下一页
      </button>
    </div>
  )
}
