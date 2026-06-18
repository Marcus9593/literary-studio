import { useCallback, useEffect, useState } from 'react'
import Modal from '../../../components/Modal.jsx'
import SelectField from '../../../components/SelectField.jsx'
import StatusBadge from '../../../components/StatusBadge.jsx'
import { useToast } from '../../../components/Toast.jsx'
import {
  activateModel,
  createModel,
  deleteModel,
  getAiUsage,
  importCcSwitch,
  listModels,
  testModel,
  testModelConfig,
  updateModel,
} from '../../../api.js'
import CliCompatNotice, {
  getCliCompatAssessment,
  getNormalizedModelPreview,
  OpenAiProtocolWarning,
} from '../components/CliCompatNotice.jsx'
import { normalizeModelForStorage } from '@shared/cli-model-compat.js'

const PROTOCOL_LABELS = {
  openai: 'OpenAI 兼容',
  anthropic: 'Anthropic 兼容（推荐）',
}

const EMPTY_FORM = {
  name: '',
  protocol: 'anthropic',
  base_url: 'https://api.deepseek.com/anthropic',
  model: 'deepseek-chat',
  api_key: '',
}

const PROTOCOL_OPTIONS = [
  {
    value: 'anthropic',
    label: 'Anthropic 兼容',
    meta: '推荐 · Claude Code / CC Switch',
  },
  {
    value: 'openai',
    label: 'OpenAI 兼容',
    meta: '高级 · 仅 HTTP 测试',
  },
]

function inferProtocolFromBaseUrl(baseUrl) {
  const url = String(baseUrl || '').trim().toLowerCase()
  if (url.includes('/anthropic')) return 'anthropic'
  if (/\/v1\/?$/.test(url.replace(/\/+$/, ''))) return 'openai'
  return null
}

