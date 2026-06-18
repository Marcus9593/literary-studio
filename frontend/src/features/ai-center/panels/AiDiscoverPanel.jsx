import { useCallback, useEffect, useState } from 'react'
import Modal from '../../../components/Modal.jsx'
import StatusBadge from '../../../components/StatusBadge.jsx'
import { useToast } from '../../../components/Toast.jsx'
import { useAuth } from '../../../auth/AuthContext.jsx'
import {
  getToolsOverview,
  installSkill,
  searchSkills,
  updateSkillsCatalogue,
} from '../../../api.js'
import FancySelect from '../../../components/FancySelect.jsx'
import SelectField from '../../../components/SelectField.jsx'
import {
  DiscoverAdminNotice,
  DiscoverCard,
  DiscoverCustomInstall,
  DiscoverEmpty,
  DiscoverHero,
  DiscoverList,
  DiscoverMeta,
  DiscoverNoResults,
  DiscoverPagination,
  DiscoverSearchBar,
  DiscoverSection,
} from '../components/DiscoverLayout.jsx'

const TARGET_OPTIONS = [
  { value: 'claude', label: 'Claude (~/.claude/skills)' },
  { value: 'cursor', label: 'Cursor (~/.cursor/skills)' },
  { value: 'codex', label: 'Codex (~/.codex/skills)' },
]

