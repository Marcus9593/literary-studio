import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useToast } from '../components/Toast.jsx'
import { createProject, deleteProject, getHealth, listProjects, updateProject } from '../api.js'
import {
  CREATION_MODE_LIST,
  GENRES_BY_WORK_TYPE,
  WORK_TYPE_LIST,
} from '../lib/projectProfile.js'
import { BRAND } from '../lib/brand.js'
import PageSlogan from '../components/PageSlogan.jsx'
import HomeProjectSkeleton from '../components/HomeProjectSkeleton.jsx'
import {
  collectGenres,
  countActiveProjects,
  countArchivedProjects,
  EMPTY_FILTERS,
  hasActiveFilters,
  loadProjectSort,
  processProjectList,
  PROJECT_SORT_OPTIONS,
  saveProjectSort,
} from '../lib/projectListFilter.js'
import {
  loadPinnedIds,
  loadMostRecentOpenId,
  loadViewMode,
  saveViewMode,
  togglePinned,
  savePinnedIds,
} from '../lib/homeProjectPrefs.js'
import HomeProjectFilters from '../components/HomeProjectFilters.jsx'
import HomeProjectItem from '../components/HomeProjectItem.jsx'
import HomeBatchBar from '../components/HomeBatchBar.jsx'
import FancySelect from '../components/FancySelect.jsx'
import SelectField from '../components/SelectField.jsx'
import HomeEmptyPanel from '../components/HomeEmptyPanel.jsx'
import ProjectShareModal from '../components/ProjectShareModal.jsx'

