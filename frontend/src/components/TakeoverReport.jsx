import { useEffect, useState } from 'react'
import { getTakeoverReport, updateProject } from '../api.js'
import {
  creationModeOf,
  dismissTakeoverForSession,
  unitLabel,
  workTypeOf,
} from '../lib/projectProfile.js'

export default function TakeoverReport({ projectId, project, onDone, onRunPrompt }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    getTakeoverReport(projectId)
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [projectId])

  const finishForever = async () => {
    try {
      await updateProject(projectId, { onboarding_completed: true })
    } catch {}
    onDone?.()
  }

  const dismissLater = () => {
    dismissTakeoverForSession(projectId)
    onDone?.()
  }

  if (loading) {
    return (
      <div className="takeover-overlay">
        <div className="takeover-card">
          <div className="reader-loading">
            <div className="loading-dots"><span /><span /><span /></div>
            <p>正在分析项目…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="takeover-overlay">
        <div className="takeover-card">
          <p className="error-banner">{error}</p>
          <button type="button" className="btn btn-secondary" onClick={dismissLater}>进入工作台</button>
        </div>
      </div>
    )
  }

  const wt = workTypeOf(report?.project || project)
  const cm = creationModeOf(report?.project || project)
  const u = unitLabel(report?.project || project, 2)
  const stats = report?.stats || {}

  return (
    <div className="takeover-overlay">
      <div className="takeover-card">
        <header className="takeover-header">
          <h2>项目接管报告</h2>
          <p className="muted">
            {wt.label} · {cm.label}
            {report?.project?.rewrite_note ? ` · ${report.project.rewrite_note}` : ''}
          </p>
        </header>

        <div className="takeover-stats">
          <div className="takeover-stat">
            <span className="takeover-stat-num">{stats.manuscript_count || 0}</span>
            <span className="takeover-stat-label">正文{u}</span>
          </div>
          <div className="takeover-stat">
            <span className="takeover-stat-num">{(stats.total_words || 0).toLocaleString()}</span>
            <span className="takeover-stat-label">字</span>
          </div>
          <div className="takeover-stat">
            <span className="takeover-stat-num">{stats.outline_count || 0}</span>
            <span className="takeover-stat-label">大纲</span>
          </div>
          <div className="takeover-stat">
            <span className="takeover-stat-num">{stats.settings_count || 0}</span>
            <span className="takeover-stat-label">设定</span>
          </div>
        </div>

        {report?.latest && (
          <div className="takeover-latest">
            <strong>续写锚点</strong>
            <span>{report.latest.title}</span>
            <span className="muted"> · {report.latest.words} 字</span>
          </div>
        )}

        {report?.gaps?.length > 0 && (
          <section className="takeover-section">
            <h3>待完善</h3>
            <ul className="takeover-gaps">
              {report.gaps.map((g) => (
                <li key={g.id} className={`takeover-gap takeover-gap-${g.level}`}>{g.message}</li>
              ))}
            </ul>
          </section>
        )}

        {report?.suggestions?.length > 0 && (
          <section className="takeover-section">
            <h3>建议下一步</h3>
            <div className="takeover-suggestions">
              {report.suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="takeover-suggestion-btn"
                  onClick={() => {
                    onRunPrompt?.(s.prompt)
                    dismissLater()
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="takeover-footer takeover-footer-actions">
          <button type="button" className="btn btn-ghost" onClick={dismissLater}>
            稍后再看
          </button>
          <button type="button" className="btn btn-secondary" onClick={finishForever}>
            不再提示
          </button>
          <button type="button" className="btn btn-primary" onClick={dismissLater}>
            进入工作台
          </button>
        </footer>
      </div>
    </div>
  )
}
