import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTodayTasks } from '../api.js'
import { inferWritingPhase, roadmapProgress } from '../lib/writingPhase.js'
import { unitLabel } from '../lib/projectProfile.js'

export default function CreativeProgressCard({ projectId, project, chapters = [], compact = false }) {
  const [todayData, setTodayData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return undefined
    let cancelled = false
    setLoading(true)
    getTodayTasks(projectId)
      .then((d) => { if (!cancelled) setTodayData(d) })
      .catch(() => { if (!cancelled) setTodayData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  if (!project) return null

  const count = chapters.length
  const u = unitLabel(project, count || 1)
  const phase = inferWritingPhase(project, count)
  const { done, planned, percent } = roadmapProgress(count, todayData?.roadmap)
  const todoToday = todayData?.today?.tasks?.length ?? 0
  const todoTotal = todayData?.tasks_total_todo ?? 0
  const words = project.stats?.total_words ?? chapters.reduce((s, c) => s + (c.words || 0), 0)

  return (
    <section className={`creative-progress-card ${compact ? 'creative-progress-card-compact' : ''}`} aria-label="创作进度">
      <div className="creative-progress-head">
        <div>
          <span className="creative-progress-phase">{phase.label}</span>
          <p className="creative-progress-hint muted">{phase.hint}</p>
        </div>
        <Link to={`/projects/${projectId}/suggestions`} className="btn btn-sm btn-secondary">
          今日建议
        </Link>
      </div>

      <div className="creative-progress-metrics">
        <div className="creative-progress-metric">
          <span className="creative-progress-metric-label">正文进度</span>
          <strong>
            {loading ? '…' : planned
              ? `${done} / ${planned} ${u}`
              : `${done} ${u}`}
          </strong>
        </div>
        <div className="creative-progress-metric">
          <span className="creative-progress-metric-label">累计字数</span>
          <strong>{words > 0 ? words.toLocaleString() : '—'}</strong>
        </div>
        <div className="creative-progress-metric">
          <span className="creative-progress-metric-label">今日待办</span>
          <strong>{loading ? '…' : `${todoToday} / ${todoTotal || todoToday || 0}`}</strong>
        </div>
      </div>

      {percent != null && (
        <div className="creative-progress-bar-wrap" title={`路线完成约 ${percent}%`}>
          <div className="creative-progress-bar" style={{ width: `${percent}%` }} />
          <span className="creative-progress-bar-label muted">路线约 {percent}%</span>
        </div>
      )}
    </section>
  )
}
