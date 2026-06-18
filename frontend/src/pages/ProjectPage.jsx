import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import ChatPanel from '../components/ChatPanel.jsx'
import LeftMenu from '../components/LeftMenu.jsx'
import ReaderPane from '../components/ReaderPane.jsx'
import { ScreenplayEditor } from '../features/screenplay/index.js'
import ResourceSidebar from '../components/ResourceSidebar.jsx'
import UploadModal from '../components/UploadModal.jsx'
import TakeoverReport from '../components/TakeoverReport.jsx'
import WorkspaceHeader from '../components/WorkspaceHeader.jsx'
import CreativeProgressCard from '../components/CreativeProgressCard.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import ProjectSettingsModal from '../components/ProjectSettingsModal.jsx'
import WritePreviewModal from '../components/WritePreviewModal.jsx'
import GlobalSearchModal from '../components/GlobalSearchModal.jsx'
import ShortcutsModal from '../components/ShortcutsModal.jsx'
import ExportModal from '../components/ExportModal.jsx'
import {
  createManuscript,
  createSession,
  deleteChapter,
  deleteSession,
  focusSession,
  activateSession,
  getChapter,
  getProject,
  getProjectFile,
  getWorkspaceFile,
  listSessions,
  listProjectFiles,
  refreshProjectWorkspace,
  saveChapter,
  saveProjectFile,
  updateProject,
  uploadProjectFile,
} from '../api.js'
import { useToast } from '../components/Toast.jsx'
import { shouldShowTakeover, unitLabel } from '../lib/projectProfile.js'
import { recordRecentOpen } from '../lib/homeProjectPrefs.js'
import { SESSION_SCOPE_PROJECT } from '../lib/sessionScope.js'
import { useInlineEdit } from '../hooks/useInlineEdit.js'
import { loadContextPrefs } from '../lib/contextPrefs.js'

const RESOURCE_PANELS = ['manuscripts', 'outline', 'settings', 'archive', 'draft']

function isScreenplayType(workType) {
  return ['screenplay_film', 'screenplay_series', 'web_short'].includes(workType)
}

