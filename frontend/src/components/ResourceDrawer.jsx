import { useEffect, useState } from 'react'
import { listProjectFiles } from '../api.js'
import { unitLabel } from '../lib/projectProfile.js'

const PANELS = {
  manuscripts: { title: '文稿', category: null },
  outline: { title: '大纲', category: 'outline' },
  settings: { title: '设定', category: 'settings' },
  archive: { title: '旧稿', category: 'archive' },
  draft: { title: '试验稿', category: 'draft' },
}

export default function ResourceDrawer({
  open,
  panel,
  project,
  chapters,
  selected,
  onSelectManuscript,
  onSelectFile,
  onClose,
}) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const config = PANELS[panel] || PANELS.manuscripts

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setFilter('')
  }, [open, panel])

  useEffect(() => {
    if (!open || panel === 'manuscripts') {
      setFiles([])
      return
    }
    const cat = PANELS[panel]?.category
    if (!cat) return
    setLoading(true)
    listProjectFiles(project.id, cat)
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [open, panel, project?.id])

  if (!open) return null

  const list = panel === 'manuscripts' ? chapters : files
  const filtered = list.filter(
    (item) => !filter || item.title.toLowerCase().includes(filter.toLowerCase()),
  )
  const u = unitLabel(project, 2)

  return (
    <div className="chapter-drawer-overlay" onClick={onClose}>
      <div className="chapter-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="chapter-drawer-header">
          <h3>{config.title}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="chapter-drawer-search">
          <input
            className="chapter-search"
            placeholder="搜索…"
            aria-label={`搜索${config.title}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
        </div>
        {loading ? (
          <p className="chapter-empty">加载中…</p>
        ) : filtered.length ? (
          <ul className="chapter-list">
            {filtered.map((item) => (
              <li
                key={item.filename}
                className={`chapter-item ${selected === item.filename ? 'active' : ''}`}
                onClick={() => {
                  if (panel === 'manuscripts') onSelectManuscript(item)
                  else onSelectFile(panel, item)
                  onClose()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (panel === 'manuscripts') onSelectManuscript(item)
                    else onSelectFile(panel, item)
                    onClose()
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span className="chapter-item-title">{item.title}</span>
                <span className="chapter-item-meta">{item.words} 字</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="chapter-empty">
            暂无{config.title}
            <br />
            {panel === 'manuscripts' ? '可导入文稿，或在对话中生成新稿' : '可通过「导入」添加文件'}
          </p>
        )}
        {panel === 'manuscripts' && chapters.length > 0 && (
          <p className="chapter-drawer-foot muted">共 {chapters.length} {u}</p>
        )}
      </div>
    </div>
  )
}
