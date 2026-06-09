import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { searchProjectManuscripts } from '../api.js'

const CATEGORY_LABELS = {
  manuscript: '正文',
  draft: '试验稿',
  outline: '大纲',
  settings: '设定',
  archive: '旧稿',
}

export default function GlobalSearchModal({
  open,
  onClose,
  projectId,
  onOpenHit,
}) {
  const [query, setQuery] = useState('')
  const [regex, setRegex] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setError('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResult(null)
    }
  }, [open])

  const runSearch = useCallback(async (e) => {
    e?.preventDefault()
    const q = query.trim()
    if (!q || !projectId) return
    setLoading(true)
    setError('')
    try {
      const data = await searchProjectManuscripts(projectId, q, { regex })
      setResult(data)
    } catch (err) {
      setError(err.message || '搜索失败')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [query, regex, projectId])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="全局搜索"
      className="global-search-modal"
      footer={(
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          关闭 (Esc)
        </button>
      )}
    >
      <form className="global-search-form" onSubmit={runSearch}>
        <input
          ref={inputRef}
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索正文、大纲、设定…"
          aria-label="搜索关键词"
        />
        <label className="global-search-regex">
          <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
          正则
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
          {loading ? '搜索中…' : '搜索'}
        </button>
      </form>
      {error && <p className="workspace-inline-error">{error}</p>}
      {result && (
        <p className="muted global-search-summary">
          共 {result.total} 处匹配
          {result.truncated ? `（显示前 ${result.hits.length} 条）` : ''}
        </p>
      )}
      <ul className="global-search-hits">
        {(result?.hits || []).map((hit, i) => (
          <li key={`${hit.filename}-${hit.line}-${hit.column}-${i}`}>
            <button
              type="button"
              className="global-search-hit"
              onClick={() => {
                onOpenHit?.(hit)
                onClose()
              }}
            >
              <span className="global-search-hit-meta">
                [{CATEGORY_LABELS[hit.category] || hit.category}] {hit.title}
                {' · '}
                第 {hit.line} 行
              </span>
              <span className="global-search-hit-excerpt">{hit.excerpt}</span>
            </button>
          </li>
        ))}
      </ul>
      {result && result.hits.length === 0 && (
        <p className="muted">未找到匹配内容</p>
      )}
    </Modal>
  )
}
