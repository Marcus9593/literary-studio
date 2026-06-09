import { Link } from 'react-router-dom'
import { formatDateYMD, formatUpdatedAgo } from '../lib/formatTime.js'
import { getProjectCardBlurb } from '../lib/projectCardSummary.js'
import { creationModeOf, unitLabel, workTypeOf } from '../lib/projectProfile.js'
import { projectStatusOf } from '../lib/projectStatus.js'
import ProjectCardMenu from './ProjectCardMenu.jsx'

export default function HomeProjectItem({
  project,
  index = 0,
  view = 'grid',
  pinned = false,
  batchMode = false,
  selected = false,
  onToggleSelect,
  onPin,
  onRename,
  onEditSummary,
  onSetStatus,
  onToggleArchive,
  onDelete,
  onImport,
  onShare,
}) {
  const wt = workTypeOf(project)
  const cm = creationModeOf(project)
  const u = unitLabel(project, project.stats?.manuscript_count || 0)
  const count = project.stats?.manuscript_count ?? 0
  const words = project.stats?.total_words ?? 0
  const createdAt = formatDateYMD(project.created_at)
  const updatedAt = formatDateYMD(project.updated_at)
  const updatedAgo = formatUpdatedAgo(project.updated_at)
  const blurb = getProjectCardBlurb(project)
  const status = projectStatusOf(project)
  const projectPath = `/projects/${project.id}`

  const menu = (
    <ProjectCardMenu
      project={project}
      pinned={pinned}
      onPin={onPin}
      onRename={onRename}
      onEditSummary={onEditSummary}
      onSetStatus={onSetStatus}
      onToggleArchive={onToggleArchive}
      onDelete={onDelete}
      onImport={onImport}
      onShare={onShare}
    />
  )

  const statusBadge = (
    <span className={`project-status-badge status-${project.status || 'writing'}`}>
      {status.label}
    </span>
  )

  const selectBox = batchMode ? (
    <label
      className="project-card-select"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect?.(project.id)}
        aria-label={`选择 ${project.title}`}
      />
    </label>
  ) : null

  const listMainContent = (
    <>
      {pinned && <span className="project-pin-badge" title="已置顶">📌</span>}
      <div className="project-list-title-block">
        <h3>{project.title}</h3>
        <div className="project-card-tags">
          {statusBadge}
          <span className="project-card-tag project-card-tag-type">{wt.label}</span>
          <span className="project-card-tag project-card-tag-mode">{cm.label}</span>
          <span className="project-card-tag project-card-tag-genre">{project.genre}</span>
        </div>
      </div>
      <p className={`project-list-summary ${blurb.isEmpty ? 'is-empty' : ''}`}>{blurb.text}</p>
      <div className="project-list-meta">
        <span>{count} {u}</span>
        {words > 0 && <span>{words.toLocaleString()} 字</span>}
        {updatedAt && <span>更新 {updatedAt}</span>}
        {updatedAgo && <span className="project-card-time-ago">{updatedAgo}</span>}
      </div>
    </>
  )

  if (view === 'list') {
    if (batchMode) {
      return (
        <article
          className={`project-list-row ${pinned ? 'project-list-row-pinned' : ''} ${selected ? 'is-selected' : ''}`}
          style={{ '--card-i': index }}
        >
          {selectBox}
          <div
            role="button"
            tabIndex={0}
            className="project-list-row-link project-list-main-batch"
            onClick={() => onToggleSelect?.(project.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleSelect?.(project.id)
              }
            }}
          >
            <div className="project-list-main">{listMainContent}</div>
          </div>
        </article>
      )
    }

    return (
      <article
        className={`project-list-row project-list-row-clickable ${pinned ? 'project-list-row-pinned' : ''}`}
        style={{ '--card-i': index }}
      >
        <Link to={projectPath} className="project-list-row-link">
          <div className="project-list-main">{listMainContent}</div>
          <span className="project-list-enter-hint" aria-hidden="true">→</span>
        </Link>
        <div
          className="project-list-menu-wrap"
          onClick={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {menu}
        </div>
      </article>
    )
  }

  const BodyWrap = batchMode ? 'div' : Link
  const bodyProps = batchMode
    ? {
        role: 'button',
        tabIndex: 0,
        className: 'project-card-body-link project-card-body-batch',
        onClick: () => onToggleSelect?.(project.id),
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleSelect?.(project.id)
          }
        },
      }
    : { to: projectPath, className: 'project-card-body-link' }

  const TitleWrap = batchMode ? 'div' : Link
  const titleProps = batchMode
    ? { className: 'project-card-title-link' }
    : { to: projectPath, className: 'project-card-title-link' }

  return (
    <article
      className={`project-card ${pinned ? 'project-card-pinned' : ''} ${selected ? 'is-selected' : ''}`}
      style={{ '--card-i': index }}
    >
      <div className="project-card-head">
        {selectBox}
        <TitleWrap {...titleProps}>
          {pinned && <span className="project-pin-badge" title="已置顶">📌</span>}
          <h3>{project.title}</h3>
        </TitleWrap>
        {!batchMode && menu}
      </div>
      <BodyWrap {...bodyProps}>
        <div className="project-card-tags">
          {statusBadge}
          <span className="project-card-tag project-card-tag-type">{wt.label}</span>
          <span className="project-card-tag project-card-tag-mode">{cm.label}</span>
          <span className="project-card-tag project-card-tag-genre">{project.genre}</span>
        </div>
        <div className={`project-card-blurb ${blurb.isEmpty ? 'project-card-blurb-empty' : ''}`}>
          <p className="project-card-summary">{blurb.text}</p>
        </div>
        <div className="project-card-stats">
          <span>{count} {u}</span>
          {words > 0 && (
            <span className="project-card-stat-words">{words.toLocaleString()} 字</span>
          )}
        </div>
        {(createdAt || updatedAt || updatedAgo) && (
          <p className="project-card-times-compact">
            {createdAt && (
              <span>
                <span className="project-card-time-label">创建</span>
                {createdAt}
              </span>
            )}
            {updatedAt && (
              <span>
                <span className="project-card-time-label">更新</span>
                {updatedAt}
              </span>
            )}
            {updatedAgo && (
              <span className="project-card-time-ago">{updatedAgo}</span>
            )}
          </p>
        )}
      </BodyWrap>
      {!batchMode && (
        <div className="project-card-actions">
          <Link to={projectPath} className="project-card-enter">
            进入工作台 →
          </Link>
        </div>
      )}
    </article>
  )
}
