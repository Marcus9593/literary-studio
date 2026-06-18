import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from './ThemeProvider.jsx'
import WorkspaceStatusBar from './WorkspaceStatusBar.jsx'
import ContextPicker from './ContextPicker.jsx'

export default function WorkspaceHeader({
  project,
  projectId,
  chapters,
  onExportProject,
  focusMode,
  onToggleFocus,
  onOpenSettings,
  onOpenUpload,
  onOpenShortcuts,
  onShowTakeover,
  onRefreshWorkspace,
  refreshingWorkspace = false,
  workspaceSummary = null,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const hasChapters = (chapters?.length ?? 0) > 0
  useEffect(() => {
    if (!menuOpen) return undefined
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="workspace-header reader-center-toolbar">
      <div className="reader-toolbar-row workspace-header-main">
        <Link to="/projects" className="workspace-toolbar-back">
          ← 项目库
        </Link>
        <h1 className="reader-toolbar-title">{project.title}</h1>
        <div className="workspace-header-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm workspace-refresh-btn"
            onClick={onRefreshWorkspace}
            disabled={refreshingWorkspace}
            title="刷新大纲/正文等文件列表"
          >
            {refreshingWorkspace ? '刷新中…' : '刷新文件'}
          </button>
          {workspaceSummary?.outline_count > 0 && (chapters?.length ?? 0) === 0 && (
            <span className="workspace-outline-badge muted" title="大纲目录已有文件">
              大纲 {workspaceSummary.outline_count}
            </span>
          )}
          <ContextPicker projectId={projectId} compact />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              closeMenu()
              onOpenSettings?.()
            }}
          >
            项目设置
          </button>
          {hasChapters && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                closeMenu()
                onOpenUpload?.()
              }}
            >
              导入
            </button>
          )}
          <div className="workspace-more-wrap" ref={menuRef}>
            <button
              type="button"
              className={`btn btn-ghost btn-sm workspace-more-trigger ${menuOpen ? 'active' : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              更多
              <span className="workspace-more-caret" aria-hidden="true">▾</span>
            </button>
            {menuOpen && (
              <div className="workspace-more-menu fancy-menu-panel" role="menu">
                {!hasChapters && (
                  <button
                    type="button"
                    className="workspace-more-item"
                    role="menuitem"
                    onClick={() => {
                      closeMenu()
                      onOpenUpload?.()
                    }}
                  >
                    导入 docx
                  </button>
                )}
                <button
                  type="button"
                  className="workspace-more-item"
                  role="menuitem"
                  onClick={() => {
                    closeMenu()
                    onShowTakeover?.()
                  }}
                >
                  项目诊断
                </button>
                <button
                  type="button"
                  className="workspace-more-item"
                  role="menuitem"
                  onClick={() => {
                    closeMenu()
                    onExportProject?.()
                  }}
                >
                  导出项目…
                </button>
                <Link
                  to="/ai"
                  className="workspace-more-item"
                  role="menuitem"
                  onClick={closeMenu}
                >
                  AI 中心
                </Link>
                <button
                  type="button"
                  className="workspace-more-item"
                  role="menuitem"
                  onClick={() => {
                    closeMenu()
                    onToggleFocus?.()
                  }}
                >
                  {focusMode ? '退出专注模式' : '专注模式'}
                  <span className="workspace-more-kbd">F</span>
                </button>
                <button
                  type="button"
                  className="workspace-more-item"
                  role="menuitem"
                  onClick={() => {
                    closeMenu()
                    onOpenShortcuts?.()
                  }}
                >
                  快捷键
                  <span className="workspace-more-kbd">?</span>
                </button>
                <div className="workspace-more-menu-theme" role="none">
                  <span className="workspace-more-theme-label">主题</span>
                  <ThemeToggle className="btn btn-ghost btn-sm" compact inline />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="reader-toolbar-row reader-toolbar-row-sub workspace-header-meta">
        <WorkspaceStatusBar project={project} chapters={chapters} />
      </div>
    </header>
  )
}