export default function HomePage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('现实')
  const [workType, setWorkType] = useState('novel_long')
  const [creationMode, setCreationMode] = useState('scratch')
  const [rewriteNote, setRewriteNote] = useState('')
  const [summary, setSummary] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('')
  const [deleting, setDeleting] = useState(false)
  const showToast = useToast()

  const [loadError, setLoadError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState(loadProjectSort)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [pinnedIds, setPinnedIds] = useState(loadPinnedIds)
  const [viewMode, setViewMode] = useState(loadViewMode)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [summaryTarget, setSummaryTarget] = useState(null)
  const [summaryText, setSummaryText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [batchWorking, setBatchWorking] = useState(false)
  const [shareTarget, setShareTarget] = useState(null)
  const searchRef = useRef(null)

  const applySearch = () => setSearchQuery(searchInput.trim())

  const clearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    searchRef.current?.focus()
  }

  const genres = GENRES_BY_WORK_TYPE[workType] || GENRES_BY_WORK_TYPE.general

  const genreOptions = useMemo(() => collectGenres(projects), [projects])
  const activeCount = useMemo(() => countActiveProjects(projects), [projects])
  const archivedCount = useMemo(() => countArchivedProjects(projects), [projects])

  const visibleProjects = useMemo(
    () => processProjectList(projects, {
      query: searchQuery,
      sortId: sortBy,
      filters,
      pinnedIds,
    }),
    [projects, searchQuery, sortBy, filters, pinnedIds],
  )

  const continueProject = useMemo(() => {
    const id = loadMostRecentOpenId()
    if (!id) return null
    const p = projects.find((item) => item.id === id)
    if (!p || p.archived) return null
    return p
  }, [projects])

  const showContinueBar = Boolean(continueProject)
    && !hasActiveFilters(filters, searchQuery)
    && !filters.showArchived
    && !batchMode

  const selectedCount = selectedIds.size

  const sortOptions = useMemo(
    () => PROJECT_SORT_OPTIONS.map((o) => ({ value: o.id, label: o.label })),
    [],
  )

  const onSortChange = (next) => {
    setSortBy(next)
    saveProjectSort(next)
  }

  const refresh = useCallback(() => {
    setLoadError('')
    listProjects()
      .then(setProjects)
      .catch((e) => { setLoadError(e.message); setProjects([]) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    getHealth().then(setHealth).catch(() => setHealth(null))
  }, [refresh])

  useEffect(() => {
    if (!genres.includes(genre)) setGenre(genres[0])
  }, [workType, genres, genre])

  useEffect(() => {
    const onKey = (e) => {
      if (modalOpen || deleteTarget || renameTarget || summaryTarget) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setModalOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && projects.length > 0) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        clearSearch()
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, deleteTarget, renameTarget, summaryTarget, projects.length])

  const handlePin = (project) => {
    const next = togglePinned(project.id)
    setPinnedIds(next)
    showToast(next.includes(project.id) ? '已置顶' : '已取消置顶')
  }

  const openRename = (project) => {
    setRenameTarget(project)
    setRenameTitle(project.title)
  }

  const openEditSummary = (project) => {
    setSummaryTarget(project)
    setSummaryText(project.summary || project.card_summary || '')
  }

  const saveRename = async () => {
    if (!renameTarget || !renameTitle.trim()) return
    setSavingEdit(true)
    try {
      await updateProject(renameTarget.id, { title: renameTitle.trim() })
      showToast('已重命名')
      setRenameTarget(null)
      refresh()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const saveSummary = async () => {
    if (!summaryTarget) return
    setSavingEdit(true)
    try {
      await updateProject(summaryTarget.id, { summary: summaryText.trim() })
      showToast('已保存简述')
      setSummaryTarget(null)
      refresh()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const resetChipFilters = () => {
    setFilters((f) => ({
      ...f,
      workType: '',
      creationMode: '',
      genre: '',
      status: '',
    }))
  }

  const resetAllFilters = () => {
    setFilters(EMPTY_FILTERS)
    clearSearch()
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedIds(new Set(visibleProjects.map((p) => p.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  useEffect(() => {
    setSelectedIds(new Set())
  }, [filters.showArchived])

  const exitBatchMode = () => {
    setBatchMode(false)
    clearSelection()
  }

  const handleSetStatus = async (project, status) => {
    try {
      await updateProject(project.id, { status })
      showToast('已更新创作状态')
      refresh()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleToggleArchive = async (project) => {
    const next = !project.archived
    try {
      await updateProject(project.id, { archived: next })
      showToast(next ? '已归档' : '已移出归档')
      setSelectedIds((prev) => {
        const ids = new Set(prev)
        ids.delete(project.id)
        return ids
      })
      refresh()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const runBatchDelete = async () => {
    if (selectedCount === 0) return
    setBatchWorking(true)
    try {
      const ids = [...selectedIds]
      await Promise.all(ids.map((id) => deleteProject(id)))
      const nextPins = pinnedIds.filter((id) => !selectedIds.has(id))
      setPinnedIds(nextPins)
      savePinnedIds(nextPins)
      showToast(`已删除 ${ids.length} 部作品`)
      setBatchDeleteOpen(false)
      clearSelection()
      exitBatchMode()
      refresh()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBatchWorking(false)
    }
  }

  const setView = (mode) => {
    setViewMode(mode)
    saveViewMode(mode)
  }

  const resetForm = () => {
    setTitle('')
    setWorkType('novel_long')
    setCreationMode('scratch')
    setRewriteNote('')
    setSummary('')
    setGenre(GENRES_BY_WORK_TYPE.novel_long[0])
  }

  const openCreate = () => setModalOpen(true)

  const openCreatePreset = (preset) => {
    resetForm()
    if (preset.workType) {
      setWorkType(preset.workType)
      setGenre(GENRES_BY_WORK_TYPE[preset.workType]?.[0] || GENRES_BY_WORK_TYPE.novel_long[0])
    }
    if (preset.creationMode) setCreationMode(preset.creationMode)
    setModalOpen(true)
  }

  const onCreate = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    try {
      const p = await createProject({
        title: title.trim(),
        genre,
        work_type: workType,
        creation_mode: creationMode,
        rewrite_note: creationMode === 'rewrite' ? rewriteNote.trim() : '',
        summary: summary.trim(),
      })
      setModalOpen(false)
      resetForm()
      showToast(`已创建「${p.title}」`)
      navigate(`/projects/${p.id}`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  const onDelete = async () => {
    if (!deleteTarget || deleteConfirmTitle.trim() !== deleteTarget.title) return
    setDeleting(true)
    try {
      await deleteProject(deleteTarget.id)
      const nextPins = pinnedIds.filter((id) => id !== deleteTarget.id)
      setPinnedIds(nextPins)
      savePinnedIds(nextPins)
      showToast(`已删除「${deleteTarget.title}」`)
      setDeleteTarget(null)
      setDeleteConfirmTitle('')
      refresh()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const studioModel = health?.inference?.credentials === 'studio_settings'
  const cliOk = health?.claude_code?.available
  const credOk = !studioModel || health?.api_model?.available !== false

  const listStatsText = projects.length > 0 ? (
    <>
      {filters.showArchived ? (
        <>
          归档 <strong>{archivedCount}</strong> 部
          {visibleProjects.length !== archivedCount && (
            <span className="home-list-status-filter">
              · 显示 <strong>{visibleProjects.length}</strong> 部
            </span>
          )}
        </>
      ) : (
        <>
          共 <strong>{activeCount}</strong> 部作品
          {archivedCount > 0 && (
            <span className="home-list-status-muted"> · 归档 {archivedCount} 部</span>
          )}
          {(searchQuery.trim()
            || filters.workType
            || filters.creationMode
            || filters.genre
            || filters.status)
            && visibleProjects.length !== activeCount && (
            <span className="home-list-status-filter">
              · 筛选后 <strong>{visibleProjects.length}</strong> 部
            </span>
          )}
        </>
      )}
    </>
  ) : null

  const showListHead = projects.length > 0 && (listStatsText || showContinueBar)

  return (
    <div className="page home-page home-page-wide">
      <div className="home-hero-band">
        <header className="page-header home-hero">
          <div className="home-hero-main">
            <h2>{BRAND.home.title}</h2>
            <PageSlogan />
            <p>{BRAND.home.intro}</p>
          </div>
          {health && (
            <div className="home-hero-aside">
              <StatusBadge variant={cliOk && credOk ? 'ok' : 'warn'} dot>
                {!cliOk
                  ? 'Claude Code 未安装或未在 PATH 中（对话/写稿不可用）'
                  : studioModel
                  ? `Claude Code · ${health.inference?.name || health.inference?.model || '已配置模型'}${credOk ? '' : '（凭据待检查）'}`
                  : `Claude Code 已连接${health.claude_code?.version ? ` · ${health.claude_code.version}` : ''}`}
              </StatusBadge>
            </div>
          )}
        </header>
      </div>

      {loading ? (
        <div className="home-loading-wrap">
          <p className="home-loading-label">加载项目…</p>
          <HomeProjectSkeleton />
        </div>
      ) : loadError ? (
        <div className="empty-state home-empty-state">
          <div className="empty-state-icon">⚠️</div>
          <h3>加载失败</h3>
          <p>{loadError}</p>
          <button type="button" className="btn btn-secondary" onClick={refresh}>重试</button>
        </div>
      ) : (
        <section className="home-projects home-body" aria-labelledby="home-projects-heading">
          <div className="home-projects-toolbar">
            {projects.length > 0 ? (
              <HomeProjectFilters
                filters={filters}
                genres={genreOptions}
                archivedCount={archivedCount}
                onChange={setFilters}
                onReset={resetChipFilters}
              >
                {({ button: filterButton, panel: filterPanel, toolbarChips: filterToolbarChips }) => (
                  <>
                    <div className="home-toolbar-strip">
                      <div className="home-toolbar-strip-left" aria-label="列表展示">
                        <div className="home-view-toggle" role="group" aria-label="视图切换">
                          <button
                            type="button"
                            className={`home-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setView('grid')}
                            title="卡片视图"
                            aria-pressed={viewMode === 'grid'}
                          >
                            ⊞
                          </button>
                          <button
                            type="button"
                            className={`home-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setView('list')}
                            title="列表视图"
                            aria-pressed={viewMode === 'list'}
                          >
                            ☰
                          </button>
                        </div>
                        <div className="home-sort-wrap">
                          <span className="home-sort-label" id="home-sort-label">排序</span>
                          <div className="home-sort-track" aria-labelledby="home-sort-label">
                            <FancySelect
                              minimal
                              className="home-sort-fancy"
                              value={sortBy}
                              onChange={onSortChange}
                              options={sortOptions}
                              label="项目排序方式"
                              menuMinWidth={168}
                            />
                          </div>
                        </div>
                      </div>

                      <form
                        className="home-search-bar home-toolbar-strip-search"
                        onSubmit={(e) => {
                          e.preventDefault()
                          applySearch()
                        }}
                      >
                        <div className="home-search-wrap">
                          <span className="home-search-icon" aria-hidden="true">⌕</span>
                          <input
                            ref={searchRef}
                            type="search"
                            className="home-search-input"
                            placeholder="搜索书名、题材、类型…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            aria-label="搜索项目"
                          />
                          {(searchInput || searchQuery) && (
                            <button
                              type="button"
                              className="home-search-clear"
                              onClick={clearSearch}
                              aria-label="清除搜索"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <button type="submit" className="btn btn-secondary btn-sm home-search-submit">
                          搜索
                        </button>
                      </form>

                      <div className="home-toolbar-strip-right">
                        {filterButton}
                        <button
                          type="button"
                          className={`btn btn-sm home-batch-delete-btn ${batchMode ? 'active' : ''}`}
                          onClick={() => (batchMode ? exitBatchMode() : setBatchMode(true))}
                        >
                          {batchMode ? '取消' : '批量删除'}
                        </button>
                        <button type="button" className="btn btn-primary" onClick={openCreate}>
                          新建项目
                        </button>
                      </div>
                    </div>
                    {filterPanel}
                    {filterToolbarChips}
                  </>
                )}
              </HomeProjectFilters>
            ) : (
              <div className="home-toolbar-strip home-toolbar-strip-empty">
                <p className="home-toolbar-empty-hint">导入 docx，或从零搭建大纲与成稿</p>
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  新建项目
                </button>
              </div>
            )}

            {batchMode && projects.length > 0 && (
              <HomeBatchBar
                selectedCount={selectedCount}
                visibleCount={visibleProjects.length}
                onSelectAll={selectAllVisible}
                onClearSelection={clearSelection}
                onDelete={() => setBatchDeleteOpen(true)}
                onExit={exitBatchMode}
              />
            )}
          </div>

          {health && (!cliOk || !credOk) && projects.length > 0 && (
            <div className="home-engine-banner" role="status">
              <span>
                {!cliOk
                  ? 'Claude Code 未连接，对话与写稿暂不可用。'
                  : '设置页模型凭据不可用，对话与写稿可能失败。'}
              </span>
              <Link to="/ai" className="home-engine-banner-link">前往 AI 中心</Link>
            </div>
          )}

          {showListHead && (
            <div
              id="home-projects-heading"
              className={`home-list-head ${showContinueBar ? 'home-list-head-with-continue' : ''}`}
            >
              {listStatsText && (
                <p className="home-list-status">{listStatsText}</p>
              )}
              {continueProject && (
                <Link
                  to={`/projects/${continueProject.id}`}
                  className="home-list-continue-item"
                  title={`继续创作：${continueProject.title}`}
                >
                  <span className="home-list-continue-action">继续创作</span>
                  <span className="home-list-continue-project">《{continueProject.title}》</span>
                </Link>
              )}
            </div>
          )}

          {projects.length === 0 ? (
            <HomeEmptyPanel
              variant="library"
              cliOk={cliOk}
              onCreate={openCreate}
              onCreatePreset={openCreatePreset}
            />
          ) : !filters.showArchived && activeCount === 0 && archivedCount > 0 ? (
            <HomeEmptyPanel
              variant="archived-only"
              archivedCount={archivedCount}
              onViewArchive={() => setFilters((f) => ({ ...f, showArchived: true }))}
              onCreate={openCreate}
            />
          ) : visibleProjects.length === 0 ? (
            <HomeEmptyPanel
              variant={filters.showArchived && archivedCount === 0 ? 'archive-empty' : 'no-match'}
              searchQuery={searchQuery}
              onClearFilters={resetAllFilters}
            />
          ) : (
            <div className={viewMode === 'list' ? 'home-project-list' : 'card-grid home-card-grid'}>
              {visibleProjects.map((p, index) => (
                <HomeProjectItem
                  key={p.id}
                  project={p}
                  index={index}
                  view={viewMode === 'list' ? 'list' : 'grid'}
                  pinned={pinnedIds.includes(p.id)}
                  batchMode={batchMode}
                  selected={selectedIds.has(p.id)}
                  onToggleSelect={toggleSelect}
                  onPin={() => handlePin(p)}
                  onRename={() => openRename(p)}
                  onEditSummary={() => openEditSummary(p)}
                  onSetStatus={(status) => handleSetStatus(p, status)}
                  onToggleArchive={() => handleToggleArchive(p)}
                  onDelete={() => setDeleteTarget(p)}
                  onImport={() => navigate(`/projects/${p.id}`, { state: { openUpload: true } })}
                  onShare={() => setShareTarget(p)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="新建创作项目"
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
              type="submit"
              form="create-project-form"
              className="btn btn-primary"
              disabled={creating || !title.trim()}
            >
              {creating ? '创建中…' : '创建并进入'}
            </button>
          </>
        }
      >
        <form id="create-project-form" onSubmit={onCreate}>
          <div className="field">
            <label htmlFor="project-title">作品标题</label>
            <input
              id="project-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="书名 / 剧本名"
              autoFocus
            />
          </div>
          <SelectField
            label="作品类型"
            htmlFor="create-work-type"
            value={workType}
            onChange={setWorkType}
            options={WORK_TYPE_LIST.map((t) => ({ value: t.id, label: t.label }))}
          />
          <div className="field">
            <label>创作意图</label>
            <div className="creation-mode-list">
              {CREATION_MODE_LIST.map((m) => (
                <label key={m.id} className={`creation-mode-item ${creationMode === m.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="creation_mode"
                    value={m.id}
                    checked={creationMode === m.id}
                    onChange={() => setCreationMode(m.id)}
                  />
                  <span className="creation-mode-label">{m.label}</span>
                  <span className="creation-mode-desc">{m.description}</span>
                </label>
              ))}
            </div>
          </div>
          {creationMode === 'rewrite' && (
            <div className="field">
              <label htmlFor="rewrite-note">重写方向（可选）</label>
              <textarea
                id="rewrite-note"
                rows={2}
                value={rewriteNote}
                onChange={(e) => setRewriteNote(e.target.value)}
                placeholder="例如：保留前 5 章，从第 6 章起改女主动机…"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="project-summary">项目简述（可选）</label>
            <textarea
              id="project-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="一句话介绍故事核心，将显示在项目卡片上"
            />
          </div>
          <SelectField
            label="题材 / 风格"
            htmlFor="create-genre"
            value={genre}
            onChange={setGenre}
            options={genres.map((g) => ({ value: g, label: g }))}
          />
        </form>
      </Modal>

      <Modal
        open={!!renameTarget}
        onClose={() => !savingEdit && setRenameTarget(null)}
        title="重命名项目"
        footer={
          <>
            <button type="button" className="btn btn-ghost" disabled={savingEdit} onClick={() => setRenameTarget(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingEdit || !renameTitle.trim()}
              onClick={saveRename}
            >
              {savingEdit ? '保存中…' : '保存'}
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="rename-title">作品标题</label>
          <input
            id="rename-title"
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={!!summaryTarget}
        onClose={() => !savingEdit && setSummaryTarget(null)}
        title="编辑项目简述"
        footer={
          <>
            <button type="button" className="btn btn-ghost" disabled={savingEdit} onClick={() => setSummaryTarget(null)}>
              取消
            </button>
            <button type="button" className="btn btn-primary" disabled={savingEdit} onClick={saveSummary}>
              {savingEdit ? '保存中…' : '保存'}
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="edit-summary">简述（显示在项目卡片上）</label>
          <textarea
            id="edit-summary"
            rows={4}
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            placeholder="一句话介绍故事核心…"
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={batchDeleteOpen}
        onClose={() => !batchWorking && setBatchDeleteOpen(false)}
        title="批量删除"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={batchWorking}
              onClick={() => setBatchDeleteOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary project-delete-confirm"
              disabled={batchWorking || selectedCount === 0}
              onClick={runBatchDelete}
            >
              {batchWorking ? '删除中…' : `确认删除 ${selectedCount} 部`}
            </button>
          </>
        }
      >
        <p>
          将永久删除已选的 <strong>{selectedCount}</strong> 部作品及全部文稿、大纲与设定，不可恢复。
        </p>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => {
          if (deleting) return
          setDeleteTarget(null)
          setDeleteConfirmTitle('')
        }}
        title="删除项目"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={deleting}
              onClick={() => { setDeleteTarget(null); setDeleteConfirmTitle('') }}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary project-delete-confirm"
              disabled={deleting || deleteConfirmTitle.trim() !== deleteTarget?.title}
              onClick={onDelete}
            >
              {deleting ? '删除中…' : '确认删除'}
            </button>
          </>
        }
      >
        {deleteTarget && (
          <>
            <p>
              将永久删除「<strong>{deleteTarget.title}</strong>」及全部文稿、大纲与设定，不可恢复。
            </p>
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="delete-confirm-title">
                请输入书名 <strong>{deleteTarget.title}</strong> 以确认
              </label>
              <input
                id="delete-confirm-title"
                value={deleteConfirmTitle}
                onChange={(e) => setDeleteConfirmTitle(e.target.value)}
                placeholder={deleteTarget.title}
                autoComplete="off"
              />
            </div>
          </>
        )}
      </Modal>

      <ProjectShareModal
        project={shareTarget}
        open={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        onSaved={(updated) => {
          setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
        }}
      />
    </div>
  )
}
