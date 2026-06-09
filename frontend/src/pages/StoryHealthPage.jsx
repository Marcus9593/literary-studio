import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getProject,
  getStoryHealth,
  getStoryConsistency,
  getStoryVerify,
  runStoryVerify,
  listChapters,
} from '../api.js'
import StorySubnav from '../components/StorySubnav.jsx'
import PageLoading from '../components/PageLoading.jsx'
import ReviewPanel from '../features/review/ReviewPanel.jsx'
import EngineCriticPanel from '../features/review/EngineCriticPanel.jsx'
import { useToast } from '../components/Toast.jsx'

const STATUS_LABEL = {
  pass: '通过',
  partial: '部分达成',
  fail: '未通过',
}

export default function StoryHealthPage() {
  const { projectId } = useParams()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [health, setHealth] = useState(null)
  const [consistency, setConsistency] = useState(null)
  const [verifyDetail, setVerifyDetail] = useState(null)
  const [chapters, setChapters] = useState([])
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getProject(projectId),
      getStoryHealth(projectId),
      getStoryConsistency(projectId).catch(() => null),
      getStoryVerify(projectId).catch(() => null),
      listChapters(projectId).catch(() => []),
    ])
      .then(([p, h, c, v, ch]) => {
        setProject(p)
        setHealth(h)
        setConsistency(c)
        setVerifyDetail(v)
        setChapters(ch || [])
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const onRunVerify = async () => {
    if (!chapters.length) {
      showToast('尚无章节可验收', 'error')
      return
    }
    const latest = chapters[chapters.length - 1]
    setVerifyBusy(true)
    try {
      const result = await runStoryVerify(projectId, {
        chapter: latest.number ?? chapters.length,
        filename: latest.filename,
      })
      showToast(`验收完成：${STATUS_LABEL[result?.status] || result?.status || '已记录'}`, 'success')
      await load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setVerifyBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page story-health-page">
        <PageLoading label="加载作品质量…" />
      </div>
    )
  }

  const verify = health?.verify
  const recent = verify?.recent || []

  return (
    <div className="page story-health-page">
      <StorySubnav projectTitle={project?.title} />

      <header className="page-header story-page-intro">
        <h2>作品质量</h2>
        <p className="hint">{project?.title} — 审稿、验收与章节评分</p>
      </header>

      <section className="card story-health-review-embed">
        <EngineCriticPanel
          projectId={projectId}
          workType={project?.work_type}
          showToast={showToast}
        />
      </section>

      <section className="card story-health-review-embed">
        <ReviewPanel projectId={projectId} showToast={showToast} variant="embedded" />
      </section>

      {consistency && (
        <section className="card">
          <h3>设定一致性</h3>
          <p className="hint">
            已核对 {consistency.characters_checked} 个角色
            {consistency.locations_checked != null && ` · ${consistency.locations_checked} 个地点`}
            {' · '}扫描最近 {consistency.chapters_scanned} 章
          </p>
          {(consistency.issues || []).length === 0 ? (
            <p className="muted">未发现明显名称缺失问题</p>
          ) : (
            <ul className="consistency-issues">
              {consistency.issues.map((issue) => (
                <li key={issue.name}>{issue.message}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card story-verify-actions">
        <div className="page-header-row">
          <div>
            <h3>创作验收</h3>
            <p className="hint">对最新章节运行验收，通过后自动同步结构化记忆</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={verifyBusy || !chapters.length}
            onClick={onRunVerify}
          >
            {verifyBusy ? '验收中…' : '验收最新章节'}
          </button>
        </div>
        {verifyDetail?.latest && (
          <p className="muted">
            最近验收：{verifyDetail.latest.subject || verifyDetail.latest.kind}
            {' '}({STATUS_LABEL[verifyDetail.latest.status] || verifyDetail.latest.status})
          </p>
        )}
      </section>

      {health && (
        <>
          {verify?.summary && (
            <section className="card story-health-overview">
              <h3>验收统计</h3>
              <p className="health-score">
                {verify.pass_rate != null ? `${verify.pass_rate}%` : '—'}
                <span className="hint" style={{ fontSize: '0.9rem', marginLeft: 8 }}>近次通过率</span>
              </p>
              <p className="hint">
                通过 {verify.summary.pass} · 部分 {verify.summary.partial} · 未通过 {verify.summary.fail}
              </p>
              {verify.latest && (
                <p className="story-goal-hint muted">
                  最近：{verify.latest.message || verify.latest.subject}
                  {' '}
                  ({STATUS_LABEL[verify.latest.status] || verify.latest.status})
                </p>
              )}
            </section>
          )}

          {recent.length > 0 && (
            <section className="card">
              <h3>验收记录</h3>
              <ol className="story-suggestion-list story-today-list">
                {recent.map((v) => (
                  <li key={v.id} className="health-chapter-item">
                    <strong>{STATUS_LABEL[v.status] || v.status}</strong>
                    {' · '}
                    {v.subject || v.kind}
                    {v.created_action_id && (
                      <span className="muted"> · 已生成诊断建议</span>
                    )}
                    {v.metrics_delta && (
                      <p className="hint" style={{ marginTop: 4 }}>
                        结构指标：成长线问题 Δ{v.metrics_delta.arc_with_issues}，
                        冲突缺口 Δ{v.metrics_delta.conflict_with_gap}
                      </p>
                    )}
                    <ul>
                      {(v.checks || []).map((c) => (
                        <li key={c.id} className={c.pass ? '' : 'muted'}>
                          {c.pass ? '✓' : '✗'} {c.label}
                          {c.detail ? ` — ${c.detail}` : ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card story-health-overview">
            <h3>综合质量分</h3>
            <p className="health-score">{health.overall_health ?? '—'}</p>
            <p className="hint">
              人物 {health.kb_stats?.characters} · 关系 {health.kb_stats?.relationships} ·
              伏笔 {health.kb_stats?.foreshadows} · 时间线 {health.kb_stats?.timeline_events}
            </p>
          </section>

          <section className="card">
            <h3>近期章节评分</h3>
            {(health.chapter_scores || []).length === 0 ? (
              <p className="hint" style={{ marginTop: 8 }}>尚无章节可评分</p>
            ) : (
              <div className="health-chapter-list">
                {health.chapter_scores.map((c) => (
                  <article key={c.filename} className="health-chapter-item">
                    <strong>{c.filename}</strong>
                    <span> 综合 {c.overall}</span>
                    <ul>
                      {(c.dimensions || []).map((d) => (
                        <li key={d.name}>{d.name} {d.score}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
