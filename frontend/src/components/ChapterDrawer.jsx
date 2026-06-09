import { useEffect, useState } from 'react'

export default function ChapterDrawer({ open, chapters, selected, onSelect, onClose }) {
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setFilter('')
  }, [open])

  const filtered = chapters.filter(
    (ch) => !filter || ch.title.toLowerCase().includes(filter.toLowerCase()),
  )

  if (!open) return null

  return (
    <div className="chapter-drawer-overlay" onClick={onClose}>
      <div className="chapter-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="chapter-drawer-header">
          <h3>章节列表</h3>
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="chapter-drawer-search">
          <input
            className="chapter-search"
            placeholder="搜索…"
            aria-label="搜索章节"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
        </div>
        {filtered.length ? (
          <ul className="chapter-list">
            {filtered.map((ch) => (
              <li
                key={ch.filename}
                className={`chapter-item ${selected === ch.filename ? 'active' : ''}`}
                onClick={() => { onSelect(ch); onClose() }}
                onKeyDown={(e) => { if (e.key === 'Enter') { onSelect(ch); onClose() } }}
                role="button"
                tabIndex={0}
              >
                <span className="chapter-item-title">{ch.title}</span>
                <span className="chapter-item-meta">{ch.words} 字</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="chapter-empty">
            暂无章节
            <br />
            在对话中让 AI 写第一章
          </p>
        )}
      </div>
    </div>
  )
}
