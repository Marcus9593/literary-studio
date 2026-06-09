import { useEffect, useRef, useState } from 'react'
import SelectField from './SelectField.jsx'

const UPLOAD_SUBDIRS = [
  { value: '正文', label: '正文 / 稿', meta: '章节与对话主稿' },
  { value: '大纲', label: '大纲', meta: '故事结构' },
  { value: '设定集', label: '设定集', meta: '人物与世界观' },
  { value: 'archive', label: '旧稿归档', meta: 'archive' },
  { value: '试验稿', label: '试验稿', meta: '重写用' },
]

export default function UploadModal({ open, onClose, onUpload }) {
  const [subdir, setSubdir] = useState('正文')
  const [hint, setHint] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) { setHint(''); setSubdir('正文') }
  }, [open])

  const handleFile = async (file) => {
    if (!file) return
    try {
      const result = await onUpload(file, subdir)
      const lines = (result.converted || []).map((c) => {
        if (c.error) return `${c.source}: ${c.error}`
        const pages = c.pages ? `，${c.pages} 页` : ''
        return `${c.source} → ${c.output}（${c.converter}，${c.words} 字${pages}）`
      })
      setHint(
        result.upload_type === 'zip'
          ? `已解压项目包，转换 ${lines.length} 个文件`
          : lines.length ? lines.join('；') : '已导入',
      )
      onClose?.()
    } catch (err) {
      setHint(`错误：${err.message}`)
    }
  }

  const onFileChange = async (e) => {
    await handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  const onDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    await handleFile(e.dataTransfer.files?.[0])
  }

  if (!open) return null

  return (
    <div className="upload-overlay" onClick={onClose}>
      <div className="upload-overlay-inner" onClick={(e) => e.stopPropagation()}>
        <div className="upload-overlay-header">
          <div>
            <h4>导入文档</h4>
            <p className="muted upload-modal-hint">支持 zip、docx、pdf、md、txt 等</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
        </div>
        <SelectField
          label="导入到"
          htmlFor="upload-subdir"
          value={subdir}
          onChange={setSubdir}
          options={UPLOAD_SUBDIRS}
        />
        <div
          className={`dropzone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        >
          <div className="dropzone-icon">⬆</div>
          <p>拖拽文件到此处，或点击选择</p>
          <p className="dropzone-formats">zip · docx · pdf · md · txt · html</p>
        </div>
        <input ref={fileRef} type="file" accept=".zip,.docx,.pdf,.md,.markdown,.txt,.html,.htm" hidden onChange={onFileChange} />
        {hint && <div className="upload-result">{hint}</div>}
      </div>
    </div>
  )
}
