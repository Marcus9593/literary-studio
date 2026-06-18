import Modal from '../../../components/Modal.jsx'
import {
  CLAUDE_CLI_OAUTH_GUIDE,
  OPENAI_PROTOCOL_CLI_WARNING,
} from '@shared/cli-model-compat.js'

const QUICK_STEPS = [
  {
    title: '改用 Anthropic 协议',
    desc: '点击下方按钮，或从上方 CC Switch 预设选择供应商',
  },
  {
    title: '确认 Base URL',
    desc: '使用厂商 Anthropic 端点，路径通常含 /anthropic',
  },
  {
    title: '保存并设为激活',
    desc: '凭据写入 Claude CLI 与 ~/.claude/settings.json',
  },
]

export default function OpenAiProtocolModal({ open, onClose, onSwitchAnthropic }) {
  const warning = OPENAI_PROTOCOL_CLI_WARNING
  const oauthGuide = CLAUDE_CLI_OAUTH_GUIDE
  const extraTips = (warning.solutions || []).slice(0, 4)

  return (
    <Modal
      open={open}
      onClose={onClose}
      panelClassName="modal-panel-protocol-warn"
      overlayClassName="modal-overlay-nested"
      title="协议选择提示"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            仍使用 OpenAI 协议
          </button>
          <button type="button" className="btn btn-primary" onClick={onSwitchAnthropic}>
            改用 Anthropic 协议
          </button>
        </>
      }
    >
      <div className="protocol-warn-modal" role="alert">
        <header className="protocol-warn-hero">
          <div className="protocol-warn-hero-icon" aria-hidden>
            !
          </div>
          <div className="protocol-warn-hero-body">
            <h4 className="protocol-warn-hero-title">{warning.title}</h4>
            <p className="protocol-warn-hero-lead">
              「测试连接」可能成功，但项目聊天与写稿会报{' '}
              <span className="protocol-warn-tag">Not logged in</span>
            </p>
          </div>
        </header>

        <section className="protocol-warn-spec" aria-label="Claude Code 所需配置">
          <h5 className="protocol-warn-spec-heading">Claude Code 需要以下配置</h5>
          <dl className="protocol-warn-spec-grid">
            <div className="protocol-warn-spec-row">
              <dt>协议类型</dt>
              <dd>
                <span className="protocol-warn-em">Anthropic 兼容</span>
              </dd>
            </div>
            <div className="protocol-warn-spec-row">
              <dt>Base URL</dt>
              <dd>
                厂商 Anthropic 端点，通常含{' '}
                <code className="protocol-warn-code">/anthropic</code>
              </dd>
            </div>
            <div className="protocol-warn-spec-row">
              <dt>凭据变量</dt>
              <dd className="protocol-warn-spec-codes">
                <code className="protocol-warn-code">ANTHROPIC_BASE_URL</code>
                <code className="protocol-warn-code">ANTHROPIC_AUTH_TOKEN</code>
              </dd>
            </div>
          </dl>
        </section>

        <section className="protocol-warn-steps" aria-label="建议步骤">
          <h5 className="protocol-warn-steps-heading">推荐：配置 Anthropic API</h5>
          <ol className="protocol-warn-steps-list">
            {QUICK_STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="protocol-warn-step-num">{i + 1}</span>
                <div className="protocol-warn-step-body">
                  <strong>{step.title}</strong>
                  <span>{step.desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <details className="protocol-warn-fold">
          <summary>
            {oauthGuide.title}
            <span className="protocol-warn-fold-hint">本机 Claude 终端 /login</span>
          </summary>
          <div className="protocol-warn-fold-body">
            <p className="protocol-warn-oauth-lead">{oauthGuide.subtitle}</p>
            <ol className="protocol-warn-oauth-list">
              {oauthGuide.steps.map((step, i) => (
                <li key={step.title}>
                  <span className="protocol-warn-oauth-num">{i + 1}</span>
                  <div className="protocol-warn-step-body">
                    <strong>{step.title}</strong>
                    <span>{step.desc}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="protocol-warn-oauth-note">{oauthGuide.note}</p>
          </div>
        </details>

        {extraTips.length > 0 && (
          <details className="protocol-warn-fold">
            <summary>更多说明</summary>
            <div className="protocol-warn-fold-body">
              <ul className="protocol-warn-more-list">
                {extraTips.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </div>
    </Modal>
  )
}
