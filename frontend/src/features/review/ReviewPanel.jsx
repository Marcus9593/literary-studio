import { useCallback, useEffect, useState } from 'react'
import { getMeasurementReview, runMeasurementReview, runEngineCritic } from '../../api.js'

export default function ReviewPanel({ projectId, showToast, variant = 'global' }) {
  const [reviewChecks, setReviewChecks] = useState([])
  const [reviewHints, setReviewHints] = useState([])
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(false)

  const loadReview = useCallback(async () => {
    if (!projectId) {
      setReviewChecks([])
      setReviewHints([])
      return
    }
    setLoading(true)
    try {
      const review = await getMeasurementReview(projectId)
      setReviewChecks(review?.checks || [])
      setReviewHints(review?.hints || [])
    } catch (err) {
      showToast(err.message || '加载审稿数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [projectId, showToast])

  useEffect(() => {
    loadReview()
  }, [loadReview])

  const runReview = async () => {
    if (!projectId) {
      showToast('请先选择项目', 'error')
      return
    }
    setBusy('review')
    try {
      try {
        await runEngineCritic(projectId)
      } catch (criticErr) {
        showToast(criticErr.message || '规则审稿失败（将继续启发式分析）', 'error')
      }
      const res = await runMeasurementReview(projectId)
      setReviewChecks(res?.checks || [])
      setReviewHints(res?.hints || [])
      showToast('启发式分析完成', 'success')
    } catch (err) {
      showToast(err.message || '审稿分析失败', 'error')
    } finally {
      setBusy('')
    }
  }

  if (!projectId) {
    return (
      <section className="studio-panel">
        <p className="muted">请先创建或选择一个项目。</p>
      </section>
    )
  }

  return (
    <section className="studio-panel">
      <div className="studio-block">
        <div className="studio-block-head">
          <h3>启发式审稿</h3>
          <div className="studio-head-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy === 'review' || loading}
              onClick={runReview}
            >
              {busy === 'review' ? '分析中…' : '运行审稿分析'}
            </button>
          </div>
        </div>
        <p className="muted">
          基于当前项目最新正文做启发式分析（节奏、人设素材、伏笔标记、AI 套话）。
          {variant === 'global'
            ? ' 规则审稿与 Governor 见上方；完整验收与章节评分请进入项目 → 作品质量。'
            : ' 与上方规则审稿面板配合使用。'}
        </p>
        {loading ? (
          <p className="muted">加载中…</p>
        ) : (
          <div className="studio-review-grid">
            {reviewChecks.map((c) => (
              <article key={c.key}>
                <strong>{c.key}</strong>
                <span>{c.status === 'done' ? `${c.score} 分` : '待分析'}</span>
              </article>
            ))}
          </div>
        )}
        {reviewHints.length > 0 && (
          <div className="studio-hints-card">
            <h4>审稿建议</h4>
            <ul>
              {reviewHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
