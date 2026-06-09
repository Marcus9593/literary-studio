import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import SelectField from './SelectField.jsx'
import { getExportFormats, triggerDownload } from '../api.js'

const PROJECT_OPTIONS = [
  { id: 'zip', label: 'ZIP 项目包', desc: '含 Markdown 正文、大纲、设定等（推荐备份）' },
  { id: 'epub', label: 'EPUB 电子书', desc: '可在 Apple Books / 阅读 App 中预览' },
  { id: 'docx', label: 'Word 全书', desc: '合并所有正文章节为一份 .docx', needsDocx: true },
  { id: 'zip_docx', label: 'ZIP（每章 Word）', desc: '每个正文章节各一个 .docx', needsDocx: true },
]

const CHAPTER_OPTIONS = [
  { id: 'md', label: 'Markdown (.md)', desc: '与工作台内文稿一致' },
  { id: 'docx', label: 'Word (.docx)', desc: '由 Markdown 转换，复杂版式可能简化', needsDocx: true },
]

export default function ExportModal({
  open,
  onClose,
  scope = 'project',
  projectId,
  chapterFilename,
  chapterTitle,
  projectTitle,
}) {
  const [format, setFormat] = useState(scope === 'chapter' ? 'md' : 'zip')
  const [docxAvailable, setDocxAvailable] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const options = scope === 'chapter' ? CHAPTER_OPTIONS : PROJECT_OPTIONS

  useEffect(() => {
    if (!open) return
    setError('')
    setFormat(scope === 'chapter' ? 'md' : 'zip')
    getExportFormats()
      .then((f) => setDocxAvailable(!!f.docx_export_available))
      .catch(() => setDocxAvailable(false))
  }, [open, scope])

  useEffect(() => {
    if (docxAvailable !== false) return
    const needsDocx = options.find((o) => o.id === format)?.needsDocx
    if (needsDocx) setFormat(scope === 'chapter' ? 'md' : 'zip')
  }, [docxAvailable, format, scope, options])

  const handleExport = async () => {
    setLoading(true)
    setError('')
    try {
      if (scope === 'chapter') {
        if (!chapterFilename) throw new Error('未选择章节')
        const base = (chapterTitle || chapterFilename).replace(/\.md$/i, '')
        await triggerDownload(
          `/projects/${projectId}/chapters/${encodeURIComponent(chapterFilename)}/export?format=${format}`,
          format === 'docx' ? `${base}.docx` : `${base}.md`,
        )
      } else {
        const base = (projectTitle || 'project').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80)
        const names = { zip: `${base}.zip`, epub: `${base}.epub`, docx: `${base}.docx`, zip_docx: `${base}-word.zip` }
        await triggerDownload(
          `/projects/${projectId}/download?format=${format}`,
          names[format] || `${base}.zip`,
        )
      }
      onClose?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const title = scope === 'chapter' ? '导出当前章节' : '导出项目'

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose?.()}
      title={title}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" disabled={loading} onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" disabled={loading} onClick={handleExport}>
            {loading ? '导出中…' : '下载'}
          </button>
        </>
      )}
    >
      <p className="hint export-modal-intro">
        工作台内编辑格式为 Markdown；选择 Word 时将在下载前自动转换。
      </p>
      <SelectField
        label="导出格式"
        htmlFor="export-format"
        value={format}
        onChange={setFormat}
        options={options.map((opt) => {
          const disabled = opt.needsDocx && docxAvailable === false
          return {
            value: opt.id,
            label: opt.label,
            meta: disabled ? `${opt.desc}（需安装 Python 依赖）` : opt.desc,
            disabled,
          }
        })}
      />
      {docxAvailable === false && (
        <p className="hint export-modal-setup">
          Word 导出不可用：请在项目目录执行 <code>pip install -r backend/requirements.txt</code> 后重启服务。
        </p>
      )}
      {error && <p className="export-modal-error">{error}</p>}
    </Modal>
  )
}
