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

const PROTOCOL_LABELS = {
  openai: 'OpenAI 兼容',
  anthropic: 'Anthropic 兼容',
}

const EMPTY_FORM = {
  name: '',
  protocol: 'openai',
  base_url: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  api_key: '',
}

const TEMPLATES = [
  {
    label: 'OpenAI',
    name: 'OpenAI',
    protocol: 'openai',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    label: 'DeepSeek',
    name: 'DeepSeek',
    protocol: 'openai',
    base_url: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    label: '通义千问',
    name: '通义千问',
    protocol: 'openai',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    label: 'MiMo OpenAI',
    name: '小米 MiMo（OpenAI）',
    protocol: 'openai',
    base_url: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
  },
  {
    label: 'MiMo Anthropic',
    name: '小米 MiMo（Anthropic）',
    protocol: 'anthropic',
    base_url: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    model: 'mimo-v2.5-pro',
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
    try {
      const result = await activateModel(id)
      setData(result)
      showToast('已设为当前写章模型')
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

  return (
    <>
      <div className="ai-panel-toolbar">
        <p className="hint ai-panel-hint">
          日常对话与写稿由 Claude Code 叙事引擎驱动；此处配置备用 API 模型与密钥。创作流程由「本机技能」中的默认 Skill 决定。
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
        <div className="ai-active-model-banner">
          <StatusBadge variant="ok" dot>
            当前启用：{activeModel.name}（{activeModel.model}）
          </StatusBadge>
          <p className="hint">
            激活模型的 API Key 与 Base URL 会注入 Claude Code；未配置时使用 CLI 默认凭据。
          </p>
        </div>
      )}

      {usage && (
        <section className="card ai-usage-panel">
          <h3>AI 用量估算</h3>
          <p className="hint">基于字符数估算 token（中文约 3.5 字/token），含对话、写章与行内 AI</p>
          <div className="ai-usage-metrics">
            <article className="studio-metric-card">
              <span>总请求</span>
              <strong>{usage.totals?.requests ?? 0}</strong>
            </article>
            <article className="studio-metric-card">
              <span>输入 token</span>
              <strong>{(usage.totals?.prompt_tokens ?? 0).toLocaleString()}</strong>
            </article>
            <article className="studio-metric-card">
              <span>输出 token</span>
              <strong>{(usage.totals?.completion_tokens ?? 0).toLocaleString()}</strong>
            </article>
            <article className="studio-metric-card">
              <span>合计</span>
              <strong>{(usage.total_tokens ?? 0).toLocaleString()}</strong>
            </article>
          </div>
          {usage.by_kind && Object.keys(usage.by_kind).length > 0 && (
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
          <p>添加至少一个 LLM 配置，写章时将使用「当前启用」的模型。</p>
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
                      设为当前
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
            onChange={(protocol) => setForm({ ...form, protocol })}
            options={[
              { value: 'openai', label: 'OpenAI 兼容', meta: '/chat/completions' },
              { value: 'anthropic', label: 'Anthropic 兼容', meta: '/v1/messages' },
            ]}
          />

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
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://api.openai.com/v1"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="model-model">模型 ID</label>
            <input
              id="model-model"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="gpt-4o-mini"
              required
            />
            <p className="field-hint" style={{ marginTop: 6 }}>
              填写 API Key 与 Base URL 后，可点击底部「测试连接」验证是否可用。
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