const TEMPLATES = [
  {
    label: 'DeepSeek',
    name: 'DeepSeek',
    protocol: 'anthropic',
    base_url: 'https://api.deepseek.com/anthropic',
    model: 'deepseek-chat',
  },
  {
    label: 'MiMo',
    name: '小米 MiMo',
    protocol: 'anthropic',
    base_url: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    model: 'mimo-v2.5-pro',
  },
  {
    label: '通义 Bailian',
    name: '通义千问 Bailian',
    protocol: 'anthropic',
    base_url: 'https://dashscope.aliyuncs.com/apps/anthropic',
    model: 'qwen-plus',
  },
  {
    label: 'Kimi',
    name: 'Kimi',
    protocol: 'anthropic',
    base_url: 'https://api.moonshot.cn/anthropic',
    model: 'moonshot-v1-8k',
  },
  {
    label: 'OpenRouter',
    name: 'OpenRouter',
    protocol: 'anthropic',
    base_url: 'https://openrouter.ai/api',
    model: 'anthropic/claude-sonnet-4',
  },
  {
    label: 'OpenAI（不推荐）',
    name: 'OpenAI',
    protocol: 'openai',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
]

export default function AiModelsPanel() {
  const [data, setData] = useState({ active_id: '', models: [] })
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState(null)
  const [testingForm, setTestingForm] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [usage, setUsage] = useState(null)
  const showToast = useToast()

  const refresh = useCallback(() => {
    return Promise.all([listModels(), getAiUsage().catch(() => null)])
      .then(([models, usageData]) => {
        setData(models)
        setUsage(usageData)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setTestResult(null)
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      protocol: item.protocol || 'openai',
      base_url: item.base_url,
      model: item.model,
      api_key: '',
    })
    setTestResult(null)
    setModalOpen(true)
  }

  const applyTemplate = (tpl) => {
    setForm((f) => ({
      ...f,
      name: tpl.name,
      protocol: tpl.protocol,
      base_url: tpl.base_url,
      model: tpl.model,
    }))
  }

  const handleProtocolChange = (protocol) => {
    setForm((f) => {
      const next = { ...f, protocol }
      if (protocol === 'anthropic' && f.base_url.trim()) {
        const normalized = normalizeModelForStorage({ ...f, protocol: 'anthropic' })
        next.base_url = normalized.base_url
      }
      return next
    })
  }

  const applyNormalizedUrl = () => {
    const normalized = normalizeModelForStorage(form)
    setForm((f) => ({ ...f, protocol: 'anthropic', base_url: normalized.base_url }))
  }

  const onSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        const payload = {
          name: form.name.trim(),
          protocol: form.protocol,
          base_url: form.base_url.trim(),
          model: form.model.trim(),
        }
        if (form.api_key.trim()) {
          payload.api_key = form.api_key.trim()
        }
        await updateModel(editingId, payload)
        showToast('模型配置已更新')
      } else {
        await createModel({
          name: form.name.trim(),
          protocol: form.protocol,
          base_url: form.base_url.trim(),
          model: form.model.trim(),
          api_key: form.api_key.trim(),
        })
        showToast('模型配置已添加')
      }
      setModalOpen(false)
      await refresh()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const onActivate = async (id) => {
    const targetName = data.models.find(m => m.id === id)?.name || ''
    if (!window.confirm(`切换注入模型将重置 Claude 对话上下文（新 session），历史消息仍保留在项目中。\n\n确定切换到「${targetName}」？`)) return
    try {
      const result = await activateModel(id)
      setData(result)
      showToast(`已设为 Claude Code 注入模型（${targetName}）`)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const onImportCcSwitch = async () => {
    try {
      const cfg = await importCcSwitch()
      setForm({
        name: cfg.name || 'CC Switch 当前',
        protocol: cfg.protocol || 'anthropic',
        base_url: cfg.base_url,
        model: cfg.model,
        api_key: cfg.api_key || '',
      })
      setTestResult(null)
      if (!modalOpen) {
        setEditingId(null)
        setModalOpen(true)
      }
      showToast(`已从 CC Switch 导入（${cfg.api_key_preview || '密钥已填入'}）`)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const onTestForm = async () => {
    if (!form.base_url.trim() || !form.model.trim()) {
      showToast('请先填写 Base URL 和模型 ID', 'error')
      return
    }
    if (!form.api_key.trim() && !editingId) {
      showToast('请先填写 API Key', 'error')
      return
    }
    setTestingForm(true)
    setTestResult(null)
    try {
      const result = await testModelConfig({
        protocol: form.protocol,
        base_url: form.base_url.trim(),
        model: form.model.trim(),
        api_key: form.api_key.trim() || undefined,
        model_id: editingId || undefined,
      })
      setTestResult({ ok: true, message: result.reply_preview || 'OK' })
    } catch (err) {
      setTestResult({ ok: false, message: err.message })
    } finally {
      setTestingForm(false)
    }
  }

  const onTest = async (item) => {
    setTestingId(item.id)
    try {
      const result = await testModel(item.id)
      showToast(`连接成功：${result.reply_preview || 'OK'}`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setTestingId(null)
    }
  }

  const onDelete = async (item) => {
    if (!window.confirm(`确定删除「${item.name}」？`)) return
    try {
      const result = await deleteModel(item.id)
      setData((prev) => ({
        active_id: result.active_id,
        models: prev.models.filter((m) => m.id !== item.id),
      }))
      showToast('已删除')
      await refresh()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const activeModel = data.models.find((m) => m.id === data.active_id)
  const activeCompat = activeModel?.cli_compat
  const formCompat = modalOpen ? getCliCompatAssessment(form) : null
  const normalizedUrlPreview = modalOpen ? getNormalizedModelPreview(form) : null
  const isOpenAiProtocol = form.protocol === 'openai'

  return (
    <>
      <div className="ai-panel-toolbar">
        <p className="hint ai-panel-hint">
          项目对话由 Claude Code 驱动，<strong>请优先使用 Anthropic 兼容</strong>（与 CC Switch 一致）。
          保存时 Anthropic 配置会自动规范化为 CC Switch 推荐地址；OpenAI 协议仅适合 HTTP 测试。
        </p>
        <div className="ai-panel-toolbar-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onImportCcSwitch}
          >
            从 CC Switch 导入
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + 添加模型
          </button>
        </div>
      </div>

      {activeModel && (
        <div className={`ai-active-model-banner ${activeCompat?.severity === 'error' ? 'ai-active-model-banner-warn' : ''}`}>
          <StatusBadge variant={activeCompat?.cli_ready === false ? 'warn' : 'ok'} dot>
            CLI 注入模型：{activeModel.name}（{activeModel.model}）
            {activeCompat?.matched_preset && activeCompat.severity === 'ok' && (
              <span className="muted"> · CC Switch：{activeCompat.matched_preset}</span>
            )}
          </StatusBadge>
          {activeCompat?.severity === 'ok' ? (
            <p className="hint">
              已同步 CC Switch 格式：注入 <code>ANTHROPIC_BASE_URL</code> / <code>ANTHROPIC_AUTH_TOKEN</code>
              至 Claude CLI 与 <code>~/.claude/settings.json</code>。
            </p>
          ) : (
            <CliCompatNotice model={activeModel} compact onFixProtocol={activeModel.protocol === 'openai' ? () => openEdit(activeModel) : undefined} />
          )}
        </div>
      )}

      {usage && (
        <section className="card ai-usage-panel">
          <h3>AI 用量估算</h3>
          <p className="hint">
            基于字符数估算 token（中文约 3.5 字/token），含对话、写章与行内 AI。
            <span style={{ color: 'var(--ink-faint)' }}> CLI 对话为估算值，HTTP 请求未来将改为精确计量。</span>
          </p>
          <div className="ai-usage-metrics">
            <article className="studio-metric-card">
              <span>总请求</span>
              <strong>{usage.totals?.requests ?? 0}</strong>
            </article>
            <article className="studio-metric-card">
              <span>输入 token <span className="muted" style={{ fontSize: '0.8em' }}>（估算）</span></span>
              <strong>{(usage.totals?.prompt_tokens ?? 0).toLocaleString()}</strong>
            </article>
            <article className="studio-metric-card">
              <span>输出 token <span className="muted" style={{ fontSize: '0.8em' }}>（估算）</span></span>
              <strong>{(usage.totals?.completion_tokens ?? 0).toLocaleString()}</strong>
            </article>
            <article className="studio-metric-card">
              <span>合计</span>
              <strong>{(usage.total_tokens ?? 0).toLocaleString()}</strong>
            </article>
          </div>
          {usage.by_kind && Object.keys(usage.by_kind).length > 0 && (
            <>
              <p className="muted" style={{ fontSize: '0.85em', marginTop: 8, marginBottom: 4 }}>按用途分类：</p>
              <ul className="ai-usage-by-kind">
                {Object.entries(usage.by_kind).map(([kind, stats]) => (
                  <li key={kind}>
                    <span>{kind}</span>
                    <span className="muted">
                      {stats.requests} 次 · {(stats.prompt_tokens + stats.completion_tokens).toLocaleString()} tokens
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {loading ? (
        <div className="empty-state">
          <div className="loading-dots">
            <span />
            <span />
            <span />
          </div>
          <p style={{ marginTop: 16, color: 'var(--ink-faint)' }}>加载配置…</p>
        </div>
      ) : data.models.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚙</div>
          <h3>还没有模型配置</h3>
          <p>添加模型配置后，其 API Key 与 Base URL 将注入 Claude Code；对话与写稿仍由 CLI 驱动。</p>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            添加第一个模型
          </button>
        </div>
      ) : (
        <div className="model-list">
          {data.models.map((item) => {
            const isActive = item.id === data.active_id
            return (
              <article
                key={item.id}
                className={`model-card ${isActive ? 'model-card-active' : ''}`}
              >
                <div className="model-card-main">
                  <div className="model-card-title-row">
                    <h3>{item.name}</h3>
                    {isActive && (
                      <StatusBadge variant="ok">当前启用</StatusBadge>
                    )}
                  </div>
                  <div className="model-card-meta">
                    <span className="model-tag">
                      {PROTOCOL_LABELS[item.protocol] || item.protocol}
                    </span>
                    <span className="model-tag">{item.model}</span>
                    {item.api_key_set ? (
                      <StatusBadge variant="neutral">
                        密钥 {item.api_key_preview}
                      </StatusBadge>
                    ) : (
                      <StatusBadge variant="warn">未配置密钥</StatusBadge>
                    )}
                  </div>
                  <p className="model-card-url">{item.base_url}</p>
                  {item.cli_compat?.severity !== 'ok' && (
                    <CliCompatNotice model={item} compact />
                  )}
                  {item.cli_compat?.severity === 'ok' && item.cli_compat.matched_preset && (
                    <p className="model-card-preset-ok muted">
                      CC Switch 兼容 · {item.cli_compat.matched_preset}
                    </p>
                  )}
                </div>
                <div className="model-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onTest(item)}
                    disabled={!item.api_key_set || testingId === item.id}
                  >
                    {testingId === item.id ? '测试中…' : '测试连接'}
                  </button>
                  {!isActive && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onActivate(item.id)}
                    >
                      设为 CLI 注入模型
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openEdit(item)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm model-delete-btn"
                    onClick={() => onDelete(item)}
                  >
                    删除
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        panelClassName="modal-panel-form"
        title={editingId ? '编辑模型配置' : '添加模型配置'}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onTestForm}
              disabled={testingForm || saving}
            >
              {testingForm ? '测试中…' : '测试连接'}
            </button>
            <button
              type="submit"
              form="model-form"
              className="btn btn-primary"
              disabled={saving || testingForm}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </>
        }
      >
        <form id="model-form" className="model-config-form" onSubmit={onSave}>
          {!editingId && (
            <details className="model-preset-details">
              <summary>快速模板（点击展开）</summary>
              <div className="model-preset-scroll">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    className="preset-card"
                    onClick={() => applyTemplate(tpl)}
                  >
                    <strong>{tpl.label}</strong>
                    <span>{tpl.model}</span>
                  </button>
                ))}
              </div>
            </details>
          )}

          <div className="field">
            <label htmlFor="model-name">显示名称</label>
            <input
              id="model-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：DeepSeek 主力"
              required
            />
          </div>

          <SelectField
            label="协议类型"
            htmlFor="model-protocol"
            value={form.protocol}
            onChange={handleProtocolChange}
            options={PROTOCOL_OPTIONS}
          />

          {isOpenAiProtocol && (
            <OpenAiProtocolWarning onFixProtocol={() => handleProtocolChange('anthropic')} />
          )}

          {!isOpenAiProtocol && formCompat && formCompat.severity !== 'ok' && (
            <CliCompatNotice model={form} />
          )}
          {!isOpenAiProtocol && formCompat?.severity === 'ok' && formCompat.matched_preset && (
            <p className="cli-compat-ok-hint">
              与 CC Switch「{formCompat.matched_preset}」兼容，可用于 Claude Code CLI。
            </p>
          )}

          {!isOpenAiProtocol && normalizedUrlPreview && (
            <div className="cli-compat-url-fix">
              <p className="hint">
                将规范化为 Anthropic 地址：<code>{normalizedUrlPreview}</code>
              </p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={applyNormalizedUrl}>
                应用规范化地址
              </button>
            </div>
          )}

          <div className="field model-form-api-key">
            <label htmlFor="model-api-key">
              API Key
              {editingId && (
                <span className="field-hint">（留空则保持原密钥）</span>
              )}
            </label>
            <input
              id="model-api-key"
              type="password"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder={editingId ? '••••••••' : '输入 API Key'}
              required={!editingId}
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor="model-base-url">API Base URL</label>
            <input
              id="model-base-url"
              value={form.base_url}
              onChange={(e) => {
                const base_url = e.target.value
                const inferred = inferProtocolFromBaseUrl(base_url)
                setForm((f) => {
                  const next = { ...f, base_url }
                  if (inferred === 'anthropic') {
                    next.protocol = 'anthropic'
                    next.base_url = normalizeModelForStorage({ ...next, protocol: 'anthropic' }).base_url
                  } else if (inferred === 'openai' && f.protocol === 'anthropic') {
                    next.protocol = 'anthropic'
                  }
                  return next
                })
              }}
              placeholder="https://api.deepseek.com/anthropic"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="model-model">模型 ID</label>
            <input
              id="model-model"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="deepseek-chat"
              required
            />
            <p className="field-hint" style={{ marginTop: 6 }}>
              {form.protocol === 'anthropic'
                ? 'Anthropic 协议：保存后 Base URL 会规范化为 CC Switch 推荐地址，并写入 ~/.claude/settings.json。'
                : 'OpenAI 协议：仅「测试连接」可用，无法用于 Claude Code 项目对话。'}
            </p>
          </div>

          {testResult && (
            <div
              className={`test-result ${testResult.ok ? 'test-result-ok' : 'test-result-err'}`}
            >
              {testResult.ok ? '✓ 连接成功：' : '✕ 连接失败：'}
              {testResult.message}
            </div>
          )}
        </form>
      </Modal>
    </>
  )
}
