import { useCallback, useEffect, useRef, useState } from 'react'
import { unitLabel } from '../lib/projectProfile.js'
import { renderSimpleMarkdown } from '../lib/simpleMarkdown.js'
import WorkspaceOnboarding from './WorkspaceOnboarding.jsx'
import OutlineTreePanel from './OutlineTreePanel.jsx'

const FONT_SIZES = [
  { id: 's', label: '小', px: 15 },
  { id: 'm', label: '中', px: 16 },
  { id: 'l', label: '大', px: 18 },
  { id: 'xl', label: '特大', px: 20 },
]

const FONT_STORAGE_KEY = 'wenjiang-reader-font'

function loadFontSize() {
  if (typeof localStorage === 'undefined') return 'm'
  return localStorage.getItem(FONT_STORAGE_KEY) || 'm'
}

const SOURCE_LABELS = {
  manuscript: '正文',
  outline: '大纲',
  settings: '设定',
  archive: '旧稿',
  draft: '试验稿',
}

export default function ReaderPane({
  chapter,
  content,
  onChange,
  onSave,
  onDiscussSelection,
  onInlineEdit,
  inlineEditBusy = '',
  onOutlineSynopsisChange,
  loading,
  saving,
  dirty,
  autoSaveHint = '',
  project,
  contentSource = 'manuscript',
  chapterNav = null,
  onImport,
  onNewManuscript,
  onFocusChat,
  onShowDiagnosis,
  onDeleteChapter,
  onExportChapter,
  chapterCount = 0,
  outlineCount = 0,
  onOpenOutline,
}) {
  const u = unitLabel(project, 1)
  const sourceLabel = SOURCE_LABELS[contentSource] || '文稿'
  const textareaRef = useRef(null)
  const [viewMode, setViewMode] = useState('edit')
  const [fontSize, setFontSize] = useState(loadFontSize)
  const [selection, setSelection] = useState(null)
  const fontPx = FONT_SIZES.find((f) => f.id === fontSize)?.px || 16
  const editable = Boolean(chapter) && !loading

  const wordCount = (content || '').replace(/\s/g, '').length

  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (dirty && !saving) onSave?.()
    }
  }, [dirty, saving, onSave])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setSelection(null)
    setViewMode('edit')
  }, [chapter?.filename, contentSource])

  const setFont = (id) => {
    setFontSize(id)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FONT_STORAGE_KEY, id)
    }
  }

  const updateSelection = useCallback(() => {
    const ta = textareaRef.current
    if (!ta || viewMode !== 'edit') return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (end - start < 8) {
      setSelection(null)
      return
    }
    const text = content.slice(start, end)
    setSelection({
      text,
      start,
      end,
      label: `${sourceLabel} · ${chapter?.title || ''}`,
    })
  }, [content, viewMode, sourceLabel, chapter?.title])

  const handleDiscuss = () => {
    if (!selection) return
    onDiscussSelection?.(selection.text, selection.label)
    setSelection(null)
  }

  const handleInline = (action) => {
    if (!selection || inlineEditBusy) return
    onInlineEdit?.(action, selection)
  }

  const previewHtml = renderSimpleMarkdown(content)
  const showOnboarding = project && !chapter && !loading && chapterCount === 0

  return (
    <div
      className={`reader-pane ${showOnboarding ? 'reader-pane-onboarding' : ''}`}
      style={{ '--reader-font-size': `${fontPx}px` }}
    >
      {project && chapter && (
        <div className="reader-pane-header">
          <div className="reader-pane-title-block">
            {chapter ? (
              <div className="reader-pane-chapter-info">
                <span className="reader-pane-source-tag">{sourceLabel}</span>
                <h2 className="reader-pane-chapter-title">{chapter.title}</h2>
                <span className="reader-pane-meta">
                  {wordCount.toLocaleString()} 字
                  {saving && <span className="reader-autosave-badge reader-saving-badge">保存中…</span>}
                  {!saving && autoSaveHint && <span className="reader-autosave-badge">{autoSaveHint}</span>}
                  {!saving && !autoSaveHint && dirty && <span className="reader-dirty-badge">未保存 · 2.5s 后自动保存</span>}
                </span>
              </div>
            ) : null}
          </div>
          {editable && (
            <div className="reader-pane-actions">
              {chapterNav?.enabled && (
                <div className="reader-chapter-nav" role="navigation" aria-label="章节导航">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!chapterNav.hasPrev}
                    onClick={chapterNav.onPrev}
                    title="上一章（⌘←）"
                  >
                    ‹ 上一{chapterNav.unit}
                  </button>
                  <span className="reader-chapter-nav-pos">
                    {chapterNav.index + 1} / {chapterNav.total}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!chapterNav.hasNext}
                    onClick={chapterNav.onNext}
                    title="下一章（⌘→）"
                  >
                    下一{chapterNav.unit} ›
                  </button>
                </div>
              )}
              <div className="reader-font-toggle" role="group" aria-label="字号">
                {FONT_SIZES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={fontSize === f.id ? 'active' : ''}
                    onClick={() => setFont(f.id)}
                    title={`${f.label}号字`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="reader-view-toggle">
                <button
                  type="button"
                  className={viewMode === 'edit' ? 'active' : ''}
                  onClick={() => setViewMode('edit')}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className={viewMode === 'preview' ? 'active' : ''}
                  onClick={() => setViewMode('preview')}
                >
                  预览
                </button>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!dirty || saving}
                onClick={onSave}
              >
                {saving ? '保存中…' : '保存'}
              </button>
              {contentSource === 'manuscript' && onExportChapter && chapter?.filename && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onExportChapter({ filename: chapter.filename, title: chapter.title })}
                  title="导出当前章节"
                >
                  导出
                </button>
              )}
              {contentSource === 'manuscript' && onDeleteChapter && chapter?.filename && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm reader-delete-chapter-btn"
                  onClick={() => onDeleteChapter({ filename: chapter.filename, title: chapter.title })}
                  title="删除当前文稿"
                >
                  删除
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {selection && (
        <div className="reader-selection-bar">
          <span>已选中 {selection.text.replace(/\s/g, '').length} 字</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!!inlineEditBusy}
            onClick={() => handleInline('rewrite')}
          >
            {inlineEditBusy === '改写' ? '改写中…' : 'AI 改写'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!!inlineEditBusy}
            onClick={() => handleInline('expand')}
          >
            扩写
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!!inlineEditBusy}
            onClick={() => handleInline('polish')}
          >
            润色
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleDiscuss}>
            就此讨论
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelection(null)}>
            取消
          </button>
        </div>
      )}

      <div className="reader-pane-content">
        {loading ? (
          <div className="reader-loading">
            <div className="loading-dots"><span /><span /><span /></div>
            <p>加载中…</p>
          </div>
        ) : chapter ? (
          viewMode === 'edit' ? (
            <>
              {contentSource === 'outline' && (
                <OutlineTreePanel
                  content={content}
                  onSynopsisSave={onOutlineSynopsisChange}
                />
              )}
              <textarea
              ref={textareaRef}
              className="reader-editor"
              value={content}
              onChange={(e) => onChange?.(e.target.value)}
              onSelect={updateSelection}
              onMouseUp={updateSelection}
              onKeyUp={updateSelection}
              placeholder="在此编辑文稿…"
              spellCheck={false}
              aria-label={`编辑${sourceLabel}`}
            />
            </>
          ) : (
            <div
              className="reader-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          )
        ) : showOnboarding ? (
          <WorkspaceOnboarding
            unit={u}
            onImport={onImport}
            onNewManuscript={onNewManuscript}
            onFocusChat={onFocusChat}
            onShowDiagnosis={onShowDiagnosis}
            outlineCount={outlineCount}
            onOpenOutline={onOpenOutline}
          />
        ) : (
          <div className="reader-empty reader-empty-minor">
            <h3 className="reader-empty-title">尚未打开文稿</h3>
            <p className="muted">从左侧文稿列表选择{u}，或新建一章</p>
          </div>
        )}
      </div>
    </div>
  )
}
