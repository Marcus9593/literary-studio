import Modal from '../../../components/Modal.jsx'
import ProviderLogo from './ProviderLogo.jsx'

const PROTOCOL_LABELS = {
  openai: 'OpenAI 兼容',
  anthropic: 'Anthropic 兼容',
}

function ModelPreview({ model, isActive }) {
  if (!model) return null
  return (
    <div className="model-confirm-preview">
      <ProviderLogo icon={model.icon} name={model.name} size={32} className="model-confirm-preview-logo" />
      <div className="model-confirm-preview-body">
        <div className="model-confirm-preview-title">
          <strong>{model.name}</strong>
          {isActive && <span className="model-confirm-preview-badge">当前启用</span>}
        </div>
        <p className="model-confirm-preview-meta muted">
          {PROTOCOL_LABELS[model.protocol] || model.protocol}
          {' · '}
          {model.model}
        </p>
        {model.base_url && (
          <p className="model-confirm-preview-url muted">{model.base_url}</p>
        )}
      </div>
    </div>
  )
}

export default function ModelConfirmModal({
  open,
  variant,
  model,
  isActive = false,
  loading = false,
  onClose,
  onConfirm,
}) {
  const isDelete = variant === 'delete'

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      panelClassName={`modal-panel-model-confirm ${isDelete ? 'modal-panel-model-confirm-danger' : ''}`}
      overlayClassName="modal-overlay-nested"
      title={isDelete ? '删除模型配置' : '切换 CLI 注入模型'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" disabled={loading} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={`btn ${isDelete ? 'btn-primary project-delete-confirm' : 'btn-primary'}`}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? '处理中…' : (isDelete ? '确认删除' : '确认切换')}
          </button>
        </>
      }
    >
      <div className="model-confirm-modal" role="alertdialog" aria-live="polite">
        <header className={`model-confirm-hero ${isDelete ? 'model-confirm-hero-danger' : ''}`}>
          <div className="model-confirm-hero-icon" aria-hidden>
            {isDelete ? '×' : '↻'}
          </div>
          <div className="model-confirm-hero-body">
            <h4 className="model-confirm-hero-title">
              {isDelete ? '确定移除此模型配置？' : '确定切换注入模型？'}
            </h4>
            <p className="model-confirm-hero-lead muted">
              {isDelete
                ? '删除后需重新添加 API Key 与 Base URL 才能再次使用。'
                : '切换后 Claude Code 将使用新凭据，并开启新的对话上下文。'}
            </p>
          </div>
        </header>

        <ModelPreview model={model} isActive={isActive} />

        <ul className="model-confirm-notes">
          {isDelete ? (
            <>
              <li>配置列表中将不再显示「{model?.name || '该模型'}」。</li>
              {isActive && (
                <li className="model-confirm-notes-warn">
                  这是当前 CLI 注入模型，删除后项目对话与写稿将无可用引擎，请先添加并激活其他模型。
                </li>
              )}
              <li>项目内的历史对话记录不会因此删除。</li>
              <li>
                若曾写入 <code>~/.claude/settings.json</code>，删除后会同步更新 CLI 凭据。
              </li>
            </>
          ) : (
            <>
              <li>
                将切换为 <strong>{model?.name}</strong>（{model?.model}）作为 Claude Code 注入模型。
              </li>
              <li>Claude 对话上下文会重置为新 session，历史消息仍保留在项目中。</li>
              <li>
                凭据将写入 <code>ANTHROPIC_BASE_URL</code> / <code>ANTHROPIC_AUTH_TOKEN</code> 与 Claude CLI。
              </li>
            </>
          )}
        </ul>
      </div>
    </Modal>
  )
}
