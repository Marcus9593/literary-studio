import { useEffect, useState } from 'react'
import { listProjectFiles } from '../api.js'
import { unitLabel } from '../lib/projectProfile.js'
import WorkspaceOnboarding from './WorkspaceOnboarding.jsx'

const PANELS = {
  manuscripts: { title: '文稿', category: null },
  outline: { title: '大纲', category: 'outline' },
  settings: { title: '设定', category: 'settings' },
  archive: { title: '旧稿', category: 'archive' },
  draft: { title: '试验稿', category: 'draft' },
}

export default function ResourceSidebar({
  panel,
  project,
  chapters,
  selected,
  onSelectManuscript,
  onSelectFile,
  onClose,
  onNewManuscript,
  onDeleteManuscript,
  onImport,
  onFocusChat,
  onShowDiagnosis,
}) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const config = PANELS[panel] || PANELS.manuscripts

  useEffect(() => {
    setFilter('')
  }, [panel])

  useEffect(() => {
    if (!panel || panel === 'manuscripts') {
      setFiles([])
      return
    }
    const cat = PANELS[panel]?.category
    if (!cat || !project?.id) return
    setLoading(true)
    listProjectFiles(project.id, cat)
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [panel, project?.id])

  if (!panel) return null

  const list = panel === 'manuscripts' ? chapters : files
  const filtered = list.filter(
    (item) => !filter || item.title.toLowerCase().includes(filter.toLowerCase()),
  )
  const u = unitLabel(project, 1)
  const uPlural = unitLabel(project, 2)
  const emptyManuscripts = panel === 'manuscripts' && chapters.length === 0

  return (
    <aside className="resource-sidebar">
      <div className="resource-sidebar-header">
        <h3>{config.title}</h3>
        <button type="button" className="icon-btn" onClick={onClose} title="收起侧栏">‹</button>
      </div>

      {!emptyManuscripts && (
        <div className="resource-sidebar-toolbar">
          <input
            className="chapter-search"
            placeholder="搜索…"
            aria-label={`搜索${config.title}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {panel === 'manuscripts' && onNewManuscript && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onNewManuscript}>
              + 新建
            </button>
          )}
        </div>
      )}

      <div className="resource-sidebar-list">
        {loading ? (
          <p className="chapter-empty">加载中…</p>
        ) : emptyManuscripts ? (
          <WorkspaceOnboarding
            compact
            unit={u}
            onImport={onImport}
            onNewManuscript={onNewManuscript}
            onFocusChat={onFocusChat}
            onShowDiagnosis={onShowDiagnosis}
          />
        ) : filtered.length ? (
          <ul className="chapter-list">
            {filtered.map((item) => (
              <li
                key={item.filename}
                className={`chapter-item ${selected === item.filename ? 'active' : ''}`}
              >
                <div
                  className="chapter-item-main"
                  onClick={() => {
                    if (panel === 'manuscripts') onSelectManuscript(item)
                    else onSelectFile(panel, item)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (panel === 'manuscripts') onSelectManuscript(item)
                      else onSelectFile(panel, item)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="chapter-item-title">{item.title}</span>
                  <span className="chapter-item-meta">{item.words} 字</span>
                </div>
                {panel === 'manuscripts' && onDeleteManuscript && (
                  <button
                    type="button"
                    className="chapter-item-delete"
                    title="删除文稿"
                    aria-label={`删除 ${item.title}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteManuscript(item)
                    }}
                  >
                    删除
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="chapter-empty">
            暂无{config.title}
            <br />
            {panel === 'manuscripts' ? '可新建或导入文稿' : '可通过「更多 → 导入」添加文件'}
          </p>
        )}
      </div>

      {panel === 'manuscripts' && chapters.length > 0 && (
        <p className="resource-sidebar-foot muted">
          共 {chapters.length} {uPlural} · 每行右侧可删除
        </p>
      )}
    </aside>
  )
}
