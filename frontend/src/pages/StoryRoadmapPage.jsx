import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getProject,
  getPlannerBundle,
  getPlannerGoal,
  getPlannerRoadmap,
  generateStoryPlanner,
  updatePlannerPreferences,
} from '../api.js'
import StorySubnav from '../components/StorySubnav.jsx'
import PageLoading from '../components/PageLoading.jsx'
import { useToast } from '../components/Toast.jsx'

const HORIZONS = [5, 10, 20, 50]

const STATUS_LABEL = {
  planned: '计划中',
  in_progress: '进行中',
  done: '已完成',
  skipped: '已跳过',
}

export default function StoryRoadmapPage() {
  const { projectId } = useParams()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [bundle, setBundle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [horizon, setHorizon] = useState(5)

  const load = useCallback(() => {
    setLoading(true)
    return Promise.all([
      getProject(projectId),
      getPlannerBundle(projectId),
      getPlannerGoal(projectId).catch(() => null),
      getPlannerRoadmap(projectId).catch(() => null),
    ])
      .then(([p, b, goal, roadmap]) => {
        setProject(p)
        setBundle({
          ...b,
          story_goal: b?.story_goal || goal,
          chapter_roadmap: b?.chapter_roadmap || roadmap,
        })
        if (b?.preferences?.default_horizon) setHorizon(b.preferences.default_horizon)
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const onGenerate = async () => {
    setGenerating(true)
    try {
      await updatePlannerPreferences(projectId, { default_horizon: horizon })
      await generateStoryPlanner(projectId, horizon)
      showToast('创作路线已生成', 'success')
      await load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="page story-roadmap-page">
        <PageLoading label="加载创作路线…" />
      </div>
    )
  }

  const goal = bundle?.story_goal
  const roadmap = bundle?.chapter_roadmap
  const chapters = roadmap?.chapters || []

  return (
    <div className="page story-roadmap-page">
      <StorySubnav projectTitle={project?.title} />

      <header className="page-header story-page-intro">
        <div className="page-header-row">
          <div>
            <h2>创作路线</h2>
            <p className="hint">故事目标与后续章节规划（基于作品理解与大纲）</p>
          </div>
          <div className="page-header-actions story-roadmap-actions">
            <label className="story-horizon-select">
              <span className="muted">规划跨度</span>
              <select
                className="input input-sm"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              >
                {HORIZONS.map((h) => (
                  <option key={h} value={h}>{h} 章</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={generating}
              onClick={onGenerate}
            >
              {generating ? '生成中…' : goal ? '重新生成路线' : '生成创作路线'}
            </button>
          </div>
        </div>
      </header>

      {!goal ? (
        <section className="card">
          <p className="muted">尚未生成故事目标。点击「生成创作路线」将根据当前正文与大纲规划后续章节。</p>
        </section>
      ) : (
        <>
          <section className="card story-goal-card">
            <h3>故事目标</h3>
            <p className="story-goal-current muted">
              当前：{goal.current_state_summary || `已完成 ${goal.current_chapter || 0} 章`}
            </p>
            <p className="story-goal-target"><strong>目标态：</strong>{goal.target_state}</p>
            {(goal.major_changes || []).length > 0 && (
              <ul className="story-goal-changes">
                {goal.major_changes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {(goal.success_criteria || []).length > 0 && (
              <details className="story-goal-criteria">
                <summary>成功标准</summary>
                <ul>
                  {goal.success_criteria.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {roadmap && (
            <section className="card">
              <div className="story-roadmap-head">
                <h3>章节路线图</h3>
                <span className="muted">
                  第 {roadmap.range?.from}–{roadmap.range?.to} 章 · {roadmap.horizon} 章跨度
                </span>
              </div>
              {roadmap.goal_summary && (
                <p className="story-roadmap-summary">{roadmap.goal_summary}</p>
              )}
              <div className="story-roadmap-grid">
                {chapters.map((ch) => (
                  <article key={ch.chapter} className="story-roadmap-chapter card">
                    <div className="story-roadmap-chapter-head">
                      <strong>第 {ch.chapter} 章</strong>
                      <span className={`story-roadmap-status status-${ch.status || 'planned'}`}>
                        {STATUS_LABEL[ch.status] || ch.status}
                      </span>
                    </div>
                    {ch.title_hint && <p className="muted">{ch.title_hint}</p>}
                    <p>{ch.purpose}</p>
                    {(ch.hooks || []).length > 0 && (
                      <p className="story-roadmap-hooks muted">钩子：{ch.hooks.join('、')}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
