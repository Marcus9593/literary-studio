import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProject, listChapters, runNarrativeAnalysis } from '../api.js'
import StorySubnav from '../components/StorySubnav.jsx'
import PageLoading from '../components/PageLoading.jsx'
import { useToast } from '../components/Toast.jsx'

const LEVEL_LABEL = { low: '低', medium: '中', high: '高', critical: '危' }
const LEVEL_CLASS = { low: 'suspense-low', medium: 'suspense-med', high: 'suspense-high', critical: 'suspense-critical' }
const THREAD_LABEL = { mystery: '谜团', danger: '危险', relationship: '关系', revelation: '揭示' }

function intensityColor(v) {
  if (v >= 80) return '#ff4d4f'
  if (v >= 60) return '#fa8c16'
  if (v >= 30) return '#faad14'
  return '#d9d9d9'
}

export default function StorySuspensePage() {
  const { projectId } = useParams()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [chapters, setChapters] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const debounceRef = useRef(null)
  const analyzeRef = useRef(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getProject(projectId), listChapters(projectId)])
      .then(([p, ch]) => {
        setProject(p)
        const list = ch || []
        setChapters(list)
        if (list.length) {
          setSelectedFile((prev) => prev || list[list.length - 1].filename)
        }
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const analyze = useCallback(async (filename) => {
    const file = filename
    if (!file) return
    setBusy(true)
    try {
      const ch = chapters.find((c) => c.filename === file)
      const res = await runNarrativeAnalysis(projectId, {
        filename: file,
        unit_index: ch?.number ?? 1,
      })
      setAnalysis(res)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }, [projectId, chapters, showToast])

  analyzeRef.current = analyze

  useEffect(() => {
    if (!selectedFile || loading || !chapters.length) return undefined
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      analyzeRef.current?.(selectedFile)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [selectedFile, loading, chapters.length])

  if (loading) {
    return (
      <div className="page story-suspense-page">
        <PageLoading label="加载悬念分析…" />
      </div>
    )
  }

  const pressure = analysis?.pressure
  const suspense = analysis?.suspense

  return (
    <div className="page story-suspense-page">
      <StorySubnav projectTitle={project?.title} />

      <header className="page-header story-page-intro">
        <h2>悬念分析</h2>
        <p className="hint">叙事压力、张力曲线、未解线索与悬崖式结尾</p>
      </header>

      <section className="card">
        <div className="story-suspense-toolbar">
          <label>
            分析章节
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="select"
            >
              {chapters.map((c) => (
                <option key={c.filename} value={c.filename}>
                  {c.title || c.filename}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => analyze()}>
            {busy ? '分析中…' : '重新分析'}
          </button>
        </div>
      </section>

      {analysis && (
        <>
          <section className="card story-suspense-overview">
            <div className="suspense-overview-grid">
              <article className={`suspense-stat ${LEVEL_CLASS[suspense?.level] || ''}`}>
                <span className="suspense-stat-label">悬念强度</span>
                <strong className="suspense-stat-value">{suspense?.intensity?.toFixed(1) ?? '—'}</strong>
                <span className="tag">{LEVEL_LABEL[suspense?.level] || suspense?.level}</span>
              </article>
              <article className="suspense-stat">
                <span className="suspense-stat-label">叙事压力</span>
                <strong className="suspense-stat-value">{pressure?.overall?.toFixed(1) ?? '—'}</strong>
                <span className="muted">{pressure?.state} · {pressure?.direction}</span>
              </article>
              <article className="suspense-stat">
                <span className="suspense-stat-label">悬念结尾</span>
                <strong className={suspense?.cliffhanger ? 'text-warn' : 'muted'}>
                  {suspense?.cliffhanger ? '是' : '否'}
                </strong>
              </article>
              <article className="suspense-stat">
                <span className="suspense-stat-label">未解 / 已解</span>
                <strong>{suspense?.open_threads?.length || 0} / {suspense?.resolved?.length || 0}</strong>
              </article>
            </div>
          </section>

          {suspense?.tension_curve?.length > 0 && (
            <section className="card">
              <h3>张力曲线</h3>
              <div className="tension-curve">
                {suspense.tension_curve.map((v, i) => (
                  <div key={i} className="tension-bar-wrap">
                    <div className="tension-bar" style={{ height: `${v}%`, background: intensityColor(v) }} />
                    <span className="tension-bar-label">{i + 1}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {suspense?.peak_moment && (
            <section className="card">
              <h3>峰值时刻</h3>
              <blockquote className="peak-moment">{suspense.peak_moment}</blockquote>
            </section>
          )}

          {suspense?.threads?.length > 0 && (
            <section className="card">
              <h3>悬念线索</h3>
              <ul className="suspense-thread-list">
                {suspense.threads.map((t, i) => (
                  <li key={i} className={`thread-${t.category}`}>
                    <span className="tag">{THREAD_LABEL[t.category] || t.category}</span>
                    <span>{t.name}</span>
                    <span className="muted">强度 {t.intensity?.toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {analysis.theme && (
            <section className="card">
              <h3>主题检测</h3>
              <p className="hint">{analysis.theme.summary}</p>
              <div className="theme-tags">
                {(analysis.theme.detected_themes || []).map((t) => (
                  <span key={t.theme} className="tag">{t.theme} ({t.strength?.toFixed(1)})</span>
                ))}
              </div>
            </section>
          )}

          {analysis.foreshadow && (
            <section className="card">
              <h3>伏笔扫描</h3>
              <p className="hint">{analysis.foreshadow.summary}</p>
              <ul>
                {(analysis.foreshadow.foreshadows || []).map((f, i) => (
                  <li key={i}>
                    <span className="tag">{f.type === 'setup' ? '埋设' : '回收'}</span>
                    {f.element} — {f.line}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
