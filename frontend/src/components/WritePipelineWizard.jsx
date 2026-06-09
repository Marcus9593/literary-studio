import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

const STEPS = [
  { id: 'task', title: '选择今日任务' },
  { id: 'write', title: '进入工作台写稿' },
  { id: 'review', title: '运行审稿' },
]

export default function WritePipelineWizard({
  open,
  onClose,
  tasks = [],
  busy,
  workType,
  onStartTask,
  onGoWrite,
  onRunReview,
  onRunScreenplayPipeline,
}) {
  const isScreenplay = String(workType || '').startsWith('screenplay') || workType === 'web_short'
  const [step, setStep] = useState(0)
  const [selectedTaskId, setSelectedTaskId] = useState('')

  useEffect(() => {
    if (open) {
      setStep(0)
      setSelectedTaskId(tasks[0]?.id || '')
    }
  }, [open, tasks])

  const current = STEPS[step]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="一键写章流水线"
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>关闭</button>
          {step > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => s - 1)}>
              上一步
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={step === 0 && !selectedTaskId}
              onClick={() => setStep((s) => s + 1)}
            >
              下一步
            </button>
          )}
        </>
      )}
    >
      <p className="muted pipeline-wizard-intro">
        引导：选任务 → 写稿 → 审稿。各步可手动控制，不会无人值守自动改稿。
      </p>
      <ol className="pipeline-steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className={i === step ? 'active' : i < step ? 'done' : ''}>
            {s.title}
          </li>
        ))}
      </ol>

      {current.id === 'task' && (
        <div className="pipeline-panel">
          <p>选择要开始的一项今日任务：</p>
          <ul className="pipeline-task-list">
            {tasks.length === 0 ? (
              <li className="muted">暂无任务，请先在上方重建任务或快速同步。</li>
            ) : (
              tasks.map((t) => (
                <li key={t.id}>
                  <label>
                    <input
                      type="radio"
                      name="pipeline-task"
                      checked={selectedTaskId === t.id}
                      onChange={() => setSelectedTaskId(t.id)}
                    />
                    {t.title || t.summary || t.id}
                  </label>
                </li>
              ))
            )}
          </ul>
          {selectedTaskId && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => onStartTask?.(selectedTaskId)}
            >
              启动任务并生成写稿计划
            </button>
          )}
        </div>
      )}

      {current.id === 'write' && (
        <div className="pipeline-panel">
          <p>写稿计划已就绪时，进入工作台对话执行写章；或手动续写当前章节。</p>
          <button type="button" className="btn btn-primary" onClick={onGoWrite}>
            进入工作台
          </button>
        </div>
      )}

      {current.id === 'review' && (
        <div className="pipeline-panel">
          <p>
            完稿后运行规则审稿 + Governor 决策
            {isScreenplay ? '；剧本模式可一键启动编剧室流水线（自动建修订计划，最多 2 轮）。' : '，并同步启发式质量分析。'}
          </p>
          <div className="pipeline-review-actions">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onRunReview}>
              {busy ? '审稿中…' : '规则审稿 + 质量分析'}
            </button>
            {isScreenplay && onRunScreenplayPipeline && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onRunScreenplayPipeline}>
                {busy ? '运行中…' : '编剧室流水线'}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