export default function ProjectPage() {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [chapters, setChapters] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedMeta, setSelectedMeta] = useState(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [contentSource, setContentSource] = useState('manuscript')
  const [contentLoading, setContentLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autoSaveHint, setAutoSaveHint] = useState('')
  const [error, setError] = useState('')
  const showToast = useToast()
  const dirty = selected && content !== savedContent
  const [currentChapter, setCurrentChapter] = useState(1)

  const [resourcePanel, setResourcePanel] = useState(null)
  const resourceInitRef = useRef(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [showTakeover, setShowTakeover] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const [writePreview, setWritePreview] = useState(null)
  const [mobileTab, setMobileTab] = useState('edit')
  const [newManuscriptOpen, setNewManuscriptOpen] = useState(false)
  const [newManuscriptTitle, setNewManuscriptTitle] = useState('未命名')
  const [creatingManuscript, setCreatingManuscript] = useState(false)
  const [deleteSessionId, setDeleteSessionId] = useState(null)
  const [deletingSession, setDeletingSession] = useState(false)
  const [deleteChapterTarget, setDeleteChapterTarget] = useState(null)
  const [deletingChapter, setDeletingChapter] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState('project')
  const [exportChapter, setExportChapter] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [outlineAvailableHint, setOutlineAvailableHint] = useState(false)
  const [workspaceSummary, setWorkspaceSummary] = useState(null)
  const [refreshingWorkspace, setRefreshingWorkspace] = useState(false)
  const [filesRefreshKey, setFilesRefreshKey] = useState(0)
  const pendingNavRef = useRef(null)
  const selectionRef = useRef(null)
  const takeoverCheckedRef = useRef(false)
  const autoSaveTimerRef = useRef(null)

  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [pendingPlanExecution, setPendingPlanExecution] = useState(null)
  const [planExecReady, setPlanExecReady] = useState(true)

  const chatPanelRef = useRef(null)
  const sessionFocusRef = useRef('')

  const { runInlineEdit, busy: inlineEditBusyKey } = useInlineEdit(projectId, {
    onResult: (msg) => {
      const sel = selectionRef.current
      if (!sel) return
      setWritePreview({
        inline: true,
        title: '行内 AI',
        oldContent: sel.text,
        newContent: msg.replacement,
        selectionRange: { start: sel.start, end: sel.end },
      })
    },
    onError: (err) => showToast(err.message || '行内 AI 失败', 'error'),
  })

  const inlineEditBusy = inlineEditBusyKey || ''

  const applySessionFocus = useCallback((result) => {
    if (result?.sessions) setSessions(result.sessions)
    const sid = result?.active_session_id || result?.session?.id || ''
    if (sid) setActiveSessionId(sid)
  }, [])

  const focusChapterChat = useCallback(async (ch) => {
    if (!ch?.filename) return
    const key = ch.filename
    if (sessionFocusRef.current === key) return
    sessionFocusRef.current = key
    try {
      const result = await focusSession(projectId, {
        scope: 'chapter',
        filename: ch.filename,
        title: ch.title,
      })
      applySessionFocus(result)
    } catch (e) {
      sessionFocusRef.current = ''
      showToast(e.message, 'error')
    }
  }, [projectId, applySessionFocus, showToast])

  const focusProjectChat = useCallback(async () => {
    if (sessionFocusRef.current === SESSION_SCOPE_PROJECT) return
    sessionFocusRef.current = SESSION_SCOPE_PROJECT
    try {
      const result = await focusSession(projectId, { scope: 'project' })
      applySessionFocus(result)
    } catch (e) {
      sessionFocusRef.current = ''
      showToast(e.message, 'error')
    }
  }, [projectId, applySessionFocus, showToast])

  const refresh = useCallback(() => {
    return getProject(projectId)
      .then((p) => {
        setProject(p)
        setChapters(p.chapters || [])
        setError('')
        return p
      })
      .catch((e) => {
        setError(e.message)
        throw e
      })
  }, [projectId])

  useEffect(() => {
    if (projectId) recordRecentOpen(projectId)
  }, [projectId])

  useEffect(() => {
    setProject(null)
    setChapters([])
    setSelected(null)
    setSelectedMeta(null)
    setContent('')
    setSavedContent('')
    setContentSource('manuscript')
    setContentLoading(false)
    setError('')
    setSessions([])
    setActiveSessionId('')
    setShowTakeover(false)
    setResourcePanel(null)
    resourceInitRef.current = false
    takeoverCheckedRef.current = false
    sessionFocusRef.current = ''
    setAutoSaveHint('')
  }, [projectId])

  const refreshSessions = useCallback(() => {
    listSessions(projectId)
      .then((index) => {
        setSessions(index.sessions || [])
        setActiveSessionId(index.active_session_id || '')
      })
      .catch(() => {})
  }, [projectId])

  const applyLoadedContent = useCallback((text) => {
    setContent(text)
    setSavedContent(text)
    setAutoSaveHint('')
  }, [])

  const runPendingNav = useCallback(() => {
    const fn = pendingNavRef.current
    pendingNavRef.current = null
    setDiscardOpen(false)
    fn?.()
  }, [])

  const guardNavigation = useCallback((action) => {
    if (!dirty) {
      action()
      return
    }
    pendingNavRef.current = action
    setDiscardOpen(true)
  }, [dirty])

  const loadManuscript = useCallback((ch, { force = false } = {}) => {
    const load = () => {
      setMobileTab('edit')
      setSelected(ch.filename)
      setSelectedMeta(ch)
      setContentSource('manuscript')
      const idx = chapters.findIndex((c) => c.filename === ch.filename)
      if (idx >= 0) setCurrentChapter(idx + 1)
      setContent('')
      setSavedContent('')
      setContentLoading(true)
      focusChapterChat(ch)
      getChapter(projectId, ch.filename)
        .then((c) => applyLoadedContent(c.content))
        .catch((e) => setError(e.message))
        .finally(() => setContentLoading(false))
    }
    if (force) load()
    else guardNavigation(load)
  }, [projectId, chapters, guardNavigation, applyLoadedContent, focusChapterChat])

  const loadFile = useCallback((panel, item, { force = false } = {}) => {
    const categoryMap = {
      outline: 'outline',
      settings: 'settings',
      archive: 'archive',
      draft: 'draft',
    }
    const category = categoryMap[panel]
    if (!category) return
    const load = () => {
      setMobileTab('edit')
      setSelected(item.filename)
      setSelectedMeta({ ...item, sourceLabel: panel })
      setContentSource(panel)
      focusProjectChat()
      setContent('')
      setSavedContent('')
      setContentLoading(true)
      getProjectFile(projectId, category, item.filename)
        .then((c) => applyLoadedContent(c.content))
        .catch((e) => setError(e.message))
        .finally(() => setContentLoading(false))
    }
    if (force) load()
    else guardNavigation(load)
  }, [projectId, guardNavigation, applyLoadedContent, focusProjectChat])

  const handleSave = useCallback(async ({ silent = false } = {}) => {
    if (!selected || !dirty || saving) return false
    setSaving(true)
    if (!silent) setError('')
    try {
      const categoryMap = {
        manuscript: null,
        outline: 'outline',
        settings: 'settings',
        archive: 'archive',
        draft: 'draft',
      }
      const cat = categoryMap[contentSource]
      const saved = cat
        ? await saveProjectFile(projectId, cat, selected, content)
        : await saveChapter(projectId, selected, content)
      setSavedContent(content)
      setSelectedMeta((prev) => (prev ? { ...prev, words: saved.words, title: saved.title } : prev))
      if (silent) {
        setAutoSaveHint('已自动保存')
        setTimeout(() => setAutoSaveHint(''), 3000)
      } else {
        showToast('已保存')
      }
      if (contentSource === 'manuscript') await refresh()
      return true
    } catch (e) {
      setError(e.message)
      if (!silent) showToast(e.message, 'error')
      return false
    } finally {
      setSaving(false)
    }
  }, [selected, dirty, saving, contentSource, projectId, content, showToast, refresh])

  useEffect(() => {
    refresh().then(refreshSessions).catch(() => {})
    refreshProjectWorkspace(projectId)
      .then((data) => {
        setWorkspaceSummary(data.summary || null)
        if ((data.summary?.outline_count ?? 0) > 0) {
          setOutlineAvailableHint(true)
        }
      })
      .catch(() => {})
  }, [projectId, refresh, refreshSessions])

  useEffect(() => {
    if (chapters.length > 0 && !resourceInitRef.current) {
      setResourcePanel('manuscripts')
      resourceInitRef.current = true
    }
  }, [chapters.length])

  useEffect(() => {
    if (!location.state?.openUpload) return
    setUploadOpen(true)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state?.openUpload, location.pathname, navigate])

  useEffect(() => {
    if (!project || takeoverCheckedRef.current) return
    takeoverCheckedRef.current = true
    if (shouldShowTakeover(project, project.chapters || chapters)) {
      setShowTakeover(true)
    }
  }, [project, chapters])

  useEffect(() => {
    if (chapters.length > 0) {
      setCurrentChapter(chapters.length + 1)
      if (!selected && !pendingPlanExecution) {
        loadManuscript(chapters[chapters.length - 1], { force: true })
      }
    }
  }, [chapters.length, selected, loadManuscript, pendingPlanExecution])

  useEffect(() => {
    if (!dirty || saving) return undefined
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave({ silent: true })
    }, 2500)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [content, dirty, saving, handleSave])

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const handleUpload = async (file, subdir) => {
    const res = await uploadProjectFile(projectId, file, subdir)
    const p = await refresh()
    setUploadOpen(false)
    const chs = p.chapters || res.chapters || []
    if (res.import_warning) {
      showToast(res.import_warning, 'error')
    } else if (chs.length > 0) {
      showToast('导入完成，可在「更多 → 项目诊断」查看建议', 'success')
    } else {
      showToast('文件已导入，当前目录下暂无可识别的章节', 'info')
    }
    if ((subdir === '正文' || subdir === '试验稿' || res.upload_type === 'zip') && chs.length > 0) {
      loadManuscript(chs[chs.length - 1], { force: true })
    }
    return res
  }

  const handleTogglePanel = (panelId) => {
    if (panelId === 'upload') {
      setUploadOpen(true)
      return
    }
    if (!RESOURCE_PANELS.includes(panelId)) return
    setResourcePanel((prev) => (prev === panelId ? null : panelId))
  }

  const openNewManuscriptModal = () => {
    setNewManuscriptTitle('未命名')
    setNewManuscriptOpen(true)
  }

  const handleNewManuscript = async (e) => {
    e?.preventDefault()
    const title = newManuscriptTitle.trim()
    if (!title) return
    setCreatingManuscript(true)
    try {
      const created = await createManuscript(projectId, title)
      await refresh()
      setNewManuscriptOpen(false)
      loadManuscript(
        { filename: created.filename, title: created.title, words: created.words },
        { force: true },
      )
      showToast('已创建新文稿')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setCreatingManuscript(false)
    }
  }

  const handleSaveSettings = async (patch) => {
    setSettingsSaving(true)
    try {
      const updated = await updateProject(projectId, patch)
      setProject((prev) => ({ ...prev, ...updated }))
      if (updated.chapters) setChapters(updated.chapters)
      setSettingsOpen(false)
      showToast('项目设置已更新')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSessionChange = async (sid) => {
    const prev = activeSessionId
    setActiveSessionId(sid)
    const entry = sessions.find((s) => s.id === sid)
    sessionFocusRef.current = entry?.bound_filename || SESSION_SCOPE_PROJECT
    try {
      await activateSession(projectId, sid)
    } catch (e) {
      setActiveSessionId(prev)
      showToast(e.message, 'error')
    }
  }

  const handleCreateSession = async () => {
    try {
      const title = contentSource === 'manuscript' && selectedMeta?.title
        ? `本章 · ${selectedMeta.title}`
        : '全书讨论'
      const session = await createSession(projectId, title, {
        bound_filename: contentSource === 'manuscript' && selected ? selected : SESSION_SCOPE_PROJECT,
      })
      if (contentSource === 'manuscript' && selected) {
        sessionFocusRef.current = selected
      } else {
        sessionFocusRef.current = SESSION_SCOPE_PROJECT
      }
      refreshSessions()
      setActiveSessionId(session.id)
    } catch (e) { setError(e.message) }
  }

  const handleDeleteSession = (sid) => {
    setDeleteSessionId(sid)
  }

  const handleDeleteManuscript = (item) => {
    if (!item?.filename) return
    setDeleteChapterTarget(item)
  }

  const confirmDeleteChapter = async () => {
    if (!deleteChapterTarget) return
    setDeletingChapter(true)
    try {
      const res = await deleteChapter(projectId, deleteChapterTarget.filename)
      const nextChapters = res.chapters || []
      setChapters(nextChapters)
      if (selected === deleteChapterTarget.filename) {
        const next = nextChapters[nextChapters.length - 1]
        if (next) {
          await loadManuscript(next, { force: true })
        } else {
          setSelected(null)
          setSelectedMeta(null)
          setContent('')
          setSavedContent('')
          setContentSource('manuscript')
        }
      }
      sessionFocusRef.current = ''
      await refresh()
      await refreshSessions()
      setDeleteChapterTarget(null)
      showToast('已删除文稿')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setDeletingChapter(false)
    }
  }

  const confirmDeleteSession = async () => {
    if (!deleteSessionId) return
    setDeletingSession(true)
    try {
      const index = await deleteSession(projectId, deleteSessionId)
      refreshSessions()
      setActiveSessionId(index.active_session_id || '')
      setDeleteSessionId(null)
      showToast('已删除会话')
    } catch (e) {
      setError(e.message)
      showToast(e.message, 'error')
    } finally {
      setDeletingSession(false)
    }
  }

  const onApplyWritePlan = useCallback((plan) => {
    chatPanelRef.current?.triggerWrite(plan)
  }, [])

  const onWriteResult = useCallback(async (result) => {
    await refresh()
    if (result?.filename) {
      showToast(`文稿已更新：${result.title || result.filename}`, 'info')
    }
  }, [refresh, showToast])

  const handleRefreshWorkspace = useCallback(async ({ manual = false, openOutline = manual } = {}) => {
    setRefreshingWorkspace(true)
    try {
      const data = await refreshProjectWorkspace(projectId)
      const p = await refresh()
      setChapters(p.chapters || [])
      setWorkspaceSummary(data.summary || null)
      setFilesRefreshKey((k) => k + 1)

      const outlineCount = data.summary?.outline_count ?? 0
      if (outlineCount > 0) {
        setOutlineAvailableHint(true)
        if (openOutline) {
          setResourcePanel('outline')
          if ((p.chapters?.length ?? 0) === 0 && contentSource === 'manuscript' && !selected) {
            try {
              const outlines = await listProjectFiles(projectId, 'outline')
              if (outlines.length) {
                loadFile('outline', outlines[0], { force: true })
              }
            } catch {}
          }
        }
      }

      const moved = data.moved?.length ?? 0
      const hint = outlineCount > 0 ? `（大纲 ${outlineCount} 个）` : ''
      const movedHint = moved > 0 ? `，已归位 ${moved} 个文件` : ''
      showToast(
        manual ? `已刷新项目文件列表${hint}${movedHint}` : `项目文件已同步${hint}`,
        'success',
      )
    } catch (e) {
      showToast(e.message || '刷新失败', 'error')
    } finally {
      setRefreshingWorkspace(false)
    }
  }, [projectId, refresh, showToast, contentSource, selected, loadFile])

  const handleWorkspaceChanged = useCallback(async (msg) => {
    if (msg?.manual) {
      await handleRefreshWorkspace({ manual: true, openOutline: true })
      return
    }
    const p = await refresh()
    setChapters(p.chapters || [])
    setFilesRefreshKey((k) => k + 1)
    if (msg?.summary) setWorkspaceSummary(msg.summary)
    const changes = msg?.changes || []
    const outlineCount = msg?.summary?.outline_count ?? 0
    if (outlineCount > 0) {
      setOutlineAvailableHint(true)
      if ((p.chapters?.length ?? 0) === 0) {
        setResourcePanel('outline')
      }
    }
    if (changes.length) {
      showToast(`AI 更新了 ${changes.length} 个文件，可在对话中点「预览」查看`, 'info')
    }
  }, [refresh, showToast, handleRefreshWorkspace])

  const handlePreviewWorkspaceFile = useCallback(async (fileMeta) => {
    try {
      const data = fileMeta?.rel_path
        ? await getWorkspaceFile(projectId, { rel_path: fileMeta.rel_path })
        : await getProjectFile(projectId, fileMeta.category, fileMeta.filename)
      setWritePreview({
        previewOnly: true,
        title: fileMeta.title || fileMeta.filename,
        filename: fileMeta.filename,
        displayPath: fileMeta.display_path,
        category: fileMeta.category,
        panel: fileMeta.panel,
        rel_path: fileMeta.rel_path,
        newContent: data.content,
        oldContent: '',
      })
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [projectId, showToast])

  const handlePreviewOpenInPanel = useCallback(() => {
    if (!writePreview) return
    const { panel, filename, category, title, words } = writePreview
    setWritePreview(null)
    if (panel === 'manuscripts' || category === 'manuscript') {
      setResourcePanel('manuscripts')
      loadManuscript({ filename, title, words }, { force: true })
    } else if (panel) {
      setResourcePanel(panel)
      loadFile(panel, { filename, title }, { force: true })
    }
  }, [writePreview, loadManuscript, loadFile])

  const handleWritePreviewOpen = () => {
    if (!writePreview) return
    const { filename, title, words, newContent } = writePreview
    setWritePreview(null)
    loadManuscript({ filename, title, words }, { force: true })
    applyLoadedContent(newContent)
  }

  const handleWritePreviewReplace = async () => {
    if (!writePreview || !selected) {
      showToast('请先打开要替换的文稿', 'error')
      return
    }
    const { newContent } = writePreview
    setWritePreview(null)
    try {
      const categoryMap = {
        manuscript: null,
        outline: 'outline',
        settings: 'settings',
        archive: 'archive',
        draft: 'draft',
      }
      const cat = categoryMap[contentSource]
      const saved = cat
        ? await saveProjectFile(projectId, cat, selected, newContent)
        : await saveChapter(projectId, selected, newContent)
      setContent(newContent)
      setSavedContent(newContent)
      setSelectedMeta((prev) => (prev ? { ...prev, words: saved.words, title: saved.title } : prev))
      showToast('已用生成内容更新并保存当前文稿')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleDiscussSelection = useCallback((snippet, label) => {
    setMobileTab('chat')
    requestAnimationFrame(() => {
      chatPanelRef.current?.discussSelection(snippet, label)
    })
  }, [])

  const handleInlineEdit = useCallback((action, selection) => {
    selectionRef.current = selection
    const before = content.slice(Math.max(0, selection.start - 400), selection.start)
    const after = content.slice(selection.end, selection.end + 400)
    runInlineEdit({
      action,
      selectedText: selection.text,
      chapterTitle: selectedMeta?.title,
      contextBefore: before,
      contextAfter: after,
      contextOptions: loadContextPrefs(projectId),
    })
  }, [content, selectedMeta?.title, runInlineEdit])

  const handleApplyInlineEdit = useCallback(() => {
    if (!writePreview?.inline || !writePreview.selectionRange) return
    const { start, end } = writePreview.selectionRange
    const merged = content.slice(0, start) + writePreview.newContent + content.slice(end)
    setWritePreview(null)
    setContent(merged)
    selectionRef.current = null
    showToast('已替换选中文字', 'success')
  }, [writePreview, content, showToast])

  const handleSearchOpenHit = useCallback((hit) => {
    const categoryToPanel = {
      manuscript: 'manuscript',
      draft: 'draft',
      outline: 'outline',
      settings: 'settings',
      archive: 'archive',
    }
    const panel = categoryToPanel[hit.category] || 'manuscript'
    if (panel === 'manuscript') {
      loadManuscript({ filename: hit.filename, title: hit.title }, { force: true })
    } else {
      loadFile(panel, { filename: hit.filename, title: hit.title }, { force: true })
    }
    showToast(`已打开 ${hit.title}（第 ${hit.line} 行附近）`, 'info')
  }, [loadManuscript, loadFile, showToast])

  const handleOpenOutlinePanel = useCallback(() => {
    setResourcePanel('outline')
    setMobileTab('edit')
  }, [])

  const focusChat = useCallback(() => {
    setMobileTab('chat')
    requestAnimationFrame(() => {
      chatPanelRef.current?.focusComposer?.()
    })
  }, [])

  const handleTakeoverDone = async () => {
    setShowTakeover(false)
    try {
      const p = await refresh()
      setChapters(p.chapters || [])
    } catch {}
  }

  const handleRunPrompt = (prompt) => {
    setPendingPrompt(prompt)
  }

  useEffect(() => {
    if (pendingPrompt && chatPanelRef.current) {
      chatPanelRef.current.sendMessage(pendingPrompt)
      setPendingPrompt('')
    }
  }, [pendingPrompt, activeSessionId])

  useEffect(() => {
    const plan = location.state?.pendingPlanExecution
    if (!plan?.id) return
    navigate(location.pathname, { replace: true, state: {} })
    setMobileTab('chat')
    setPendingPlanExecution(plan)
    setPlanExecReady(false)
    sessionFocusRef.current = SESSION_SCOPE_PROJECT
    focusProjectChat()
      .then(() => setPlanExecReady(true))
      .catch(() => setPlanExecReady(true))
  }, [location.state?.pendingPlanExecution, location.pathname, navigate, focusProjectChat])

  useEffect(() => {
    const write = location.state?.pendingWrite
    if (!write?.chapter) return
    navigate(location.pathname, { replace: true, state: {} })
    setMobileTab('chat')
    sessionFocusRef.current = SESSION_SCOPE_PROJECT
    focusProjectChat()
      .then(() => {
        requestAnimationFrame(() => {
          chatPanelRef.current?.triggerWrite(write)
        })
      })
      .catch(() => {
        requestAnimationFrame(() => {
          chatPanelRef.current?.triggerWrite(write)
        })
      })
  }, [location.state?.pendingWrite, location.pathname, navigate, focusProjectChat])

  useEffect(() => {
    const msg = location.state?.pendingChatMessage
    if (!msg?.trim()) return
    navigate(location.pathname, { replace: true, state: {} })
    setMobileTab('chat')
    requestAnimationFrame(() => {
      chatPanelRef.current?.sendMessage(msg.trim())
    })
  }, [location.state?.pendingChatMessage, location.pathname, navigate])

  const manuscriptIndex =
    contentSource === 'manuscript' && selected
      ? chapters.findIndex((c) => c.filename === selected)
      : -1

  const navigateManuscript = useCallback((delta) => {
    if (manuscriptIndex < 0) return
    const target = chapters[manuscriptIndex + delta]
    if (target) loadManuscript(target)
  }, [manuscriptIndex, chapters, loadManuscript])

  const chapterNav =
    contentSource === 'manuscript' && manuscriptIndex >= 0 && chapters.length > 1
      ? {
          enabled: true,
          index: manuscriptIndex,
          total: chapters.length,
          unit: unitLabel(project, 1),
          hasPrev: manuscriptIndex > 0,
          hasNext: manuscriptIndex < chapters.length - 1,
          onPrev: () => navigateManuscript(-1),
          onNext: () => navigateManuscript(1),
        }
      : null

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      const mod = e.metaKey || e.ctrlKey

      if (e.key === '?' && !inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key === 'Escape') {
        if (focusMode) {
          setFocusMode(false)
          e.preventDefault()
        }
        return
      }
      if (e.key === 'f' && !inField && !mod && !e.altKey) {
        e.preventDefault()
        setFocusMode((v) => !v)
        return
      }
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (!mod || inField) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateManuscript(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateManuscript(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode, navigateManuscript])

  const leftActivePanel = resourcePanel

  if (!project && !error) {
    return (
      <div className="reader-loading workspace-loading-full">
        <div className="loading-dots"><span /><span /><span /></div>
        加载项目…
      </div>
    )
  }

  if (error && !project) {
    return (
      <div style={{ padding: 40 }}>
        <Link to="/projects" className="workspace-toolbar-back">← 返回项目库</Link>
        <div className="error-banner" style={{ marginTop: 16 }}>{error}</div>
      </div>
    )
  }

  return (
    <div
      className={`workspace-layout ${resourcePanel ? 'has-resource' : ''} workspace-tab-${mobileTab} ${focusMode ? 'focus-mode' : ''}`}
    >
      <div className="workspace-mobile-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'edit'}
          className={mobileTab === 'edit' ? 'active' : ''}
          onClick={() => setMobileTab('edit')}
        >
          编辑
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'resources'}
          className={mobileTab === 'resources' ? 'active' : ''}
          onClick={() => {
            setMobileTab('resources')
            if (!resourcePanel) setResourcePanel('manuscripts')
          }}
        >
          资源
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'chat'}
          className={mobileTab === 'chat' ? 'active' : ''}
          onClick={() => setMobileTab('chat')}
        >
          对话
        </button>
      </div>
      {showTakeover && (
        <TakeoverReport
          projectId={projectId}
          project={project}
          onDone={handleTakeoverDone}
          onRunPrompt={handleRunPrompt}
        />
      )}

      <ConfirmModal
        open={discardOpen}
        onClose={() => { pendingNavRef.current = null; setDiscardOpen(false) }}
        onConfirm={runPendingNav}
        title="未保存的修改"
        message="当前文稿有未保存的修改，确定放弃并切换吗？"
        confirmLabel="放弃修改"
        danger
      />

      <ConfirmModal
        open={!!deleteSessionId}
        onClose={() => !deletingSession && setDeleteSessionId(null)}
        onConfirm={confirmDeleteSession}
        title="删除会话"
        message="将永久删除该会话及其全部对话记录，不可恢复。"
        confirmLabel="删除"
        danger
        loading={deletingSession}
      />

      <ConfirmModal
        open={!!deleteChapterTarget}
        onClose={() => !deletingChapter && setDeleteChapterTarget(null)}
        onConfirm={confirmDeleteChapter}
        title="删除文稿"
        message={
          deleteChapterTarget
            ? `确定删除「${deleteChapterTarget.title || deleteChapterTarget.filename}」吗？文件将从项目中永久移除，不可恢复。${
                dirty && selected === deleteChapterTarget.filename ? ' 当前未保存的修改将一并丢失。' : ''
              }`
            : ''
        }
        confirmLabel="删除"
        danger
        loading={deletingChapter}
      />

      <Modal
        open={newManuscriptOpen}
        onClose={() => !creatingManuscript && setNewManuscriptOpen(false)}
        title="新建文稿"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={creatingManuscript}
              onClick={() => setNewManuscriptOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              form="new-manuscript-form"
              className="btn btn-primary"
              disabled={creatingManuscript || !newManuscriptTitle.trim()}
            >
              {creatingManuscript ? '创建中…' : '创建'}
            </button>
          </>
        }
      >
        <form id="new-manuscript-form" onSubmit={handleNewManuscript}>
          <div className="field">
            <label htmlFor="new-manuscript-title">文稿标题</label>
            <input
              id="new-manuscript-title"
              value={newManuscriptTitle}
              onChange={(e) => setNewManuscriptTitle(e.target.value)}
              placeholder="章节名 / 场景名"
              autoFocus
            />
          </div>
        </form>
      </Modal>

      <ProjectSettingsModal
        open={settingsOpen}
        project={project}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        saving={settingsSaving}
      />

      <WritePreviewModal
        open={!!writePreview}
        preview={writePreview}
        onClose={() => setWritePreview(null)}
        onOpenNew={handleWritePreviewOpen}
        onReplace={handleWritePreviewReplace}
        onApplyInline={handleApplyInlineEdit}
        onOpenInPanel={writePreview?.previewOnly ? handlePreviewOpenInPanel : undefined}
      />

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        projectId={projectId}
        onOpenHit={handleSearchOpenHit}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        scope={exportScope}
        projectId={projectId}
        projectTitle={project?.title}
        chapterFilename={exportChapter?.filename}
        chapterTitle={exportChapter?.title}
      />

      <LeftMenu
        activePanel={leftActivePanel}
        onToggle={handleTogglePanel}
        onExportProject={() => {
          setExportScope('project')
          setExportChapter(null)
          setExportOpen(true)
        }}
        project={project}
        chapterCount={chapters.length}
      />

      <ResourceSidebar
        panel={resourcePanel}
        project={project}
        chapters={chapters}
        selected={selected}
        onSelectManuscript={(ch) => loadManuscript(ch)}
        onSelectFile={(panel, item) => loadFile(panel, item)}
        onClose={() => setResourcePanel(null)}
        onNewManuscript={openNewManuscriptModal}
        onDeleteManuscript={handleDeleteManuscript}
        onImport={() => setUploadOpen(true)}
        onFocusChat={focusChat}
        onShowDiagnosis={() => setShowTakeover(true)}
        outlineCount={workspaceSummary?.outline_count ?? 0}
        onOpenOutline={handleOpenOutlinePanel}
        filesRefreshKey={filesRefreshKey}
      />

      <div className="reader-center">
        <WorkspaceHeader
          project={project}
          projectId={projectId}
          chapters={chapters}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((v) => !v)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenUpload={() => setUploadOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onShowTakeover={() => setShowTakeover(true)}
          onRefreshWorkspace={() => handleRefreshWorkspace({ manual: true })}
          refreshingWorkspace={refreshingWorkspace}
          workspaceSummary={workspaceSummary}
          onExportProject={() => {
            setExportScope('project')
            setExportChapter(null)
            setExportOpen(true)
          }}
        />
        {!focusMode && !isScreenplayType(project?.work_type) && (
          <CreativeProgressCard
            projectId={projectId}
            project={project}
            chapters={chapters}
            compact
          />
        )}
        {error && <div className="workspace-inline-error">{error}</div>}
        {isScreenplayType(project?.work_type) ? (
          <ScreenplayEditor
            project={project}
            projectId={projectId}
            onOpenFile={(filename) => {
              // 打开文件时切换到 ReaderPane 模式
              const ch = chapters.find(c => c.filename === filename);
              if (ch) loadManuscript(ch);
            }}
          />
        ) : (
          <ReaderPane
            chapter={selectedMeta}
            content={content}
            onChange={setContent}
            onSave={() => handleSave()}
            onDiscussSelection={handleDiscussSelection}
            onInlineEdit={handleInlineEdit}
            inlineEditBusy={inlineEditBusy}
            onOutlineSynopsisChange={(nextMd) => setContent(nextMd)}
            loading={contentLoading}
            saving={saving}
            dirty={dirty}
            autoSaveHint={autoSaveHint}
            project={project}
            contentSource={contentSource}
            chapterNav={chapterNav}
            chapterCount={chapters.length}
            outlineCount={workspaceSummary?.outline_count ?? 0}
            onOpenOutline={handleOpenOutlinePanel}
            onImport={() => setUploadOpen(true)}
            onNewManuscript={openNewManuscriptModal}
            onFocusChat={focusChat}
            onShowDiagnosis={() => setShowTakeover(true)}
            onDeleteChapter={contentSource === 'manuscript' ? handleDeleteManuscript : undefined}
            onExportChapter={
              contentSource === 'manuscript'
                ? (ch) => {
                    setExportScope('chapter')
                    setExportChapter(ch)
                    setExportOpen(true)
                  }
                : undefined
            }
          />
        )}
      </div>

      <div className="chat-right-panel">
        <ChatPanel
          ref={chatPanelRef}
          project={project}
          projectId={projectId}
          chapterCount={chapters.length}
          currentChapter={currentChapter}
          activeManuscript={contentSource === 'manuscript' ? selectedMeta : null}
          sessions={sessions}
          chapters={chapters}
          activeSessionId={activeSessionId}
          onSessionChange={handleSessionChange}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          onRefreshSessions={refreshSessions}
          onSessionSync={setActiveSessionId}
          onApplyWritePlan={onApplyWritePlan}
          onWriteResult={onWriteResult}
          onError={setError}
          onWorkspaceChanged={handleWorkspaceChanged}
          onPreviewFile={handlePreviewWorkspaceFile}
          outlineAvailableHint={outlineAvailableHint}
          onOpenOutlinePanel={handleOpenOutlinePanel}
          refreshingWorkspace={refreshingWorkspace}
          pendingPlanExecution={pendingPlanExecution}
          planExecReady={planExecReady}
          onPendingPlanExecutionConsumed={() => setPendingPlanExecution(null)}
        />
      </div>

      <UploadModal
        open={uploadOpen}
        project={project}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  )
}
