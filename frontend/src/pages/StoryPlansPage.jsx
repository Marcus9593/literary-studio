import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getProject,
  listStoryPlans,
  getStoryPlan,
  confirmStoryPlan,
  completeStoryPlan,
} from '../api.js'
import StorySubnav from '../components/StorySubnav.jsx'
import PageLoading from '../components/PageLoading.jsx'
import { useToast } from '../components/Toast.jsx'

const STATUS_LABEL = {
  pending_confirm: '待确认',
  executing: '执行中',
  completed: '已完成',
}

export default function StoryPlansPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [plans, setPlans] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getProject(projectId), listStoryPlans(projectId)])
      .then(([p, r]) => {
        setProject(p)
        setPlans(r.plans || [])
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const openPlan = (id) => {
    getStoryPlan(projectId, id).then(setSelected).catch((e) => showToast(e.message, 'error'))
  }

  const runConfirm = async () => {
    if (!selected?.id) return
    setBusy(true)
    try {
      const prep = await confirmStoryPlan(projectId, selected.id)
      showToast('计划已确认，正在工作台执行…', 'success')
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
      setBusy(false)
    }
  }

  const runComplete = async () => {
    if (!selected?.id) return
    setBusy(true)
    try {
      const result = await completeStoryPlan(projectId, selected.id)
      const v = result?.verify
      const pc = result?.pipeline_continue
      const actionHint = result?.created_action_id ? '，已生成诊断建议' : ''
      let pipelineHint = ''
      if (pc?.followup?.plan?.id) {
        pipelineHint = ` · 编剧室第 ${pc.revision_count} 轮，已生成新修订计划 #${pc.followup.plan.id}`
      } else if (pc?.stopped && pc.reason === 'approved') {
        pipelineHint = ' · 编剧室流水线：Governor 已通过'
      } else if (pc?.stopped && pc.reason === 'max_revisions') {
        pipelineHint = ' · 已达修订上限（2 轮）'
      }
      if (v?.status === 'fail') {
        showToast((v.message || '计划已完成，但验收未通过') + actionHint + pipelineHint, 'error')
      } else if (v?.status === 'partial') {
        showToast((v.message || '计划已完成，建议人工复核') + actionHint + pipelineHint, 'info')
      } else {
        showToast((v.message || '计划已完成并通过验收') + actionHint + pipelineHint, 'success')
      }
      if (pc?.followup?.plan?.id) {
        openPlan(pc.followup.plan.id)
      }
      load()
      setSelected(null)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page story-plans-page">
        <PageLoading label="加载计划…" />
      </div>
    )
  }

  return (
    <div className="page story-plans-page">
      <StorySubnav projectTitle={project?.title} />

      <header className="page-header story-page-intro">
        <h2>修改计划中心</h2>
        <p className="hint">
          在对话中说「删除男二」「提高第十章冲突感」等，系统会生成影响分析与执行计划，确认后再由 Claude 改稿。
        </p>
      </header>

      <div className="story-plans-layout">
        <aside className="card story-plans-list">
          <h3>计划列表</h3>
          {plans.length === 0 ? (
            <p className="hint" style={{ marginTop: 12 }}>暂无计划</p>
          ) : (
            <ul>
              {plans.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`btn btn-ghost btn-sm ${selected?.id === p.id ? 'active' : ''}`}
                    onClick={() => openPlan(p.id)}
                  >
                    <span>
                      {p.source === 'engine_revision' ? '编剧室' : p.type === 'rewrite' ? '改稿' : '修改'}
                    </span>
                    <span className="plan-detail">{p.summary?.slice(0, 28) || p.id}</span>
                    <span className="plan-status">{STATUS_LABEL[p.status] || p.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="card story-plan-detail">
          {selected ? (
            <>
              <h3>{selected.type === 'story_diff' ? '修改影响分析' : '改稿计划'}</h3>
              <p>{selected.summary}</p>
              <pre>{JSON.stringify(selected.impact || selected.steps, null, 2)}</pre>
              <div className="btn-row">
                {selected.status === 'pending_confirm' && (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={runConfirm}>
                    确认并在工作台执行
                  </button>
                )}
                {selected.status === 'executing' && (
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={runComplete}>
                    标记完成
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="hint">选择左侧计划查看影响范围与执行步骤</p>
          )}
        </section>
      </div>
    </div>
  )
}
