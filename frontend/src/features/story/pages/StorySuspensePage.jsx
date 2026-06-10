import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProject, listChapters, runNarrativeAnalysis } from '../../../api.js'
import StoryOsPage from '../../../components/StoryOsPage.jsx'
import { useToast } from '../../../components/Toast.jsx'

const LEVEL_LABEL = { low: '\u4f4e', medium: '\u4e2d', high: '\u9ad8', critical: '\u5371' }
const LEVEL_CLASS = { low: 'suspense-low', medium: 'suspense-med', high: 'suspense-high', critical: 'suspense-critical' }
const THREAD_LABEL = {
  mystery: '\u8c1c\u56e2',
  danger: '\u5371\u9669',
  relationship: '\u5173\u7cfb',
  revelation: '\u63ed\u793a',
}

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

  const pressure = analysis?.pressure
  const suspense = analysis?.suspense

  return (
    <StoryOsPage
      className="story-suspense-page"
      projectTitle={project?.title}
      loading={loading}
      loadingLabel={'\u52a0\u8f7d\u60ac\u5ff5\u5206\u6790\u2026'}
    >
      <header className="page-header story-page-intro">
        <h2>{'\u60ac\u5ff5\u5206\u6790'}</h2>
        <p className="hint">{'\u53d9\u4e8b\u538b\u529b\u3001\u5f20\u529b\u66f2\u7ebf\u3001\u672a\u89e3\u7ebf\u7d22\u4e0e\u60ac\u5d16\u5f0f\u7ed3\u5c3e'}</p>
      </header>

      <section className="card">
        <div className="story-suspense-toolbar">
          <label>
            {'\u5206\u6790\u7ae0\u8282'}
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
            {busy ? '\u5206\u6790\u4e2d\u2026' : '\u91cd\u65b0\u5206\u6790'}
          </button>
        </div>
      </section>

      {analysis && (
        <>
          <section className="card story-suspense-overview">
            <div className="suspense-overview-grid">
              <article className={`suspense-stat ${LEVEL_CLASS[suspense?.level] || ''}`}>
                <span className="suspense-stat-label">{'\u60ac\u5ff5\u5f3a\u5ea6'}</span>
                <strong className="suspense-stat-value">{suspense?.intensity?.toFixed(1) ?? '\u2014'}</strong>
                <span className="tag">{LEVEL_LABEL[suspense?.level] || suspense?.level}</span>
              </article>
              <article className="suspense-stat">
                <span className="suspense-stat-label">{'\u53d9\u4e8b\u538b\u529b'}</span>
                <strong className="suspense-stat-value">{pressure?.overall?.toFixed(1) ?? '\u2014'}</strong>
                <span className="muted">{pressure?.state} {'\u00b7'} {pressure?.direction}</span>
              </article>
              <article className="suspense-stat">
                <span className="suspense-stat-label">{'\u60ac\u5ff5\u7ed3\u5c3e'}</span>
                <strong className={suspense?.cliffhanger ? 'text-warn' : 'muted'}>
                  {suspense?.cliffhanger ? '\u662f' : '\u5426'}
                </strong>
              </article>
              <article className="suspense-stat">
                <span className="suspense-stat-label">{'\u672a\u89e3 / \u5df2\u89e3'}</span>
                <strong>{suspense?.open_threads?.length || 0} / {suspense?.resolved?.length || 0}</strong>
              </article>
            </div>
          </section>

          {suspense?.tension_curve?.length > 0 && (
            <section className="card">
              <h3>{'\u5f20\u529b\u66f2\u7ebf'}</h3>
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
              <h3>{'\u5cf0\u503c\u65f6\u523b'}</h3>
              <blockquote className="peak-moment">{suspense.peak_moment}</blockquote>
            </section>
          )}

          {suspense?.threads?.length > 0 && (
            <section className="card">
              <h3>{'\u60ac\u5ff5\u7ebf\u7d22'}</h3>
              <ul className="suspense-thread-list">
                {suspense.threads.map((t, i) => (
                  <li key={i} className={`thread-${t.category}`}>
                    <span className="tag">{THREAD_LABEL[t.category] || t.category}</span>
                    <span>{t.name}</span>
                    <span className="muted">{'\u5f3a\u5ea6'} {t.intensity?.toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {analysis.theme && (
            <section className="card">
              <h3>{'\u4e3b\u9898\u68c0\u6d4b'}</h3>
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
              <h3>{'\u4f0f\u7b14\u626b\u63cf'}</h3>
              <p className="hint">{analysis.foreshadow.summary}</p>
              <ul>
                {(analysis.foreshadow.foreshadows || []).map((f, i) => (
                  <li key={i}>
                    <span className="tag">{f.type === 'setup' ? '\u57cb\u8bbe' : '\u56de\u6536'}</span>
                    {f.element} {'\u2014'} {f.line}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </StoryOsPage>
  )
}
