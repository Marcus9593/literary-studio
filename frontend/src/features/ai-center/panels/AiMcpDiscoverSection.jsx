import { useEffect, useState } from 'react'
import Modal from '../../../components/Modal.jsx'
import StatusBadge from '../../../components/StatusBadge.jsx'
import { useToast } from '../../../components/Toast.jsx'
import { useAuth } from '../../../auth/AuthContext.jsx'
import {
  getMcpRegistryMeta,
  installMcpFromRegistry,
  searchMcpRegistry,
} from '../../../api.js'
import {
  DiscoverAdminNotice,
  DiscoverCard,
  DiscoverEmpty,
  DiscoverHero,
  DiscoverList,
  DiscoverMeta,
  DiscoverNoResults,
  DiscoverPagination,
  DiscoverSearchBar,
  DiscoverSection,
} from '../components/DiscoverLayout.jsx'

export default function AiMcpDiscoverSection({ onInstalled }) {
  const showToast = useToast()
  const { isAdmin } = useAuth()
  const [meta, setMeta] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState({
    items: [],
    total: 0,
    next_cursor: null,
    limit: 20,
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
    if (!isAdmin) {
      showToast('安装 MCP Server 需要管理员权限', 'error')
      return
    }
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
    if (!installModal || !isAdmin) return
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

  const showInitialEmpty = !searchQuery && searchResult.items.length === 0

  return (
    <DiscoverSection as="div" className="ai-mcp-discover">
      {!isAdmin && (
        <DiscoverAdminNotice>
          安装 MCP Server 需要管理员账号。你仍可浏览 Registry 搜索结果，并在「本机 Server」页查看已配置项。
        </DiscoverAdminNotice>
      )}

      <DiscoverHero
        title="发现并安装 MCP Server"
        description="从官方 MCP Registry 搜索，一键写入文匠 Studio 配置（npm 包或远程 URL）。"
        badgeLabel="Registry"
        badgeValue={meta?.available ? '已连接' : '在线搜索'}
      />

      <DiscoverSearchBar
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onSubmit={() => runSearch()}
        placeholder="搜索 MCP 名称、描述、npm 包…"
        submitLabel="搜索 MCP"
        submitting={busy === 'search'}
      />

      <DiscoverMeta>
        <span>数据来源：registry.modelcontextprotocol.io</span>
        {meta?.updated_at && <span>最近搜索：{new Date(meta.updated_at).toLocaleString()}</span>}
        {searchResult.total > 0 && (
          <span>
            本页 {searchResult.items.length} / 约 {searchResult.total} 条
          </span>
        )}
      </DiscoverMeta>

      {showInitialEmpty && (
        <DiscoverEmpty
          title="搜索 MCP Server"
          description="试试关键词：filesystem、memory、fetch、github"
          action={
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy === 'search'}
              onClick={() => runSearch('', 'filesystem')}
            >
              浏览 filesystem 示例
            </button>
          }
        />
      )}

      <DiscoverList>
        {searchResult.items.map((item, idx) => (
          <DiscoverCard
            key={item.registry_name}
            index={idx}
            title={item.title}
            subtitle={item.registry_name}
            description={item.description || '无描述'}
            kind={item.install_type}
            headExtras={<StatusBadge variant="neutral">{item.transport}</StatusBadge>}
            tags={
              <>
                {item.package_id && <code>{item.package_id}</code>}
                {item.remote_url && <code>{item.remote_url}</code>}
                {item.version && <span className="tool-tag">v{item.version}</span>}
              </>
            }
            actions={
              <>
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
                    disabled={!!busy || item.install_type === 'unknown' || !isAdmin}
                    onClick={() => openInstall(item)}
                  >
                    安装到 Studio
                  </button>
                )}
              </>
            }
          />
        ))}
      </DiscoverList>

      {searchResult.items.length === 0 && searchQuery && busy !== 'search' && (
        <DiscoverNoResults message="无匹配结果，请换关键词重试。" />
      )}

      <DiscoverPagination
        mode="cursor"
        busy={busy}
        hasMore={!!searchResult.next_cursor}
        onLoadMore={() => runSearch(searchResult.next_cursor)}
      />

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
              disabled={!!busy || !isAdmin}
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
                <span>
                  {arg.name}
                  {arg.description ? ` — ${arg.description}` : ''}
                </span>
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
    </DiscoverSection>
  )
}
