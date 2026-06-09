import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getProject,
  getStoryBible,
  saveStoryBible,
  upsertBibleSection,
  deleteBibleSection,
  exportManuscript,
} from '../api.js'
import StorySubnav from '../components/StorySubnav.jsx'
import PageLoading from '../components/PageLoading.jsx'
import { useToast } from '../components/Toast.jsx'

const SECTION_TYPES = [
  { value: 'world', label: '世界观' },
  { value: 'magic', label: '力量体系' },
  { value: 'politics', label: '政治' },
  { value: 'history', label: '历史' },
  { value: 'custom', label: '自定义' },
]

const META_FIELDS = [
  { key: 'title', label: '标题' },
  { key: 'genre', label: '类型' },
  { key: 'logline', label: '一句话梗概' },
  { key: 'setting', label: '背景设定' },
  { key: 'tone', label: '基调' },
  { key: 'themes', label: '主题（逗号分隔）' },
]

export default function StoryBiblePage() {
  const { projectId } = useParams()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [bible, setBible] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sectionDraft, setSectionDraft] = useState({ title: '', type: 'world', content: '' })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getProject(projectId), getStoryBible(projectId)])
      .then(([p, b]) => { setProject(p); setBible(b) })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const saveMeta = async () => {
    setBusy(true)
    try {
      const b = await saveStoryBible(projectId, bible)
      setBible(b)
      showToast('设定圣经已保存')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const addSection = async () => {
    if (!sectionDraft.title.trim()) return
    setBusy(true)
    try {
      const b = await upsertBibleSection(projectId, sectionDraft)
      setBible(b)
      setSectionDraft({ title: '', type: 'world', content: '' })
      showToast('分节已添加')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const removeSection = async (id) => {
    if (!window.confirm('确定删除该分节？')) return
    setBusy(true)
    try {
      const b = await deleteBibleSection(projectId, id)
      setBible(b)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onExport = async (format) => {
    setBusy(true)
    try {
      const res = await exportManuscript(projectId, { format })
      showToast(`已导出 ${res.filename}`)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page story-bible-page">
        <PageLoading label="加载设定圣经…" />
      </div>
    )
  }

  return (
    <div className="page story-bible-page">
      <StorySubnav projectTitle={project?.title} />

      <header className="page-header story-page-intro">
        <div className="page-header-row">
          <div>
            <h2>设定圣经</h2>
            <p className="hint">结构化世界设定、分节管理与变更审计</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onExport('md')}>
              导出 MD
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onExport('docx')}>
              导出 DOCX
            </button>
          </div>
        </div>
      </header>

      <section className="card">
        <h3>核心元数据</h3>
        <div className="bible-meta-grid">
          {META_FIELDS.map(({ key, label }) => (
            <label key={key} className="form-field">
              <span>{label}</span>
              <input
                type="text"
                value={bible?.[key] || ''}
                onChange={(e) => setBible((b) => ({ ...b, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveMeta}>
          保存元数据
        </button>
      </section>

      <section className="card">
        <h3>分节</h3>
        {(bible?.sections || []).map((sec) => (
          <article key={sec.id} className="bible-section-card">
            <div className="bible-section-head">
              <strong>{sec.title}</strong>
              <span className="tag">{sec.type}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeSection(sec.id)}>删除</button>
            </div>
            <pre className="bible-section-content">{sec.content}</pre>
          </article>
        ))}
        <div className="bible-section-add">
          <input
            placeholder="分节标题"
            value={sectionDraft.title}
            onChange={(e) => setSectionDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <select
            value={sectionDraft.type}
            onChange={(e) => setSectionDraft((d) => ({ ...d, type: e.target.value }))}
          >
            {SECTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <textarea
            rows={4}
            placeholder="分节内容"
            value={sectionDraft.content}
            onChange={(e) => setSectionDraft((d) => ({ ...d, content: e.target.value }))}
          />
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={addSection}>添加分节</button>
        </div>
      </section>

      {(bible?.changelog || []).length > 0 && (
        <section className="card">
          <h3>变更日志</h3>
          <ul className="bible-changelog">
            {(bible.changelog || []).slice(0, 20).map((c, i) => (
              <li key={i}>
                <time className="muted">{c.at?.slice(0, 19)}</time>
                <span>{c.field}</span>
                {c.new_value && <span className="hint">→ {c.new_value}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
