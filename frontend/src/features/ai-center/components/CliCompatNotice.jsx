import {
  assessClaudeCliCompatibility,
  normalizeModelForStorage,
  OPENAI_PROTOCOL_CLI_WARNING,
} from '@shared/cli-model-compat.js'

export function getCliCompatAssessment(model) {
  if (!model) return null
  if (model.protocol === 'openai') {
    const assessed = model.base_url ? assessClaudeCliCompatibility(model) : null
    const solutions = assessed?.solutions?.length
      ? [...new Set([...OPENAI_PROTOCOL_CLI_WARNING.solutions, ...assessed.solutions])].slice(0, 4)
      : OPENAI_PROTOCOL_CLI_WARNING.solutions.slice(0, 3)
    return {
      ...(assessed || {}),
      ...OPENAI_PROTOCOL_CLI_WARNING,
      summary: OPENAI_PROTOCOL_CLI_WARNING.summary,
      solutions,
    }
  }
  if (!model.base_url) return null
  return assessClaudeCliCompatibility(model)
}

export function getNormalizedModelPreview(model) {
  if (!model?.base_url || model.protocol !== 'anthropic') return null
  const normalized = normalizeModelForStorage(model)
  if (normalized.base_url === model.base_url) return null
  return normalized.base_url
}

export default function CliCompatNotice({
  model,
  compat: compatProp,
  compact = false,
  onFixProtocol,
}) {
  const compat = compatProp || getCliCompatAssessment(model)
  if (!compat || compat.severity === 'ok') return null

  const badgeLabel = compat.severity === 'error' ? '注意' : '提示'
  const solutions = (compat.solutions || []).slice(0, compact ? 3 : 5)

  return (
    <div
      className={`cli-compat-callout${compact ? ' is-compact' : ''}`}
      data-severity={compat.severity}
      role="status"
    >
      <div className="cli-compat-callout-head">
        <span className="cli-compat-callout-badge">{badgeLabel}</span>
        <p className="cli-compat-callout-title">{compat.title}</p>
      </div>
      <p className="cli-compat-callout-summary">{compat.summary}</p>
      {compat.suggested_base_url && (
        <p className="cli-compat-callout-url">
          建议地址 <code>{compat.suggested_base_url}</code>
        </p>
      )}
      {(onFixProtocol || solutions.length > 0) && (
        <div className="cli-compat-callout-foot">
          {onFixProtocol && model?.protocol === 'openai' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onFixProtocol}
            >
              改用 Anthropic 协议
            </button>
          )}
          {solutions.length > 0 && (
            <details className="cli-compat-callout-details">
              <summary>查看解决方案</summary>
              <ul>
                {solutions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

export function OpenAiProtocolWarning({ compact = false, onFixProtocol }) {
  return (
    <CliCompatNotice
      compat={OPENAI_PROTOCOL_CLI_WARNING}
      model={{ protocol: 'openai' }}
      compact={compact}
      onFixProtocol={onFixProtocol}
    />
  )
}
