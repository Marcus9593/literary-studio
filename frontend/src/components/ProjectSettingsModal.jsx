import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import SelectField from './SelectField.jsx'
import {
  CREATION_MODE_LIST,
  GENRES_BY_WORK_TYPE,
  WORK_TYPE_LIST,
} from '../lib/projectProfile.js'

export default function ProjectSettingsModal({ open, project, onClose, onSave, saving }) {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [workType, setWorkType] = useState('novel_long')
  const [creationMode, setCreationMode] = useState('scratch')
  const [rewriteNote, setRewriteNote] = useState('')
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (!project) return
    // 仅在弹窗刚打开时灌入数据，避免工作台 auto-save refresh 覆盖用户正在编辑的内容
    if (wasOpenRef.current) return
    wasOpenRef.current = true
    setTitle(project.title || '')
    setGenre(project.genre || '其他')
    setWorkType(project.work_type || 'novel_long')
    setCreationMode(project.creation_mode || 'scratch')
    setRewriteNote(project.rewrite_note || '')
  }, [open, project])

  const genres = GENRES_BY_WORK_TYPE[workType] || GENRES_BY_WORK_TYPE.general

  useEffect(() => {
    if (!genres.includes(genre)) setGenre(genres[0])
  }, [workType, genres, genre])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      title: title.trim(),
      genre,
      work_type: workType,
      creation_mode: creationMode,
      rewrite_note: creationMode === 'rewrite' ? rewriteNote.trim() : '',
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="项目设置"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            type="submit"
            form="project-settings-form"
            className="btn btn-primary"
            disabled={saving || !title.trim()}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      <form id="project-settings-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="ps-title">作品标题</label>
          <input
            id="ps-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <SelectField
          label="作品类型"
          htmlFor="ps-work-type"
          value={workType}
          onChange={setWorkType}
          options={WORK_TYPE_LIST.map((t) => ({ value: t.id, label: t.label }))}
        />
        <div className="field">
          <label>创作意图</label>
          <div className="creation-mode-list">
            {CREATION_MODE_LIST.map((m) => (
              <label key={m.id} className={`creation-mode-item ${creationMode === m.id ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="ps_creation_mode"
                  checked={creationMode === m.id}
                  onChange={() => setCreationMode(m.id)}
                />
                <span className="creation-mode-label">{m.label}</span>
                <span className="creation-mode-desc">{m.description}</span>
              </label>
            ))}
          </div>
        </div>
        {creationMode === 'rewrite' && (
          <div className="field">
            <label htmlFor="ps-rewrite">重写说明</label>
            <textarea
              id="ps-rewrite"
              rows={2}
              value={rewriteNote}
              onChange={(e) => setRewriteNote(e.target.value)}
            />
          </div>
        )}
        <SelectField
          label="题材 / 风格"
          htmlFor="ps-genre"
          value={genre}
          onChange={setGenre}
          options={genres.map((g) => ({ value: g, label: g }))}
        />
      </form>
    </Modal>
  )
}
