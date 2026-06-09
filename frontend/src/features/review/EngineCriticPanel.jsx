import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getEngineLatest,
  runEngineCritic,
  runEngineCriticFull,
  runLlmCritic,
  runAutoPipeline,
  createActionPlan,
  listEngineCriticReports,
  extractSelfReview,
} from '../../api.js'

const GOV_LABEL = {
  APPROVE: '通过',
  REVISE: '建议修订',
  REJECT: '建议重写',
}

const DIM_LABEL = {
  structure: '结构',
  character: '角色',
  scene: '场景',
  pressure: '叙事压力',
  voice: '声音/对白',
  continuity: '连续性/主题',
}

const LEVEL_CLASS = {
  HARD: 'engine-level-hard',
  SOFT: 'engine-level-soft',
  PASS: 'engine-level-pass',
}

function pickReportPayload(reportRow) {
  if (!reportRow?.report) return null
  const r = reportRow.report
  return {
    governor: r.governor_decision || {},
    professional: r.professional_review || {},
    critic: r.critic_report || {},
    canon: r.canon_validation || null,
    engine_analysis: r.engine_analysis || null,
    llm_critic: r.llm_critic || null,
    workspace_ref: reportRow.workspace_ref,
    unit_index: reportRow.unit_index,
    created_at: reportRow.created_at,
    report_id: reportRow.id,
  }
}

