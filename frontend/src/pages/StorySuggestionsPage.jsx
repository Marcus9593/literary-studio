import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getProject,
  getTodaySuggestions,
  getTodayTasks,
  runStorySync,
  startTask,
  rebuildStoryTasks,
  updatePlannerPreferences,
  runMeasurementReview,
  runEngineCritic,
  runAutoPipeline,
} from '../api.js'
import WritePipelineWizard from '../components/WritePipelineWizard.jsx'
import StorySubnav from '../components/StorySubnav.jsx'
import PageLoading from '../components/PageLoading.jsx'
import { useToast } from '../components/Toast.jsx'

const TYPE_LABEL = {
  arc_enhance: '成长线',
  conflict_boost: '冲突',
  foreshadow_payoff: '伏笔',
  plan_chapter: '续写',
}

const HORIZONS = [5, 10, 20, 50]

function formatSyncSummary(result, mode) {
  if (!result) return ''
  const m = result.manifest || {}
  const s = result.stats || {}
  const label = mode === 'deep' ? '全书理解' : '快速同步'
  return `${label}完成：扫描 ${m.chapters_scanned ?? '—'}/${m.chapters_total ?? '—'} 章，`
    + `识别 ${s.arcs ?? 0} 条成长线、${s.conflicts ?? 0} 条冲突，`
    + `生成 ${s.actions ?? 0} 条创作建议。`
}

