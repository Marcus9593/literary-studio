import { useCallback, useEffect, useState } from 'react'
import Modal from '../../../components/Modal.jsx'
import StatusBadge from '../../../components/StatusBadge.jsx'
import { useToast } from '../../../components/Toast.jsx'
import {
  callMcpTool,
  checkMcpHealth,
  getMcpOverview,
  getMcpStudioConfig,
  listMcpServers,
  listMcpServerTools,
  refreshMcpRuntime,
  saveMcpStudioConfig,
  setMcpServerEnabled,
} from '../../../api.js'
import AiMcpDiscoverSection from './AiMcpDiscoverSection.jsx'

const MCP_TABS = [
  { id: 'local', label: '本机 Server' },
  { id: 'discover', label: '发现安装' },
]

export default function AiMcpPanel() {
  const [tab, setTab] = useState('local')
  const showToast = useToast()
  const [overview, setOverview] = useState(null)
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [healthMap, setHealthMap] = useState({})
  const [toolsMap, setToolsMap] = useState({})
  const [studioJson, setStudioJson] = useState('')
  const [testModal, setTestModal] = useState(null)
  const [testArgs, setTestArgs] = useState('{}')
  const [testResult, setTestResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, list, studio] = await Promise.all([
        getMcpOverview(),
        listMcpServers(),
        getMcpStudioConfig().catch(() => null),
      ])
      setOverview(ov)
      setServers(list)
      setStudioJson(JSON.stringify(studio?.content || { mcpServers: {} }, null, 2))
    } catch (err) {
      showToast(err.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const onToggle = async (server, enabled) => {
    setBusy(`toggle:${server.id}`)
    try {
      await setMcpServerEnabled(server.id, enabled)
      showToast(enabled ? `已启用 ${server.name}` : `已禁用 ${server.name}`, 'success')
      await load()
    } catch (err) {
      showToast(err.message || '操作失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onHealth = async (serverId = null) => {
    setBusy(serverId ? `health:${serverId}` : 'health-all')
    try {
      const result = await checkMcpHealth(serverId)
      if (serverId) {
        setHealthMap((m) => ({ ...m, [serverId]: result }))
        showToast(result.ok ? '连接正常' : (result.error || '检查失败'), result.ok ? 'success' : 'error')
      } else {
        const map = {}
        for (const r of result.results || []) {
          map[r.server_id] = r
        }
        setHealthMap((m) => ({ ...m, ...map }))
        showToast(`健康检查完成：${result.ok_count}/${result.checked} 正常`, 'success')
      }
      await refreshMcpRuntime().catch(() => {})
    } catch (err) {
      showToast(err.message || '检查失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onLoadTools = async (serverId) => {
    setBusy(`tools:${serverId}`)
    try {
      const result = await listMcpServerTools(serverId)
      setToolsMap((m) => ({ ...m, [serverId]: result.tools || [] }))
    } catch (err) {
      showToast(err.message || '获取工具列表失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onSaveStudio = async () => {
    setBusy('studio-save')
    try {
      const content = JSON.parse(studioJson)
      await saveMcpStudioConfig(content)
      showToast('Studio MCP 配置已保存', 'success')
      await load()
    } catch (err) {
      showToast(err.message || '保存失败（请检查 JSON）', 'error')
    } finally {
      setBusy('')
    }
  }

  const openTest = async (server) => {
    setTestResult(null)
    setTestArgs('{}')
    let tools = toolsMap[server.id]
    if (!tools) {
      try {
        const result = await listMcpServerTools(server.id)
        tools = result.tools || []
        setToolsMap((m) => ({ ...m, [server.id]: tools }))
      } catch (err) {
        showToast(err.message || '无法加载工具', 'error')
        return
      }
    }
    if (!tools.length) {
      showToast('该 Server 没有可用工具', 'error')
      return
    }
    setTestModal({ server, tools, tool: tools[0]?.name || '' })
  }

  const onRunTest = async () => {
    if (!testModal) return
    setBusy('test-call')
    setTestResult(null)
    let args = {}
    try {
      args = JSON.parse(testArgs || '{}')
    } catch {
      showToast('参数必须是合法 JSON 对象', 'error')
      setBusy('')
      return
    }
    try {
      const result = await callMcpTool({
        server_id: testModal.server.id,
        tool: testModal.tool,
        arguments: args,
      })
      setTestResult(result)
      showToast(result.ok ? '调用成功' : '调用返回错误', result.ok ? 'success' : 'error')
    } catch (err) {
      setTestResult({ ok: false, error: err.message })
      showToast(err.message || '调用失败', 'error')
    } finally {
      setBusy('')
    }
  }

  if (loading) {
    return <p className="muted">加载 MCP 配置…</p>
  }

  const enabledCount = overview?.enabled_count ?? 0
  const totalCount = overview?.total_count ?? 0

  return (
    <section className="tools-section ai-mcp-panel">
      <div className="action-tabs tools-tabs ai-mcp-tabs">
        {MCP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`action-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'discover' ? (
        <AiMcpDiscoverSection onInstalled={load} />
      ) : (
        <>
      <div className="ai-panel-toolbar">
        <p className="hint ai-panel-hint">
          MCP 扩展外部工具能力。已启用的 Server 会在对话时通过 Claude CLI 的 <code>--mcp-config</code> 注入；也可在此直接测试调用。
        </p>
        <div className="ai-panel-toolbar-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!!busy}
            onClick={() => onHealth()}
          >
            {busy === 'health-all' ? '检查中…' : '检查全部'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={load}>
            刷新
          </button>
        </div>
      </div>

      <div className="ai-mcp-summary card">
        <div className="ai-mcp-summary-row">
          <span>已启用 <strong>{enabledCount}</strong> / {totalCount} 个 Server</span>
          {overview?.cli_injection ? (
            <StatusBadge variant="ok">对话已注入 MCP</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">对话未注入（无启用项）</StatusBadge>
          )}
        </div>
        {overview?.runtime_path && (
          <p className="muted ai-mcp-runtime-path">
            运行时快照：{overview.runtime_path}
          </p>
        )}
      </div>

      {overview?.sources?.length > 0 && (
        <div className="ai-mcp-sources muted">
          {overview.sources.map((src) => (
            <span key={src.id}>
              {src.label}：{src.exists ? `${src.server_count} 个` : '未配置'}
            </span>
          ))}
        </div>
      )}

      {servers.length === 0 ? (
        <div className="empty-state ai-discover-empty">
          <div className="empty-state-icon">⬡</div>
          <h3>还没有 MCP Server</h3>
          <p>在下方「Studio 配置」中添加，或在 Claude/Cursor 的 mcp.json 中配置后刷新。</p>
        </div>
      ) : (
        <div className="ai-mcp-server-list">
          {servers.map((server) => {
            const health = healthMap[server.id]
            const tools = toolsMap[server.id]
            return (
              <article key={server.id} className={`card ai-mcp-server-card ${server.enabled ? 'enabled' : ''}`}>
                <div className="ai-mcp-server-head">
                  <div>
                    <h3>{server.name}</h3>
                    <p className="muted">
                      {server.source_label} · {server.transport}
                      {server.config?.command && ` · ${server.config.command}`}
                      {server.config?.url && ` · ${server.config.url}`}
                    </p>
                  </div>
                  <div className="ai-mcp-server-badges">
                    {server.enabled ? (
                      <StatusBadge variant="ok">已启用</StatusBadge>
                    ) : (
                      <StatusBadge variant="neutral">未启用</StatusBadge>
                    )}
                    {health && (
                      <StatusBadge variant={health.ok ? 'ok' : 'warn'}>
                        {health.ok ? `${health.tool_count ?? 0} 工具` : '异常'}
                      </StatusBadge>
                    )}
                  </div>
                </div>

                <div className="ai-mcp-server-actions">
                  <button
                    type="button"
                    className={`btn btn-sm ${server.enabled ? 'btn-secondary' : 'btn-primary'}`}
                    disabled={!!busy}
                    onClick={() => onToggle(server, !server.enabled)}
                  >
                    {server.enabled ? '禁用' : '启用'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!!busy || !server.enabled}
                    onClick={() => onHealth(server.id)}
                  >
                    健康检查
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!!busy || !server.enabled}
                    onClick={() => onLoadTools(server.id)}
                  >
                    {tools ? `工具 (${tools.length})` : '列出工具'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!!busy || !server.enabled}
                    onClick={() => openTest(server)}
                  >
                    测试调用
                  </button>
                </div>

                {health && !health.ok && health.error && (
                  <p className="hint ai-preflight-result warn">{health.error}</p>
                )}

                {tools && tools.length > 0 && (
                  <ul className="ai-mcp-tools-list">
                    {tools.map((t) => (
                      <li key={t.name}>
                        <code>{t.name}</code>
                        <span className="muted">{t.description || '无描述'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })}
        </div>
      )}

      <details className="ai-advanced-details ai-mcp-studio-editor">
        <summary>Studio 配置（data/mcp.studio.json）</summary>
        <p className="hint">
          在此添加文匠专用的 MCP Server。保存后默认启用；Claude/Cursor 来源的 Server 需手动启用。
        </p>
        <textarea
          className="ai-mcp-json-editor"
          value={studioJson}
          onChange={(e) => setStudioJson(e.target.value)}
          rows={12}
          spellCheck={false}
        />
        <div className="ai-mcp-studio-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy === 'studio-save'}
            onClick={onSaveStudio}
          >
            {busy === 'studio-save' ? '保存中…' : '保存配置'}
          </button>
        </div>
      </details>

        </>
      )}

      <Modal
        open={!!testModal}
        title={testModal ? `测试 ${testModal.server.name}` : ''}
        onClose={() => setTestModal(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setTestModal(null)}>
              关闭
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!busy}
              onClick={onRunTest}
            >
              {busy === 'test-call' ? '调用中…' : '执行'}
            </button>
          </>
        }
      >
        {testModal && (
          <div className="ai-mcp-test-modal">
            <label className="field">
              <span>工具</span>
              <select
                value={testModal.tool}
                onChange={(e) => setTestModal({ ...testModal, tool: e.target.value })}
              >
                {testModal.tools.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>参数（JSON）</span>
              <textarea
                value={testArgs}
                onChange={(e) => setTestArgs(e.target.value)}
                rows={6}
                spellCheck={false}
              />
            </label>
            {testResult && (
              <pre className="ai-mcp-test-result">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Modal>
    </section>
  )
}
