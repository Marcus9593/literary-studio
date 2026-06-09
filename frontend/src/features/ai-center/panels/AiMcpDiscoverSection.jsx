import { useEffect, useState } from 'react'
import Modal from '../../../components/Modal.jsx'
import StatusBadge from '../../../components/StatusBadge.jsx'
import { useToast } from '../../../components/Toast.jsx'
import {
  getMcpRegistryMeta,
  installMcpFromRegistry,
  searchMcpRegistry,
} from '../../../api.js'

export default function AiMcpDiscoverSection({ onInstalled }) {
  const showToast = useToast()
  const [meta, setMeta] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState({
    items: [], total: 0, next_cursor: null, limit: 20,
  })
  const [busy, setBusy] = useState('')
  const [installModal, setInstallModal] = useState(null)
  const [installEnv, setInstallEnv] = useState({})
  const [installArgs, setInstallArgs] = useState({})

  useEffect(() => {
    getMcpRegistryMeta().then(setMeta).catch(() => setMeta(null))
  }, [])

  const runSearch = async (cursor = '', queryOverride) => {
    const q = queryOverride !== undefined ? queryOverride : searchQuery
    if (queryOverride !== undefined) setSearchQuery(queryOverride)
    setBusy('search')
    try {
      const res = await searchMcpRegistry(q, { limit: 20, cursor })
      setSearchResult(res)
      setMeta({ available: true, updated_at: new Date().toISOString(), total: res.total })
    } catch (err) {
      showToast(err.message || '搜索失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const openInstall = (item) => {
    const env = {}
    const args = {}
    for (const e of item.required_env || []) {
      env[e.name] = e.placeholder && !e.is_secret ? e.placeholder : ''
    }
    for (const a of item.required_args || []) {
      args[a.name] = a.default || ''
    }
    setInstallEnv(env)
    setInstallArgs(args)
    setInstallModal(item)
  }

  const onInstall = async () => {
    if (!installModal) return
    setBusy(`install:${installModal.registry_name}`)
    try {
      const result = await installMcpFromRegistry({
        registry_name: installModal.registry_name,
        env: installEnv,
        args: installArgs,
        enabled: true,
      })
      showToast(`已安装 ${result.local_name}，已写入 Studio 配置`, 'success')
      setInstallModal(null)
      onInstalled?.()
    } catch (err) {
      showToast(err.message || '安装失败', 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="ai-mcp-discover">
      <div className="tools-discover-hero">
        <div>
          <h3>发现并安装 MCP Server</h3>
          <p className="muted">
            从官方 MCP Registry 搜索，一键写入文匠 Studio 配置（npm 包或远程 URL）。
          </p>
        </div>
        <div className="tools-discover-hero-badge">
          <span>Registry</span>
          <strong>{meta?.available ? '已连接' : '在线搜索'}</strong>
        </div>
      </div>

      <div className="tools-search-bar">
        <label className="tools-search-input-wrap">
          <span className="tools-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="搜索 MCP 名称、描述、npm 包…"
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy === 'search'}
          onClick={() => runSearch()}
        >
          {busy === 'search' ? '搜索中…' : '搜索'}
        </button>
      </div>

      <div className="tools-discover-meta muted">
        <span>数据来源：registry.modelcontextprotocol.io</span>
        {meta?.updated_at && (
          <span>最近搜索：{new Date(meta.updated_at).toLocaleString()}</span>
        )}
        {searchResult.total > 0 && <span>本页 {searchResult.items.length} / 约 {searchResult.total} 条</span>}
      </div>

      {!searchQuery && searchResult.items.length === 0 && (
        <div className="empty-state ai-discover-empty">
          <div className="empty-state-icon">◎</div>
          <h3>搜索 MCP Server</h3>
          <p>试试关键词：filesystem、memory、fetch、github</p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy === 'search'}
            onClick={() => runSearch('', 'filesystem')}
          >
            浏览 filesystem 示例
          </button>
        </div>
      )}

      <div className="tools-discover-list">
        {searchResult.items.map((item, idx) => (
          <article
            key={item.registry_name}
            className="tool-discover-card"
            style={{ '--item-delay': `${idx * 35}ms` }}
          >
            <div className="tool-discover-head">
              <h3>{item.title}</h3>
              <div className="tool-discover-head-right">
                <span className="tool-discover-kind">{item.install_type}</span>
                <StatusBadge variant="neutral">{item.transport}</StatusBadge>
              </div>
            </div>
            <p className="muted ai-mcp-registry-id">{item.registry_name}</p>
            <p>{item.description || '无描述'}</p>
            <div className="tool-discover-tags">
              {item.package_id && <code>{item.package_id}</code>}
              {item.remote_url && <code>{item.remote_url}</code>}
              {item.version && <span className="tool-tag">v{item.version}</span>}
            </div>
            <div className="tool-discover-actions">
              {item.repository_url && (
                <a
                  href={item.repository_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  仓库
                </a>
              )}
              {item.already_installed ? (
                <StatusBadge variant="ok">已安装</StatusBadge>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!!busy || item.install_type === 'unknown'}
                  onClick={() => openInstall(item)}
                >
                  安装到 Studio
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {searchResult.items.length === 0 && searchQuery && busy !== 'search' && (
        <p className="empty-hint">无匹配结果，请换关键词重试。</p>
      )}

      {searchResult.next_cursor && (
        <div className="tools-pagination">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!!busy}
            onClick={() => runSearch(searchResult.next_cursor)}
          >
            加载更多
          </button>
        </div>
      )}

      <Modal
        open={!!installModal}
        title={installModal ? `安装 ${installModal.title}` : ''}
        onClose={() => setInstallModal(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setInstallModal(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!busy}
              onClick={onInstall}
            >
              {busy?.startsWith('install:') ? '安装中…' : '确认安装'}
            </button>
          </>
        }
      >
        {installModal && (
          <div className="ai-mcp-install-modal">
            <p className="muted">{installModal.description}</p>
            <p className="hint">
              {installModal.install_type === 'npm'
                ? `将通过 npx 运行：${installModal.package_id}`
                : `远程 URL：${installModal.remote_url}`}
            </p>
            {(installModal.required_args || []).map((arg) => (
              <label key={arg.name} className="field">
                <span>{arg.name}{arg.description ? ` — ${arg.description}` : ''}</span>
                <input
                  value={installArgs[arg.name] || ''}
                  onChange={(e) => setInstallArgs({ ...installArgs, [arg.name]: e.target.value })}
                  placeholder={arg.default || ''}
                />
              </label>
            ))}
            {(installModal.required_env || []).map((ev) => (
              <label key={ev.name} className="field">
                <span>
                  {ev.kind === 'header' ? 'Header' : 'Env'}: {ev.name}
                  {ev.description ? ` — ${ev.description}` : ''}
                </span>
                <input
                  type={ev.is_secret ? 'password' : 'text'}
                  value={installEnv[ev.name] || ''}
                  onChange={(e) => setInstallEnv({ ...installEnv, [ev.name]: e.target.value })}
                  placeholder={ev.placeholder || ''}
                  autoComplete="off"
                />
              </label>
            ))}
            {!installModal.required_env?.length && !installModal.required_args?.length && (
              <p className="hint">无需额外配置，确认后将写入 data/mcp.studio.json 并默认启用。</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