export default function EngineCriticPanel({ projectId, workType, showToast }) {
  const [latest, setLatest] = useState(null)
  const [pipeline, setPipeline] = useState(null)
  const [followup, setFollowup] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [selfReviewText, setSelfReviewText] = useState('')
  const [selfReviewResult, setSelfReviewResult] = useState(null)

  const isScreenplay = String(workType || '').startsWith('screenplay') || workType === 'web_short'

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await getEngineLatest(projectId)
      setLatest(pickReportPayload(data?.latest_report))
      setPipeline(data?.latest_pipeline || null)
      setFollowup(null)
    } catch (err) {
      showToast?.(err.message || '加载规则审稿失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const loadHistory = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await listEngineCriticReports(projectId)
      setHistory(data?.reports || [])
    } catch (err) {
      showToast?.(err.message || '加载审稿历史失败', 'error')
    }
  }, [projectId, showToast])

  useEffect(() => {
    if (showHistory) loadHistory()
  }, [showHistory, loadHistory])

  const onExtractSelfReview = async () => {
    if (!selfReviewText.trim()) return
    setBusy('self-review')
    try {
      const res = await extractSelfReview(projectId, selfReviewText)
      setSelfReviewResult(res)
      showToast?.('已提取自评标签', 'success')
    } catch (err) {
      showToast?.(err.message || '提取失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const applyResult = (res) => {
    if (res?.critic) {
      setLatest({
        governor: res.governor,
        professional: res.critic.professional_review,
        critic: res.critic.critic_report,
        canon: res.canon_validation,
        engine_analysis: res.engine_analysis,
        llm_critic: res.llm_critic,
        workspace_ref: res.workspace_ref,
        unit_index: res.unit_index,
        created_at: new Date().toISOString(),
        report_id: res.report_id,
      })
    }
    if (res?.pipeline) setPipeline(res.pipeline)
    if (res?.followup) setFollowup(res.followup)
  }

  const onRunCritic = async () => {
    setBusy('critic')
    try {
      const res = await runEngineCritic(projectId)
      applyResult(res)
      showToast?.('规则审稿完成', 'success')
    } catch (err) {
      showToast?.(err.message || '规则审稿失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onRunLlmCritic = async () => {
    setBusy('llm')
    try {
      const res = await runLlmCritic(projectId)
      if (res?.skipped) {
        showToast?.(res.reason || '语义审稿未启用', 'error')
        return
      }
      setLatest((prev) => ({ ...(prev || {}), llm_critic: res }))
      showToast?.('语义审稿完成', 'success')
    } catch (err) {
      showToast?.(err.message || '语义审稿失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onRunCriticFull = async () => {
    setBusy('full')
    try {
      const res = await runEngineCriticFull(projectId)
      applyResult(res)
      if (res?.llm_critic?.skipped) {
        showToast?.(`规则审稿完成；语义层：${res.llm_critic.reason}`, 'success')
      } else {
        showToast?.('规则 + 语义审稿完成', 'success')
      }
    } catch (err) {
      showToast?.(err.message || '审稿失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onRunPipeline = async () => {
    setBusy('pipeline')
    try {
      const res = await runAutoPipeline(projectId)
      applyResult(res)
      const plan = res?.followup?.plan
      if (plan?.id) {
        showToast?.(`编剧室流水线完成，已生成修订计划 #${plan.id}`, 'success')
      } else {
        showToast?.('编剧室流水线完成', 'success')
      }
    } catch (err) {
      showToast?.(err.message || '流水线失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onActionToPlan = async (actionId) => {
    setBusy(`plan-${actionId}`)
    try {
      const plan = await createActionPlan(projectId, actionId)
      showToast?.(`已生成计划 #${plan.id}`, 'success')
      setFollowup((f) => ({ ...f, plan }))
    } catch (err) {
      showToast?.(err.message || '生成计划失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const gov = latest?.governor
  const prof = latest?.professional || {}
  const critic = latest?.critic || {}
  const engine = latest?.engine_analysis
  const llm = latest?.llm_critic
  const llmProf = llm?.professional_review
  const plan = followup?.plan

  return (
    <section className="studio-panel engine-critic-panel">
      <div className="studio-block">
        <div className="studio-block-head">
          <h3>规则审稿 · Governor</h3>
          <div className="studio-head-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!!busy || loading}
              onClick={onRunCritic}
            >
              {busy === 'critic' ? '审稿中…' : '规则审稿'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!!busy || loading}
              onClick={onRunLlmCritic}
            >
              {busy === 'llm' ? '语义审稿中…' : '语义审稿'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!!busy || loading}
              onClick={onRunCriticFull}
            >
              {busy === 'full' ? '运行中…' : '规则+语义'}
            </button>
            {isScreenplay && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!!busy || loading}
                onClick={onRunPipeline}
              >
                {busy === 'pipeline' ? '运行中…' : '编剧室流水线'}
              </button>
            )}
          </div>
        </div>
        <p className="muted">
          离线规则引擎 + Governor；语义审稿需 AI 中心 HTTP 模型。
          {isScreenplay ? ' 剧本模式支持自动修订计划（最多 2 轮）。' : ' 修订建议会写入「诊断建议」。'}
        </p>

        {loading ? (
          <p className="muted">加载中…</p>
        ) : !latest ? (
          <p className="muted">尚无规则审稿记录，请先运行审稿。</p>
        ) : (
          <>
            <div className="engine-governor-banner">
              <strong>Governor：{GOV_LABEL[gov?.decision] || gov?.decision || '—'}</strong>
              {gov?.revision_memo && (
                <p className="hint">{gov.revision_memo}</p>
              )}
              {latest.workspace_ref && (
                <p className="muted">
                  文稿 {latest.workspace_ref}
                  {latest.unit_index != null ? ` · 单元 ${latest.unit_index}` : ''}
                </p>
              )}
              {pipeline && (
                <p className="muted">
                  流水线 #{pipeline.id} · 修订 {pipeline.revision_count}/{pipeline.max_revisions ?? 2}
                </p>
              )}
            </div>

            <div className="studio-review-grid engine-dimension-grid">
              {Object.entries(DIM_LABEL).map(([key, label]) => {
                const dim = critic[key] || {}
                return (
                  <article key={key} className={LEVEL_CLASS[dim.level] || ''}>
                    <strong>{label}</strong>
                    <span>{dim.level || '—'} {dim.score != null ? `· ${dim.score}` : ''}</span>
                    {dim.details && <p className="hint">{dim.details}</p>}
                  </article>
                )
              })}
            </div>

            {engine && (
              <div className="studio-hints-card engine-analysis-card">
                <h4>叙事引擎分析</h4>
                <div className="engine-analysis-grid">
                  {engine.pressure && (
                    <article>
                      <strong>叙事压力</strong>
                      <span>{engine.pressure.overall}/10 · {engine.pressure.state}</span>
                      <p className="hint">悬念 {engine.pressure.suspense} · 情绪 {engine.pressure.emotion} · 节奏 {engine.pressure.pacing}</p>
                    </article>
                  )}
                  {engine.suspense && (
                    <article>
                      <strong>悬念</strong>
                      <span>{engine.suspense.intensity}/10 · {engine.suspense.level}</span>
                      {engine.suspense.cliffhanger && <p className="hint">本单元结尾留有悬念</p>}
                    </article>
                  )}
                  {engine.theme && (
                    <article>
                      <strong>主题</strong>
                      <span>{engine.theme.score}/10 · {engine.theme.level}</span>
                      <p className="hint">{engine.theme.summary}</p>
                    </article>
                  )}
                  {engine.character_arc && (
                    <article>
                      <strong>角色弧线</strong>
                      <span>{engine.character_arc.score}/10 · {engine.character_arc.level}</span>
                      <p className="hint">{engine.character_arc.summary}</p>
                    </article>
                  )}
                  {engine.foreshadow && (
                    <article>
                      <strong>伏笔</strong>
                      <span>{engine.foreshadow.score}/10</span>
                      <p className="hint">{engine.foreshadow.summary}</p>
                    </article>
                  )}
                </div>
                {engine.voice_issues?.length > 0 && (
                  <ul className="engine-voice-issues">
                    {engine.voice_issues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                )}
              </div>
            )}

            {llm && !llm.skipped && (
              <div className="studio-hints-card engine-llm-card">
                <h4>语义审稿 {llm.model ? `· ${llm.model}` : ''}</h4>
                {llmProf?.verdict && (
                  <p><strong>判定：</strong>{GOV_LABEL[llmProf.verdict] || llmProf.verdict}</p>
                )}
                {llmProf?.summary && (
                  <pre className="engine-summary-pre">{llmProf.summary}</pre>
                )}
                {(llmProf?.hard_issues?.length > 0 || llmProf?.soft_issues?.length > 0) && (
                  <ul>
                    {(llmProf.hard_issues || []).map((i, idx) => (
                      <li key={`lh-${idx}`} className="engine-level-hard">
                        [严重] {i.dimension || ''}：{i.problem}
                      </li>
                    ))}
                    {(llmProf.soft_issues || []).map((i, idx) => (
                      <li key={`ls-${idx}`} className="engine-level-soft">
                        [轻微] {i.dimension || ''}：{i.problem}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {prof.summary && (
              <div className="studio-hints-card">
                <h4>规则审稿摘要</h4>
                <pre className="engine-summary-pre">{prof.summary}</pre>
              </div>
            )}

            {(prof.hard_issues?.length > 0 || prof.soft_issues?.length > 0) && (
              <div className="studio-hints-card">
                <h4>问题清单</h4>
                <ul>
                  {(prof.hard_issues || []).map((i) => (
                    <li key={`h-${i.rule}-${i.problem}`} className="engine-level-hard">
                      [严重] {i.rule}：{i.problem}
                    </li>
                  ))}
                  {(prof.soft_issues || []).map((i) => (
                    <li key={`s-${i.rule}-${i.problem}`} className="engine-level-soft">
                      [轻微] {i.rule}：{i.problem}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(followup?.actions?.length > 0 || prof.revision_tasks?.length > 0) && (
              <div className="studio-hints-card">
                <h4>修订任务</h4>
                <ol>
                  {(prof.revision_tasks || []).map((t) => (
                    <li key={`t-${t.priority}-${t.target}`}>
                      <strong>{t.target}</strong> — {t.action}
                      <span className="muted"> ({t.reason})</span>
                    </li>
                  ))}
                </ol>
                {(followup?.actions || []).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!!busy}
                    onClick={() => onActionToPlan(a.id)}
                  >
                    将「{a.title}」转为计划
                  </button>
                ))}
              </div>
            )}

            {plan?.id && (
              <p className="engine-plan-link">
                已生成修订计划{' '}
                <Link to={`/projects/${projectId}/plans`}>#{plan.id} · 前往修改计划</Link>
              </p>
            )}

            {latest?.canon?.message && (
              <div className="studio-hints-card">
                <h4>Canon 校验</h4>
                <p className={latest.canon.action === 'block' ? 'engine-level-hard' : 'hint'}>
                  {latest.canon.message}
                </p>
              </div>
            )}
          </>
        )}

        <div className="studio-hints-card engine-self-review-card">
          <h4>自评提取</h4>
          <p className="hint">粘贴 AI 输出中的自评段落，提取结构化标签</p>
          <textarea
            rows={3}
            className="input"
            value={selfReviewText}
            onChange={(e) => setSelfReviewText(e.target.value)}
            placeholder="粘贴含自评/反思的 AI 输出…"
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!!busy || !selfReviewText.trim()}
            onClick={onExtractSelfReview}
          >
            {busy === 'self-review' ? '提取中…' : '提取自评'}
          </button>
          {selfReviewResult && (
            <pre className="engine-summary-pre">{JSON.stringify(selfReviewResult, null, 2)}</pre>
          )}
        </div>

        <div className="engine-history-block">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? '隐藏审稿历史' : '查看审稿历史'}
          </button>
          {showHistory && (
            <ul className="critic-report-list">
              {history.map((row) => (
                <li key={row.id} className="critic-report-item">
                  <strong>#{row.id}</strong>
                  {' '}
                  <span className="muted">{row.scoring_method}</span>
                  {' · '}
                  单元 {row.unit_index}
                  {' · '}
                  {row.created_at?.slice(0, 19)}
                </li>
              ))}
              {!history.length && <li className="muted">暂无历史记录</li>}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
