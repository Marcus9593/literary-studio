import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getProject,
  listStoryPlans,
  getStoryPlan,
  confirmStoryPlan,
  completeStoryPlan,
} from '../../../api.js'
import StoryOsPage from '../../../components/StoryOsPage.jsx'
import { useToast } from '../../../components/Toast.jsx'

const IMPACT_LABEL = {
  characters: '涉及角色',
  chapters: '涉及章节',
  foreshadows: '涉及伏笔',
  relationships: '涉及关系',
  timeline: '涉及时间线',
  locations: '涉及地点',
  summary: '摘要',
  risk_level: '风险等级',
  estimated_effort: '预估工作量',
}

const STEP_LABEL = {
  type: '操作类型',
  target: '目标',
  description: '描述',
  chapter: '章节',
  action: '动作',
  content: '内容',
}

function formatValue(key, val) {
  if (Array.isArray(val)) {
    return val.length === 0 ? '无' : val.map((v) => (typeof v === 'object' ? v.name || v.title || JSON.stringify(v) : String(v))).join('、')
  }
  if (typeof val === 'object' && val !== null) {
    return val.name || val.title || val.label || JSON.stringify(val)
  }
  return String(val ?? '—')
}

function FormattedPlanDetail({ data, labelMap }) {
  if (!data) return <p className="hint">暂无详细信息</p>

  if (Array.isArray(data)) {
    return (
      <ol className="plan-steps-list">
        {data.map((step, i) => (
          <li key={i} className="plan-step-item">
            {typeof step === 'object' ? (
              <dl className="plan-step-fields">
                {Object.entries(step).map(([k, v]) => (
                  <div key={k} className="plan-step-field">
                    <dt>{labelMap?.[k] || k}</dt>
                    <dd>{formatValue(k, v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <span>{String(step)}</span>
            )}
          </li>
        ))}
      </ol>
    )
  }

  if (typeof data === 'object') {
    return (
      <dl className="plan-impact-fields">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="plan-impact-field">
            <dt>{labelMap?.[k] || k}</dt>
            <dd>{formatValue(k, v)}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return <p>{String(data)}</p>
}

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

  return (
    <StoryOsPage
      className="story-plans-page"
      projectTitle={project?.title}
      loading={loading}
      loadingLabel="加载计划…"
    >
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
              <FormattedPlanDetail
                data={selected.impact || selected.steps}
                labelMap={selected.type === 'story_diff' ? IMPACT_LABEL : STEP_LABEL}
              />
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
    </StoryOsPage>
  )
}
