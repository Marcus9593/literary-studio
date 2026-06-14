import { useCallback, useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  getProject,
  getBeatOutline,
  saveBeatOutline,
  getCreatorContext,
  getBeatWritePlan,
  listChapters,
} from '../../../api.js'
import StoryOsPage from '../../../components/StoryOsPage.jsx'
import { useToast } from '../../../components/Toast.jsx'

const EMPTY_BEAT = { order: 1, title: '', description: '', scene_type: 'dialogue' }
const SCENE_TYPES = ['action', 'dialogue', 'montage', 'transition']

export default function StoryBeatsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [unitIndex, setUnitIndex] = useState(1)
  const [outline, setOutline] = useState(null)
  const [creatorCtx, setCreatorCtx] = useState(null)
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showContext, setShowContext] = useState(false)

  const loadOutline = useCallback((unit) => {
    Promise.all([
      getBeatOutline(projectId, unit),
      getCreatorContext(projectId, unit).catch(() => null),
    ])
      .then(([o, ctx]) => {
        setOutline(o)
        setCreatorCtx(ctx)
      })
      .catch((e) => showToast(e.message, 'error'))
  }, [projectId, showToast])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getProject(projectId), listChapters(projectId)])
      .then(([p, ch]) => {
        setProject(p)
        setChapters(ch || [])
        const last = ch?.length ? Math.max(...ch.map(c => c.number ?? 0)) || 1 : 1
        setUnitIndex(last)
        loadOutline(last)
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, showToast, loadOutline])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!loading) loadOutline(unitIndex)
  }, [unitIndex, loading, loadOutline])

  const updateBeat = (idx, patch) => {
    const beats = [...(outline?.beats || [])]
    beats[idx] = { ...beats[idx], ...patch }
    setOutline((o) => ({ ...o, beats }))
  }

  const addBeat = () => {
    const beats = [...(outline?.beats || [])]
    beats.push({ ...EMPTY_BEAT, order: beats.length + 1 })
    setOutline((o) => ({ ...o, beats }))
  }

  const removeBeat = (idx) => {
    const beats = (outline?.beats || []).filter((_, i) => i !== idx)
    setOutline((o) => ({ ...o, beats: beats.map((b, i) => ({ ...b, order: i + 1 })) }))
  }

  const save = async () => {
    setBusy(true)
    try {
      const saved = await saveBeatOutline(projectId, unitIndex, outline)
      setOutline(saved)
      showToast('节拍大纲已保存')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const writeFromBeats = async () => {
    if (!outline?.beats?.length) {
      showToast('请先添加至少一个节拍', 'error')
      return
    }
    setBusy(true)
    try {
      if (outline !== null) {
        await saveBeatOutline(projectId, unitIndex, outline)
      }
      const plan = await getBeatWritePlan(projectId, unitIndex)
      showToast(`已生成 ${plan.beats_count} 节拍写稿计划，正在跳转工作台…`, 'success')
      navigate(`/projects/${projectId}`, {
        state: {
          pendingWrite: {
            chapter: plan.chapter,
            title: plan.title,
            outline: plan.outline,
          },
        },
      })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <StoryOsPage
      className="story-beats-page"
      projectTitle={project?.title}
      loading={loading}
      loadingLabel="加载节拍大纲…"
    >
      <header className="page-header story-page-intro">
        <div className="page-header-row">
          <div>
            <h2>节拍大纲</h2>
            <p className="hint">结构化节拍驱动创作 · 与 Creator 上下文链对接</p>
          </div>
          <div className="page-header-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={writeFromBeats}
            >
              {busy ? '准备中…' : '一键按节拍写稿'}
            </button>
            <Link to={`/projects/${projectId}`} className="btn btn-ghost btn-sm">前往工作台</Link>
          </div>
        </div>
      </header>

      <section className="card">
        <div className="beats-toolbar">
          <label>
            单元
            <input
              type="number"
              min={1}
              value={unitIndex}
              onChange={(e) => setUnitIndex(Number(e.target.value) || 1)}
              className="input-narrow"
            />
          </label>
          <label className="form-field form-field-grow">
            标题
            <input
              type="text"
              value={outline?.title || ''}
              onChange={(e) => setOutline((o) => ({ ...o, title: e.target.value }))}
            />
          </label>
        </div>
        <label className="form-field">
          <span>单元描述</span>
          <textarea
            rows={2}
            value={outline?.description || ''}
            onChange={(e) => setOutline((o) => ({ ...o, description: e.target.value }))}
          />
        </label>
      </section>

      <section className="card">
        <div className="beats-list-head">
          <h3>节拍列表</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addBeat}>+ 添加节拍</button>
        </div>
        {(outline?.beats || []).map((beat, idx) => (
          <article key={idx} className="beat-card">
            <span className="beat-order">#{beat.order ?? idx + 1}</span>
            <input
              placeholder="节拍标题"
              value={beat.title || ''}
              onChange={(e) => updateBeat(idx, { title: e.target.value })}
            />
            <select
              value={beat.scene_type || 'dialogue'}
              onChange={(e) => updateBeat(idx, { scene_type: e.target.value })}
            >
              {SCENE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <textarea
              rows={2}
              placeholder="节拍描述"
              value={beat.description || ''}
              onChange={(e) => updateBeat(idx, { description: e.target.value })}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeBeat(idx)}>删除</button>
          </article>
        ))}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? '保存中…' : '保存节拍大纲'}
        </button>
      </section>

      <section className="card">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowContext((v) => !v)}
        >
          {showContext ? '隐藏' : '预览'} Creator 上下文链
        </button>
        {showContext && creatorCtx?.prompt && (
          <pre className="creator-context-preview">{creatorCtx.prompt}</pre>
        )}
      </section>
    </StoryOsPage>
  )
}