export default function StorySuggestionsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [todayData, setTodayData] = useState(null)
  const [diagData, setDiagData] = useState(null)
  const [tab, setTab] = useState('today')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMode, setSyncMode] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [busyTaskId, setBusyTaskId] = useState(null)
  const [horizon, setHorizon] = useState(5)
  const [rebuilding, setRebuilding] = useState(false)
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)

  const load = useCallback((opts = {}) => {
    if (!opts.silent) setLoading(true)
    return Promise.all([
      getProject(projectId),
      getTodayTasks(projectId),
      getTodaySuggestions(projectId, 5),
    ])
      .then(([p, today, diag]) => {
        setProject(p)
        setTodayData(today)
        setDiagData(diag)
        if (today?.preferences?.default_horizon) {
          setHorizon(today.preferences.default_horizon)
        }
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => { if (!opts.silent) setLoading(false) })
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const onQuickSync = async () => {
    setSyncing(true)
    setSyncMode('quick')
    try {
      const result = await runStorySync(projectId, 'quick')
      setLastSync({ mode: 'quick', result, at: new Date() })
      showToast(formatSyncSummary(result, 'quick'), 'success')
      await load({ silent: true })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSyncing(false)
      setSyncMode(null)
    }
  }

  const onDeepSync = async () => {
    setSyncing(true)
    setSyncMode('deep')
    try {
      const result = await runStorySync(projectId, 'deep')
      setLastSync({ mode: 'deep', result, at: new Date() })
      if (result.job_id) {
        showToast('全书理解已在后台运行，完成后请刷新页面', 'success')
        setTimeout(() => load({ silent: true }), 4000)
      } else {
        showToast(formatSyncSummary(result, 'deep'), 'success')
        await load({ silent: true })
      }
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSyncing(false)
      setSyncMode(null)
    }
  }

  const onHorizonChange = async (h) => {
    setHorizon(h)
    setRebuilding(true)
    try {
      await updatePlannerPreferences(projectId, { default_horizon: h })
      await rebuildStoryTasks(projectId, h)
      showToast(`已重新规划未来 ${h} 章`, 'success')
      await load({ silent: true })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setRebuilding(false)
    }
  }

  const onStartTask = async (taskId) => {
    setBusyTaskId(taskId)
    try {
      const prep = await startTask(projectId, taskId)
      showToast('正在工作台执行…', 'success')
      if (prep.plan?.type === 'chapter_plan' && prep.plan.chapter != null) {
        navigate(`/projects/${projectId}`, {
          state: {
            pendingWrite: {
              chapter: prep.plan.chapter,
              title: `第${prep.plan.chapter}章`,
              outline: prep.plan.execution_prompt || '',
            },
          },
        })
        return
      }
      navigate(`/projects/${projectId}`, {
        state: {
          pendingPlanExecution: {
            ...prep.plan,
            user_message: prep.user_message,
          },
        },
      })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusyTaskId(null)
    }
  }

  if (loading && !todayData) {
    return (
      <div className="page story-suggestions-page">
        <PageLoading label="加载今日创作…" />
      </div>
    )
  }

  const todayTasks = todayData?.today?.tasks || []
  const totalHours = todayData?.today?.total_hours
  const capacity = todayData?.today?.capacity_minutes
  const roadmapSummary = todayData?.planner_summary?.summary
  const goal = todayData?.story_goal
  const suggestions = diagData?.suggestions || []

  return (
    <div className="page story-suggestions-page">
      <StorySubnav projectTitle={project?.title} />

      <header className="page-header story-page-intro">
        <div className="story-suggestions-head">
          <div>
            <h2>今日创作</h2>
            <p className="hint">
              {project?.title} — 今天写什么 → 为什么写 → 写完去哪
            </p>
          </div>
          <div className="story-sync-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={syncing}
              onClick={() => setPipelineOpen(true)}
            >
              一键写章流水线
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={syncing}
              onClick={onQuickSync}
            >
              {syncing && syncMode === 'quick' ? '同步中…' : '快速同步'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={syncing}
              onClick={onDeepSync}
            >
              {syncing && syncMode === 'deep' ? '分析中…' : '全书理解'}
            </button>
          </div>
        </div>

        {roadmapSummary && (
          <p className="story-roadmap-summary">
            后续章节：{roadmapSummary}
          </p>
        )}

        {goal?.target_state && (
          <p className="story-goal-hint muted">
            创作目标：{goal.current_state_summary?.slice(0, 48)}
            {(goal.current_state_summary?.length || 0) > 48 ? '…' : ''}
            {' → '}
            {goal.target_state.slice(0, 48)}
            {goal.target_state.length > 48 ? '…' : ''}
          </p>
        )}

        <div className="story-horizon-picker">
          <span className="muted">规划范围：</span>
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              className={`btn btn-sm ${horizon === h ? 'btn-primary' : 'btn-ghost'}`}
              disabled={rebuilding}
              onClick={() => onHorizonChange(h)}
            >
              {h} 章
            </button>
          ))}
        </div>

        {lastSync && !syncing && (
          <p className="story-sync-result muted" role="status">
            {formatSyncSummary(lastSync.result, lastSync.mode)}
          </p>
        )}
      </header>

      <div className="story-today-tabs">
        <button
          type="button"
          className={tab === 'today' ? 'active' : ''}
          onClick={() => setTab('today')}
        >
          今日任务
        </button>
        <button
          type="button"
          className={tab === 'diag' ? 'active' : ''}
          onClick={() => setTab('diag')}
        >
          诊断改稿
        </button>
      </div>

      {tab === 'today' && (
        <>
          {todayTasks.length === 0 ? (
            <section className="card story-suggestions-empty">
              <p>暂无今日任务。请先快速同步，或选择上方规划范围生成创作路线。</p>
            </section>
          ) : (
            <>
              <p className="story-today-meta">
                预计今日 <strong>{totalHours}</strong> 小时
                （日程容量 {capacity} 分钟，待办共 {todayData?.tasks_total_todo ?? '—'} 项）
              </p>
              <ol className="story-suggestion-list story-today-list">
                {todayTasks.map((task, i) => (
                  <li key={task.id} className="card story-suggestion-card">
                    <div className="story-suggestion-index">{i + 1}</div>
                    <div className="story-suggestion-body">
                      <div className="story-suggestion-meta">
                        <span className="story-suggestion-type">
                          {task.type === 'write_chapter' ? '写章' : '改稿'}
                        </span>
                        <span className="story-suggestion-impact">
                          约 {task.estimate_minutes} 分钟
                        </span>
                      </div>
                      <h3>{task.title}</h3>
                      {task.purpose && (
                        <p className="story-suggestion-proposal">{task.purpose}</p>
                      )}
                      <div className="story-suggestion-actions">
                        <button
                          type="button"
                          className="btn btn-primary story-suggestion-cta"
                          disabled={busyTaskId === task.id}
                          onClick={() => onStartTask(task.id)}
                        >
                          {busyTaskId === task.id ? '启动中…' : '开始'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}

      {tab === 'diag' && (
        suggestions.length === 0 ? (
          <section className="card story-suggestions-empty">
            <p>暂无诊断建议。请先快速同步。</p>
          </section>
        ) : (
          <ol className="story-suggestion-list">
            {suggestions.map((item, i) => (
              <li key={item.id} className="card story-suggestion-card">
                <div className="story-suggestion-index">{i + 1}</div>
                <div className="story-suggestion-body">
                  <div className="story-suggestion-meta">
                    <span className="story-suggestion-type">
                      {TYPE_LABEL[item.type] || '建议'}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="story-suggestion-diagnosis">{item.diagnosis}</p>
                  <p className="story-suggestion-proposal">{item.proposal}</p>
                </div>
              </li>
            ))}
          </ol>
        )
      )}

      <WritePipelineWizard
        open={pipelineOpen}
        onClose={() => setPipelineOpen(false)}
        tasks={todayTasks}
        workType={project?.work_type}
        busy={!!busyTaskId || reviewBusy}
        onStartTask={async (taskId) => {
          await onStartTask(taskId)
          setPipelineOpen(false)
        }}
        onGoWrite={() => {
          setPipelineOpen(false)
          navigate(`/projects/${projectId}`)
        }}
        onRunReview={async () => {
          setReviewBusy(true)
          try {
            const engine = await runEngineCritic(projectId)
            await runMeasurementReview(projectId)
            const decision = engine?.governor?.decision || ''
            const hint = decision === 'APPROVE'
              ? '规则审稿：通过'
              : decision === 'REVISE'
                ? '规则审稿：建议修订'
                : decision === 'REJECT'
                  ? '规则审稿：建议重写'
                  : '规则审稿完成'
            showToast(`${hint}，请查看「作品质量」`, 'success')
            navigate(`/projects/${projectId}/health`)
          } catch (e) {
            showToast(e.message, 'error')
          } finally {
            setReviewBusy(false)
            setPipelineOpen(false)
          }
        }}
        onRunScreenplayPipeline={async () => {
          setReviewBusy(true)
          try {
            const res = await runAutoPipeline(projectId)
            await runMeasurementReview(projectId).catch(() => null)
            const plan = res?.followup?.plan
            const decision = res?.governor?.decision || ''
            if (plan?.id) {
              showToast(`Governor ${decision} · 已生成修订计划 #${plan.id}`, 'success')
              navigate(`/projects/${projectId}/plans`)
            } else {
              showToast(`编剧室流水线完成（${decision || '—'}）`, 'success')
              navigate(`/projects/${projectId}/health`)
            }
          } catch (e) {
            showToast(e.message, 'error')
          } finally {
            setReviewBusy(false)
            setPipelineOpen(false)
          }
        }}
      />
    </div>
  )
}