export default function AiDiscoverPanel() {
  const showToast = useToast()
  const { isAdmin } = useAuth()
  const [overview, setOverview] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState({ items: [], total: 0, page: 1, limit: 20 })
  const [searchPage, setSearchPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [installTarget, setInstallTarget] = useState('claude')
  const [installModal, setInstallModal] = useState(null)
  const [customSource, setCustomSource] = useState('')

  const refreshOverview = useCallback(async () => {
    const data = await getToolsOverview()
    setOverview(data)
    return data
  }, [])

  useEffect(() => {
    refreshOverview().finally(() => setLoading(false))
  }, [refreshOverview])

  const runSearch = async (page = 1) => {
    setBusy('search')
    try {
      const res = await searchSkills(searchQuery, page)
      setSearchResult(res)
      setSearchPage(page)
    } catch (err) {
      showToast(err.message || '搜索失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onUpdateCatalogue = async () => {
    if (!isAdmin) {
      showToast('同步全网技能需要管理员权限', 'error')
      return
    }
    setBusy('catalogue')
    try {
      await updateSkillsCatalogue()
      showToast('全网技能列表已同步', 'success')
      await refreshOverview()
      if (searchQuery) await runSearch(searchPage)
    } catch (err) {
      showToast(err.message || '同步失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onInstall = async (source) => {
    if (!isAdmin) {
      showToast('安装技能需要管理员权限', 'error')
      return
    }
    setBusy(`install:${source}`)
    try {
      await installSkill({ source, target: installTarget, force: false })
      showToast(`已安装 ${source}，文匠将自动扫描本机目录`, 'success')
      showToast('可在「本机技能」页设为默认 Skill', 'info')
      setInstallModal(null)
      setCustomSource('')
      await refreshOverview()
    } catch (err) {
      showToast(err.message || '安装失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const catalogueMeta = overview?.find_skill || {}

  if (loading) {
    return <p className="muted">加载中…</p>
  }

  const hasCatalogue = (catalogueMeta.total ?? 0) > 0

  return (
    <DiscoverSection>
      {!isAdmin && (
        <DiscoverAdminNotice>
          安装与同步全网技能需要管理员账号。你仍可浏览目录并在「本机技能」页查看已安装项。
        </DiscoverAdminNotice>
      )}

      <DiscoverHero
        title="发现并安装 Skills"
        description="先同步全网目录，再搜索你需要的能力，一键安装到本机（文匠会自动扫描）。"
        badgeLabel="可发现"
        badgeValue={`${catalogueMeta.total ?? 0} 个`}
      />

      {!hasCatalogue && !searchQuery && (
        <DiscoverEmpty
          title="还没有技能目录"
          description="点击下方「同步全网技能」拉取可安装列表，然后搜索并安装。"
          action={
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy === 'catalogue' || !isAdmin}
              onClick={onUpdateCatalogue}
            >
              {busy === 'catalogue' ? '同步中…' : '同步全网技能'}
            </button>
          }
          guidance={
            catalogueMeta.catalogue_available === false ? (
              <div className="ai-discover-guidance" style={{ marginTop: 16, textAlign: 'left' }}>
                <p className="muted" style={{ marginBottom: 8 }}>
                  <strong>提示：</strong>全网技能目录依赖 <code>find-skill</code> 工具。如果同步失败，请确认已安装：
                </p>
                <pre
                  className="ai-discover-install-hint"
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: '0.85em',
                    overflow: 'auto',
                  }}
                >
                  {`# 安装 find-skill 到 Claude 技能目录
~/.claude/skills/find-skill/install.sh

# 或手动同步目录
~/.claude/skills/find-skill/update-skills-catalogue.sh`}
                </pre>
                <p className="muted" style={{ marginTop: 8 }}>
                  即使没有全网目录，你仍可使用「本机技能」页已安装的 <code>literary-writer</code> 技能进行创作。
                </p>
              </div>
            ) : null
          }
        />
      )}

      {(hasCatalogue || searchQuery) && (
        <>
          <DiscoverSearchBar
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSubmit={() => runSearch(1)}
            placeholder="搜索技能名称、描述、仓库…"
            submitLabel="搜索技能"
            submitting={busy === 'search'}
            trailing={
              <button
                type="button"
                className="btn btn-secondary tools-sync-btn"
                disabled={busy === 'catalogue' || !isAdmin}
                onClick={onUpdateCatalogue}
              >
                同步全网技能
              </button>
            }
          >
            <FancySelect
              variant="form"
              className="tools-search-target"
              value={installTarget}
              onChange={setInstallTarget}
              options={TARGET_OPTIONS}
              label="安装目标"
              menuMinWidth={280}
            />
          </DiscoverSearchBar>

          <DiscoverMeta>
            <span>从全网来源拉取可用 Skill 列表，不会修改本地已安装 Skill</span>
            {catalogueMeta.updated_at && (
              <span>全网列表更新：{new Date(catalogueMeta.updated_at).toLocaleDateString()}</span>
            )}
            {catalogueMeta.stale && <StatusBadge variant="warn">全网列表可能过期</StatusBadge>}
            {searchResult.total > 0 && <span>共 {searchResult.total} 条结果</span>}
          </DiscoverMeta>

          <DiscoverCustomInstall
            value={customSource}
            onChange={(e) => setCustomSource(e.target.value)}
            placeholder="GitHub 仓库或 skill 名称，直接安装"
            disabled={!customSource.trim() || !!busy || !isAdmin}
            onInstall={() => onInstall(customSource.trim())}
          />

          <DiscoverList>
            {searchResult.items.map((item, idx) => (
              <DiscoverCard
                key={`${item.repo}-${item.name}`}
                index={idx}
                title={item.name}
                description={item.description || '无描述'}
                kind="Skill"
                headExtras={item.stars != null ? <span className="tool-stars">★ {item.stars}</span> : null}
                tags={
                  <>
                    {item.agents?.map((a) => (
                      <span key={a} className="tool-tag">
                        {a}
                      </span>
                    ))}
                    {item.repo && <code>{item.repo}</code>}
                  </>
                }
                actions={
                  <>
                    {item.repo_url && (
                      <a
                        href={item.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        仓库
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!isAdmin || busy === `install:${item.install_ref}`}
                      onClick={() => setInstallModal(item)}
                    >
                      安装
                    </button>
                  </>
                }
              />
            ))}
          </DiscoverList>

          {searchResult.items.length === 0 && searchQuery && !busy && (
            <DiscoverNoResults message="无匹配结果，试试同步全网技能或换关键词。" />
          )}

          <DiscoverPagination
            mode="pages"
            busy={busy}
            page={searchPage}
            limit={searchResult.limit || 20}
            total={searchResult.total}
            onPrev={() => runSearch(searchPage - 1)}
            onNext={() => runSearch(searchPage + 1)}
          />
        </>
      )}

      <Modal
        open={!!installModal}
        title={`安装 ${installModal?.name || ''}`}
        onClose={() => setInstallModal(null)}
      >
        {installModal && (
          <div className="tools-install-modal">
            <p>{installModal.description}</p>
            <SelectField
              label="安装到"
              value={installTarget}
              onChange={setInstallTarget}
              options={TARGET_OPTIONS}
            />
            <p className="hint">安装后文匠会自动扫描对应目录，可在「本机技能」中设为默认。</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setInstallModal(null)}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!!busy || !isAdmin}
                onClick={() => onInstall(installModal.install_ref || installModal.name)}
              >
                确认安装
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DiscoverSection>
  )
}
