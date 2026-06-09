import { useEffect, useRef, useState } from 'react'
import { PROJECT_STATUS_LIST } from '../lib/projectStatus.js'

export default function ProjectCardMenu({
  project,
  pinned,
  onPin,
  onRename,
  onEditSummary,
  onSetStatus,
  onToggleArchive,
  onDelete,
  onImport,
  onShare,
}) {
  const canWrite = project.access?.write !== false
  const canManage = project.access?.manage === true
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="project-card-menu" ref={rootRef}>
      <button
        type="button"
        className="project-card-menu-trigger"
        aria-label="项目操作"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        ⋯
      </button>
      {open && (
        <div className="project-card-menu-panel fancy-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onPin?.()
            }}
          >
            {pinned ? '取消置顶' : '置顶'}
          </button>
          {canManage && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onShare?.()
              }}
            >
              共享权限
            </button>
          )}
          {canWrite && (
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onRename?.()
            }}
          >
            重命名
          </button>
          )}
          {canWrite && (
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onEditSummary?.()
            }}
          >
            编辑简述
          </button>
          )}
          {canWrite && (
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onImport?.()
            }}
          >
            导入续写
          </button>
          )}
          {canWrite && <div className="project-card-menu-divider" role="separator" />}
          {canWrite && PROJECT_STATUS_LIST.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitem"
              className={(project.status || 'writing') === s.id ? 'project-card-menu-current' : ''}
              disabled={(project.status || 'writing') === s.id}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onSetStatus?.(s.id)
              }}
            >
              {s.label}
            </button>
          ))}
          {canWrite && <div className="project-card-menu-divider" role="separator" />}
          {canWrite && (
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onToggleArchive?.()
            }}
          >
            {project.archived ? '移出归档' : '归档'}
          </button>
          )}
          {canManage && (
          <button
            type="button"
            role="menuitem"
            className="project-card-menu-danger"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onDelete?.()
            }}
          >
            删除
          </button>
          )}
        </div>
      )}
    </div>
  )
}
