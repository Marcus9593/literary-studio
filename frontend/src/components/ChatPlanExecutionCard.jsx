export default function ChatPlanExecutionCard({ plan }) {
  if (!plan) return null
  const steps = plan.steps || []

  return (
    <div className="chat-plan-exec-card">
      <div className="chat-plan-exec-head">
        <span className="chat-plan-exec-badge">
          {plan.type === 'chapter_plan'
            ? '写章任务'
            : plan.type === 'story_diff'
              ? '修改计划'
              : '改稿任务'}
        </span>
        <strong>{plan.summary || plan.user_request}</strong>
      </div>
      {steps.length > 0 && (
        <ol className="chat-plan-exec-steps">
          {steps.map((s) => (
            <li key={s.step}>
              <span>{s.action}</span>
              {s.detail && <span className="muted"> — {s.detail}</span>}
            </li>
          ))}
        </ol>
      )}
      {plan.execution_prompt && (
        <details className="chat-plan-exec-prompt">
          <summary>查看发给 AI 的执行指令</summary>
          <pre>{plan.execution_prompt}</pre>
        </details>
      )}
    </div>
  )
}
