import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { getHealth, getSession, clearSessionMessages, getSessionMemory, completeStoryPlan } from '../api.js'
import { loadContextPrefs } from '../lib/contextPrefs.js'
import { createWebSocket } from '@/services/ws.ts'
import { useChatStore } from '@/stores/chatStore.ts'
import SessionSelector from './SessionSelector.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import ChatMessageBody from './ChatMessageBody.jsx'
import ChatBubble from './ChatBubble.jsx'
import { useToast } from './Toast.jsx'
import CliCompatNotice from '../features/ai-center/components/CliCompatNotice.jsx'
import { quickPromptsFor, unitLabel } from '../lib/projectProfile.js'
import { isChapterSession, sessionScopeLabel } from '../lib/sessionScope.js'

function stripWritePlan(text) {
  return text.replace(/```write_plan[\s\S]*?```/gi, '').trim()
}

function mergePlanCardIntoMessages(msgs, card) {
  if (!card?.id || !Array.isArray(msgs)) return msgs
  if (msgs.some((m) => m.plan_execution?.id === card.id)) return msgs
  const cardMsg = {
    role: 'assistant',
    plan_execution: card,
    content: '',
    at: new Date().toISOString(),
  }
  const userIdx = msgs.findIndex(
    (m) => m.role === 'user' && (
      m.content?.includes(String(card.id))
      || (card.user_message && m.content === card.user_message)
    ),
  )
  if (userIdx >= 0) {
    return [...msgs.slice(0, userIdx), cardMsg, ...msgs.slice(userIdx)]
  }
  return msgs
}

function connectionLabel(status, contextSummary, u, emptyManuscripts, isReplying, streamText, inference) {
  if (isReplying) {
    return streamText ? '助手回复中…' : '助手思考中…'
  }
  const modelTag = inference?.name || inference?.model
    ? ` · ${inference.name || inference.model}`
    : ''
  if (status === 'connected') {
    if (emptyManuscripts) {
      return `Claude Code${modelTag} 已连接 · 暂无文稿，可先聊创作方向`
    }
    const count = contextSummary?.chapter_count ?? 0
    const skill = contextSummary?.default_skill
    const base = `Claude Code${modelTag} · ${count} ${u}`
    return skill ? `${base} · ${skill}` : base
  }
  if (status === 'connecting') return '正在重新连接…'
  if (status === 'error') return '连接异常'
  return `正在连接 Claude Code${modelTag}…`
}

const ChatPanel = forwardRef(function ChatPanel(
  {
    project, projectId, currentChapter,
    sessions, chapters = [], activeSessionId, onSessionChange, onCreateSession, onDeleteSession, onRefreshSessions,
    onApplyWritePlan, onWriteResult, onError, onSessionSync,
    chapterCount = 0,
    activeManuscript = null,
    pendingPlanExecution = null,
    planExecReady = true,
    onPendingPlanExecutionConsumed,
  },
  ref,
) {
  const quickPrompts = quickPromptsFor(project)
  const u = unitLabel(project, 2)
  const emptyManuscripts = chapterCount === 0
  const [messages, setMessages] = useState([])
  const connectionStatus = useChatStore((s) => s.connectionStatus)
  const streaming = useChatStore((s) => s.streaming)
  const streamText = useChatStore((s) => s.streamText)
  const contextSummary = useChatStore((s) => s.contextSummary)
  const sessionMemory = useChatStore((s) => s.sessionMemory)
  const writeStatus = useChatStore((s) => s.writeStatus)
  const setConnectionStatus = useChatStore((s) => s.setConnectionStatus)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const appendStreamText = useChatStore((s) => s.appendStreamText)
  const resetStream = useChatStore((s) => s.resetStream)
  const mergeContextSummary = useChatStore((s) => s.mergeContextSummary)
  const setSessionMemory = useChatStore((s) => s.setSessionMemory)
  const setWriteStatus = useChatStore((s) => s.setWriteStatus)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [claudeAvailable, setClaudeAvailable] = useState(null)
  const [inference, setInference] = useState(null)
  const [apiModel, setApiModel] = useState(null)
  const [cliCompat, setCliCompat] = useState(null)
  const [promptsOpen, setPromptsOpen] = useState(emptyManuscripts)
  const [pendingReply, setPendingReply] = useState(false)
  const [activityHint, setActivityHint] = useState('')
  const [contextOpen, setContextOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [activePlanExec, setActivePlanExec] = useState(null)
  const [planCompleting, setPlanCompleting] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const pendingSendRef = useRef(null)
  const planExecCardRef = useRef(null)
  const planExecStartedRef = useRef(null)
  const scrollRef = useRef(null)
  const composerRef = useRef(null)
  const wsRef = useRef(null)
  const streamTextRef = useRef('')
  const streamFlushRef = useRef(null)
  const stickToBottomRef = useRef(true)
  const showToast = useToast()
  const setStreamText = useChatStore((s) => s.setStreamText)

  useEffect(() => {
    if (emptyManuscripts && messages.length === 0) setPromptsOpen(true)
  }, [emptyManuscripts, messages.length])

  const callbacksRef = useRef({})
  callbacksRef.current = { onError, onWriteResult, onRefreshSessions, onSessionSync }

  const scrollToBottom = (force = false) => {
    requestAnimationFrame(() => {
      if (!scrollRef.current) return
      if (!force && !stickToBottomRef.current) return
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
  }

  const onMessagesScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    stickToBottomRef.current = nearBottom
    setShowScrollBtn(!nearBottom && messages.length > 0)
  }

  const focusComposer = () => {
    requestAnimationFrame(() => {
      const el = composerRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  const loadSessionMemory = useCallback(() => {
    if (!activeSessionId) { setSessionMemory(null); return }
    getSessionMemory(projectId, activeSessionId)
      .then(setSessionMemory)
      .catch(() => setSessionMemory(null))
  }, [projectId, activeSessionId])

  const loadSessionMessages = useCallback(() => {
    if (!activeSessionId) { setMessages([]); return }
    if (planExecCardRef.current) return
    setLoading(true)
    getSession(projectId, activeSessionId)
      .then((session) => {
        const msgs = session.messages || []
        const card = planExecCardRef.current
        setMessages(card ? mergePlanCardIntoMessages(msgs, card) : msgs)
        if (session.memory_summary) {
          setSessionMemory({
            memory_summary: session.memory_summary,
            message_count: session.messages?.length || 0,
            has_memory: !!session.memory_summary?.trim(),
          })
        }
      })
      .catch((err) => callbacksRef.current.onError?.(err.message))
      .finally(() => setLoading(false))
  }, [projectId, activeSessionId])

  useEffect(() => { loadSessionMessages() }, [loadSessionMessages])
  useEffect(() => { loadSessionMemory() }, [loadSessionMemory])
  useEffect(() => { scrollToBottom() }, [messages, pendingReply, streaming, streamText])

  const handleRetry = (text) => {
    if (!text?.trim() || pendingReply || streaming) return
    onSend(text, { regenerate: true })
  }

  const handleRegenerate = (assistantIndex) => {
    if (pendingReply || streaming) return
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user' && messages[i].content?.trim()) {
        onSend(messages[i].content, { regenerate: true })
        return
      }
    }
    showToast('找不到可重试的提问', 'error')
  }

  useEffect(() => {
    getHealth()
      .then((h) => {
        setInference(h?.inference ?? null)
        setApiModel(h?.api_model ?? null)
        setClaudeAvailable(h?.claude_code?.available ?? null)
        setCliCompat(h?.cli_compat ?? null)
      })
      .catch(() => {
        setInference(null)
        setApiModel(null)
        setClaudeAvailable(null)
        setCliCompat(null)
      })
  }, [])

  const scheduleStreamFlush = useCallback(() => {
    if (streamFlushRef.current) return
    streamFlushRef.current = requestAnimationFrame(() => {
      setStreamText(streamTextRef.current)
      streamFlushRef.current = null
    })
  }, [])

  const handleReconnect = useCallback(() => {
    setConnectionStatus('connecting')
    wsRef.current?.reconnect?.()
  }, [])

  const finishStreaming = useCallback((reloadFromServer = true) => {
    const capturedStream = streamTextRef.current.trim()
    setPendingReply(false)
    setActivityHint('')
    resetStream()
    streamTextRef.current = ''
    if (streamFlushRef.current) {
      cancelAnimationFrame(streamFlushRef.current)
      streamFlushRef.current = null
    }

    if (capturedStream) {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.content === capturedStream) return prev
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: capturedStream }]
        }
        return [...prev, { role: 'assistant', content: capturedStream, at: new Date().toISOString() }]
      })
    }

    if (!reloadFromServer) return
    const activeId = callbacksRef.current._activeSessionId
    if (!activeId) return

    const syncFromServer = (attempt = 0) => {
      getSession(projectId, activeId)
        .then((session) => {
          const msgs = session.messages || []
          const card = planExecCardRef.current
          if (msgs.length) {
            setMessages(card ? mergePlanCardIntoMessages(msgs, card) : msgs)
          }
          const last = msgs[msgs.length - 1]
          if (last?.role === 'user' && attempt < 3) {
            setTimeout(() => syncFromServer(attempt + 1), 350 * (attempt + 1))
            return
          }
          if (last?.role === 'user') {
            showToast('助手未返回内容，请重试或检查 Claude Code 是否正常运行', 'error')
          }
        })
        .catch((err) => {
          if (attempt < 2) {
            setTimeout(() => syncFromServer(attempt + 1), 500)
            return
          }
          showToast(err.message || '同步对话失败', 'error')
        })
    }
    syncFromServer()
    callbacksRef.current.onRefreshSessions?.()
  }, [projectId, resetStream, showToast])

  const finishStreamingRef = useRef(finishStreaming)
  finishStreamingRef.current = finishStreaming
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast
  const runPlanExecutionRef = useRef(null)

  const onStop = useCallback(() => {
    wsRef.current?.cancel()
    finishStreaming(true)
    setWriteStatus('')
  }, [finishStreaming])

  useEffect(() => {
    const ws = createWebSocket(projectId, {
      onOpen: () => setConnectionStatus('connected'),
      onClose: () => setConnectionStatus('disconnected'),
      onStatus: (status, meta) => {
        if (status === 'connected') {
          setConnectionStatus('connected')
          return
        }
        if (status === 'thinking' || status === 'streaming') {
          setPendingReply(true)
          setStreaming(true)
          if (meta?.step) {
            const stepLabels = {
              'analyze-character': '分析人物',
              'generate-content': '生成内容',
              'review-content': '审稿',
            }
            const label = meta.label || stepLabels[meta.step] || meta.step
            setActivityHint(label)
          } else if (meta?.label) {
            setActivityHint(meta.label)
          } else if (status === 'thinking') {
            setActivityHint('AI 思考中…')
          } else if (status === 'streaming') {
            setActivityHint('AI 输出中…')
          }
        }
        if (status === 'done' || status === 'error' || status === 'cancelled') {
          finishStreamingRef.current(true)
          setActivePlanExec((prev) => (
            prev?.status === 'executing' ? { ...prev, status: 'await_complete' } : prev
          ))
        }
      },
      onContent: (text) => {
        setPendingReply(true)
        setStreaming(true)
        streamTextRef.current += text
        scheduleStreamFlush()
      },
      onContext: (ctx) => {
        mergeContextSummary(ctx)
      },
      onWriteResult: (result) => {
        setWriteStatus('')
        finishStreamingRef.current(true)
        callbacksRef.current.onWriteResult?.(result)
      },
      onSession: (meta) => {
        if (meta.sessionId) {
          callbacksRef.current._activeSessionId = meta.sessionId
          callbacksRef.current.onSessionSync?.(meta.sessionId)
        }
        if (Array.isArray(meta.messages) && meta.messages.length && !planExecCardRef.current) {
          setMessages(meta.messages)
        }
        if (meta.memory_summary !== undefined || meta.has_memory !== undefined) {
          setSessionMemory({
            memory_summary: meta.memory_summary || '',
            message_count: meta.message_count,
            has_memory: meta.has_memory ?? !!meta.memory_summary?.trim(),
          })
        }
      },
      onError: (err) => {
        const message = err?.message || '连接异常'
        callbacksRef.current.onError?.(message)
        showToastRef.current(message, 'error')
        finishStreamingRef.current(true)
        setWriteStatus('')
      },
      onStoryPlan: (msg) => {
        if (msg.summary?.trim()) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: msg.summary, at: new Date().toISOString() },
          ])
        }
        showToastRef.current(`已生成${msg.plan_type === 'rewrite' ? '改稿' : '修改'}计划，请到「修改计划」确认`, 'info')
        finishStreamingRef.current(true)
      },
      onTaskExecute: (msg) => {
        finishStreamingRef.current(true)
        const plan = msg.plan
        if (plan?.type === 'chapter_plan' && plan.chapter != null) {
          setPendingReply(true)
          setStreaming(true)
          setStreamText('')
          streamTextRef.current = ''
          setWriteStatus(`正在写第 ${plan.chapter} ${unitLabel(project, 1)}…`)
          wsRef.current?.sendWrite(
            plan.chapter,
            `第${plan.chapter}章`,
            String(plan.execution_prompt || ''),
          )
          if (msg.summary?.trim()) {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: msg.summary, at: new Date().toISOString() },
            ])
          }
          return
        }
        if (plan?.id && runPlanExecutionRef.current) {
          runPlanExecutionRef.current(
            { ...plan, user_message: msg.user_message || plan.user_message },
            { showCard: true },
          )
        } else if (msg.summary?.trim()) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: msg.summary, at: new Date().toISOString() },
          ])
        }
      },
      onStoryTasksToday: () => {
        finishStreamingRef.current(true)
        showToastRef.current('今日创作任务已同步，可在「今日创作」查看', 'info')
      },
      onPlannerResult: () => {
        finishStreamingRef.current(true)
        showToastRef.current('创作路线已更新，可在「今日创作」查看', 'success')
      },
    })
    wsRef.current = ws
    return () => {
      if (streamFlushRef.current) cancelAnimationFrame(streamFlushRef.current)
      ws.close()
    }
  }, [projectId, project, scheduleStreamFlush, mergeContextSummary, setConnectionStatus, setStreaming, setSessionMemory, setWriteStatus, setStreamText])

  useEffect(() => {
    callbacksRef.current._activeSessionId = activeSessionId
  }, [activeSessionId])

  const sendToAgent = useCallback((msg, { regenerate = false, skipUserBubble = false, planCard = null, planId = null } = {}) => {
    const text = String(msg || '').trim()
    const isReplying = pendingReply || streaming
    if (!text || isReplying) return false
    if (connectionStatus !== 'connected') {
      pendingSendRef.current = { text, regenerate, skipUserBubble, planCard, planId }
      setActivityHint('等待 AI 连接，就绪后自动发送…')
      return false
    }

    setInput('')
    setPendingReply(true)
    setActivityHint(planCard ? '总编辑执行改稿任务…' : '')
    setStreaming(true)
    setStreamText('')
    streamTextRef.current = ''
    stickToBottomRef.current = true

    if (regenerate) {
      setMessages((prev) => {
        if (prev.length && prev[prev.length - 1].role === 'assistant') {
          return prev.slice(0, -1)
        }
        return prev
      })
    } else if (!skipUserBubble) {
      const batch = []
      if (planCard) {
        batch.push({
          role: 'assistant',
          plan_execution: planCard,
          content: '',
          at: new Date().toISOString(),
        })
      }
      batch.push({ role: 'user', content: text, at: new Date().toISOString() })
      setMessages((prev) => [...prev, ...batch])
    }

    scrollToBottom(true)
    const sent = wsRef.current?.sendChat(text, activeSessionId, {
      regenerate,
      planId: planId || undefined,
      contextOptions: loadContextPrefs(projectId),
    })
    if (!sent) {
      setPendingReply(false)
      setStreaming(false)
      pendingSendRef.current = { text, regenerate, skipUserBubble, planCard, planId }
      setActivityHint('等待 AI 连接，就绪后自动发送…')
      showToast('连接未就绪，连接后将自动发送', 'info')
      return false
    }
    return true
  }, [connectionStatus, pendingReply, streaming, activeSessionId, showToast, setStreamText])

  useEffect(() => {
    const pending = pendingSendRef.current
    if (!pending || connectionStatus !== 'connected' || pendingReply || streaming) return
    pendingSendRef.current = null
    sendToAgent(pending.text, {
      regenerate: pending.regenerate,
      skipUserBubble: pending.skipUserBubble,
      planCard: pending.planCard,
      planId: pending.planId,
    })
  }, [connectionStatus, pendingReply, streaming, sendToAgent, activeSessionId])

  const onSend = async (text, options = {}) => {
    sendToAgent(text ?? input, options)
  }

  const isReplying = pendingReply || streaming

  const runPlanExecution = useCallback((plan, { showCard = true } = {}) => {
    if (!plan?.id) return false
    planExecCardRef.current = plan
    const userMsg = plan.user_message
      || `请执行上述改稿计划：${plan.user_request || plan.summary || ''}`
    setActivePlanExec({
      id: plan.id,
      summary: plan.summary,
      user_request: plan.user_request,
      execution_prompt: plan.execution_prompt,
      steps: plan.steps,
      type: plan.type,
      status: 'executing',
    })
    if (showCard) {
      setMessages((prev) => {
        const hasCard = prev.some((m) => m.plan_execution?.id === plan.id)
        const batch = hasCard ? [] : [{
          role: 'assistant',
          plan_execution: plan,
          content: '',
          at: new Date().toISOString(),
        }]
        const hasUser = prev.some(
          (m) => m.role === 'user' && m.content?.includes(String(plan.id)),
        )
        if (hasUser) return [...prev, ...batch]
        return [
          ...prev,
          ...batch,
          { role: 'user', content: userMsg, at: new Date().toISOString() },
        ]
      })
    } else {
      setMessages((prev) => {
        if (prev.some((m) => m.role === 'user' && m.content?.includes(String(plan.id)))) {
          return prev
        }
        return [...prev, { role: 'user', content: userMsg, at: new Date().toISOString() }]
      })
    }
    return sendToAgent(userMsg, { planCard: null, skipUserBubble: true, planId: plan.id })
  }, [sendToAgent])

  runPlanExecutionRef.current = runPlanExecution

  useEffect(() => {
    if (!pendingPlanExecution?.id) return
    planExecCardRef.current = pendingPlanExecution
    const userMsg = pendingPlanExecution.user_message
      || `请执行上述改稿计划：${pendingPlanExecution.user_request || pendingPlanExecution.summary || ''}`
    setActivePlanExec({
      id: pendingPlanExecution.id,
      summary: pendingPlanExecution.summary,
      user_request: pendingPlanExecution.user_request,
      execution_prompt: pendingPlanExecution.execution_prompt,
      steps: pendingPlanExecution.steps,
      type: pendingPlanExecution.type,
      status: 'executing',
    })
    setMessages((prev) => {
      const batch = []
      if (!prev.some((m) => m.plan_execution?.id === pendingPlanExecution.id)) {
        batch.push({
          role: 'assistant',
          plan_execution: pendingPlanExecution,
          content: '',
          at: new Date().toISOString(),
        })
      }
      if (!prev.some((m) => m.role === 'user' && m.content?.includes(String(pendingPlanExecution.id)))) {
        batch.push({ role: 'user', content: userMsg, at: new Date().toISOString() })
      }
      return batch.length ? [...prev, ...batch] : prev
    })
    setActivityHint('准备执行改稿任务…')
  }, [pendingPlanExecution])

  useEffect(() => {
    if (!pendingPlanExecution?.id) return
    if (!planExecReady || !activeSessionId) return
    if (loading || connectionStatus !== 'connected' || pendingReply || streaming) return
    if (planExecStartedRef.current === pendingPlanExecution.id) return

    planExecStartedRef.current = pendingPlanExecution.id
    const sent = runPlanExecution(pendingPlanExecution, { showCard: false })
    if (sent) {
      onPendingPlanExecutionConsumed?.()
    } else {
      planExecStartedRef.current = null
    }
  }, [
    pendingPlanExecution,
    planExecReady,
    activeSessionId,
    loading,
    connectionStatus,
    pendingReply,
    streaming,
    runPlanExecution,
    onPendingPlanExecutionConsumed,
  ])

  useImperativeHandle(ref, () => ({
    triggerWrite(plan) {
      if (!wsRef.current || isReplying) return
      const chapter = plan.chapter ?? currentChapter ?? 1
      setPendingReply(true)
      setWriteStatus(`正在写第 ${chapter} ${unitLabel(project, 1)}：${plan.title || '未命名'}…`)
      setStreaming(true)
      setStreamText('')
      streamTextRef.current = ''
      wsRef.current.sendWrite(chapter, plan.title || '', plan.outline || '')
    },
    sendMessage(text) {
      onSend(text)
    },
    executePlan(plan) {
      runPlanExecution(plan)
    },
    discussSelection(snippet, label) {
      const quote = snippet.length > 800 ? `${snippet.slice(0, 800)}…` : snippet
      const msg = `【摘自：${label || '当前文稿'}】\n> ${quote.split('\n').join('\n> ')}\n\n请针对以上内容讨论，先分析再建议，不要直接重写全文。`
      setInput(msg)
      setPromptsOpen(false)
      focusComposer()
    },
    focusComposer,
  }), [isReplying, currentChapter, project, onSend, runPlanExecution])

  const onCompletePlanExec = async () => {
    if (!activePlanExec?.id || planCompleting) return
    setPlanCompleting(true)
    try {
      const result = await completeStoryPlan(projectId, activePlanExec.id)
      setActivePlanExec(null)
      planExecCardRef.current = null
      planExecStartedRef.current = null
      const v = result?.verify
      const actionHint = result?.created_action_id
        ? '，已写入「今日创作 · 诊断建议」'
        : ''
      if (v?.status === 'pass') {
        showToast((v.message || '改稿计划已完成并通过验收') + actionHint, 'success')
      } else if (v?.status === 'partial') {
        showToast((v.message || '改稿已完成，部分指标建议人工复核') + actionHint, 'info')
      } else if (v?.status === 'fail') {
        showToast((v.message || '改稿已标记完成，但验收未通过') + actionHint, 'error')
      } else {
        showToast('改稿计划已标记完成，作品理解已更新', 'success')
      }
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setPlanCompleting(false)
    }
  }

  const onClearConfirm = async () => {
    if (!activeSessionId) return
    setClearing(true)
    try {
      await clearSessionMessages(projectId, activeSessionId)
      setMessages([])
      onRefreshSessions?.()
      setClearConfirmOpen(false)
    } catch (err) {
      onError?.(err.message)
    } finally {
      setClearing(false)
    }
  }

  const latestPlan = [...messages].reverse().find((m) => m.write_plan)?.write_plan
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const scopeTag = activeManuscript
    ? `本章 · ${activeManuscript.title || activeManuscript.filename}`
    : activeSession
      ? sessionScopeLabel(activeSession, chapters)
      : ''

  return (
    <div className="chat-panel">
      <ConfirmModal
        open={clearConfirmOpen}
        onClose={() => !clearing && setClearConfirmOpen(false)}
        onConfirm={onClearConfirm}
        title="清空对话"
        message="将清空当前会话的全部对话记录，此操作不可恢复。"
        confirmLabel="清空"
        danger
        loading={clearing}
      />

      <SessionSelector
        sessions={sessions}
        chapters={chapters}
        activeId={activeSessionId}
        onSelect={onSessionChange}
        onCreate={onCreateSession}
        onDelete={onDeleteSession}
      />

      {scopeTag && (
        <p className="chat-scope-hint" title="切换左侧章节会自动切换到该章对话；下拉可切到「全书」会话">
          {activeManuscript && isChapterSession(activeSession)
            ? `正在完善：${scopeTag}`
            : `当前会话：${scopeTag}`}
        </p>
      )}

      {cliCompat && cliCompat.cli_ready === false && (
        <div className="chat-cli-compat-banner">
          <CliCompatNotice compat={cliCompat} compact />
          <p className="hint">
            请前往 <strong>AI 中心 → 模型</strong> 按 CC Switch 预设修正配置，或点击「从 CC Switch 导入」。
          </p>
        </div>
      )}

      <div className={`chat-connection-bar ${isReplying ? 'is-busy' : ''}`} data-status={connectionStatus}>
        <span className={`chat-connection-dot ${isReplying ? 'busy' : connectionStatus}`} aria-hidden="true" />
        <span className="chat-connection-label">
          {connectionLabel(connectionStatus, contextSummary, u, emptyManuscripts, isReplying, streamText, inference)}
        </span>
        {activityHint && isReplying && (
          <span className="chat-activity-hint">{activityHint}</span>
        )}
        {connectionStatus !== 'connected' && (
          claudeAvailable === false ? (
            <span className="chat-connection-link muted" title="需在本机安装 claude CLI">
              需安装 Claude Code CLI
            </span>
          ) : inference?.credentials === 'studio_settings' && apiModel?.available === false ? (
            <span className="chat-connection-link muted" title="请在设置页测试模型连接">
              模型凭据不可用
            </span>
          ) : (
            <button
              type="button"
              className="chat-connection-link"
              onClick={handleReconnect}
            >
              重连
            </button>
          )
        )}
        <button
          type="button"
          className="chat-connection-detail-btn"
          onClick={() => setContextOpen(!contextOpen)}
          aria-expanded={contextOpen}
        >
          {contextOpen ? '收起' : '详情'}
        </button>
      </div>

      {contextOpen && (
        <div className="chat-context-detail">
          {connectionStatus !== 'connected' && (
            <p className="chat-context-warn">
              {claudeAvailable === false ? (
                <>对话依赖本机 <code>claude</code> CLI，请安装 Claude Code 后重启服务。</>
              ) : inference?.credentials === 'studio_settings' && apiModel?.available === false ? (
                <>Claude Code 已就绪，但设置页模型连接测试失败：{apiModel?.error || '请检查 Base URL 与 API Key'}。</>
              ) : (
                <>WebSocket 未连接，可点击「重连」。</>
              )}
            </p>
          )}
          {connectionStatus === 'connected' && inference?.credentials === 'studio_settings' && (
            <p className="hint">
              当前推理：Claude Code，模型凭据来自设置页
              <strong> {inference?.name || inference?.model}</strong>
              （{inference?.protocol === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容'}）。
            </p>
          )}
          {contextSummary?.default_skill && (
            <span>默认 Skill：{contextSummary.default_skill}</span>
          )}
          {contextSummary?.latest_chapter_title && (
            <span>最新文稿：{contextSummary.latest_chapter_title}</span>
          )}
          {sessionMemory?.has_memory && (
            <details className="chat-memory-detail">
              <summary>会话记忆（{sessionMemory.message_count ?? messages.length} 条对话）</summary>
              <p className="chat-memory-text">{sessionMemory.memory_summary}</p>
            </details>
          )}
          <span className="muted">助手可读：正文、大纲、设定集等项目文件</span>
        </div>
      )}

      {!(emptyManuscripts && messages.length === 0 && !loading) && (
      <div className="chat-quick-prompts-wrap">
        <button
          type="button"
          className="chat-quick-prompts-toggle"
          onClick={() => setPromptsOpen(!promptsOpen)}
        >
          快捷建议 {promptsOpen ? '▲' : '▼'}
        </button>
        {promptsOpen && (
          <div className="chat-quick-prompts">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="chat-quick-btn"
                disabled={isReplying || connectionStatus !== 'connected'}
                onClick={() => onSend(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {writeStatus && (
        <div className="write-status-bar">{writeStatus}</div>
      )}

      <div className="chat-messages-wrap">
      <div className="chat-messages" ref={scrollRef} onScroll={onMessagesScroll}>
        {loading && messages.length === 0 && !isReplying && !activePlanExec ? (
          <p className="chat-empty">加载对话…</p>
        ) : messages.length === 0 && !isReplying && !activePlanExec ? (
          <div className="chat-empty chat-empty-welcome">
            <p className="chat-empty-lead">
              {emptyManuscripts
                ? '还没有文稿？先和助手定方向'
                : '和创作助手聊聊写法、结构与下一稿方向'}
            </p>
            <p className="muted chat-empty-sub">
              {emptyManuscripts
                ? '聊清题材、人物与开篇后，可说「续写第一章」或去中间区导入 docx。'
                : '助手会读取文稿、大纲、设定与知识库；复杂改动会走总编辑流程。'}
            </p>
            {emptyManuscripts && quickPrompts.length > 0 && (
              <div className="chat-empty-starters">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="chat-quick-btn chat-empty-starter-btn"
                    disabled={isReplying || connectionStatus !== 'connected'}
                    onClick={() => onSend(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <ChatBubble
                key={`${m.at || i}-${m.role}`}
                message={m}
                index={i}
                stripContent={stripWritePlan}
                onRetry={m.role === 'user' ? handleRetry : undefined}
                onRegenerate={m.role === 'assistant' ? handleRegenerate : undefined}
                onApplyWritePlan={onApplyWritePlan}
                onCopy={(ok) => {
                  if (ok === false) showToast('复制失败', 'error')
                }}
              />
            ))}
            {isReplying && (
              <div className="chat-bubble chat-bubble-assistant chat-bubble-streaming">
                <span className="chat-avatar" aria-hidden="true">匠</span>
                <div className="chat-bubble-inner">
                  {streamText ? (
                    <ChatMessageBody role="assistant" content={streamText} />
                  ) : (
                    <div className="chat-bubble-body chat-bubble-body-typing">
                      <span className="chat-typing-indicator" aria-label="思考中">
                        <span /><span /><span />
                      </span>
                      <span className="chat-typing-label">{activityHint || '思考中…'}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {showScrollBtn && !isReplying && (
        <button
          type="button"
          className="chat-scroll-bottom"
          onClick={() => scrollToBottom(true)}
        >
          ↓ 新消息
        </button>
      )}
      </div>

      {activePlanExec && (
        <div className={`chat-plan-exec-bar ${isReplying ? 'is-running' : ''}`}>
          <div className="chat-plan-exec-bar-head">
            <strong>改稿任务执行中</strong>
            <span className="muted">{activePlanExec.summary}</span>
          </div>
          {isReplying && (
            <p className="chat-plan-exec-progress" role="status">
              {activityHint || writeStatus || 'AI 正在处理…'}
            </p>
          )}
          {!isReplying && activePlanExec.status === 'await_complete' && (
            <div className="chat-plan-exec-bar-actions">
              <span className="hint">助手已回复，请在工作台核对改稿结果</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={planCompleting}
                onClick={onCompletePlanExec}
              >
                {planCompleting ? '提交中…' : '标记计划完成'}
              </button>
            </div>
          )}
        </div>
      )}

      {latestPlan && !isReplying && !activePlanExec && (
        <div className="chat-plan-bar">
          <span>
            已有写作方案：第 {latestPlan.chapter ?? '—'} 章 {latestPlan.title}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onApplyWritePlan?.(latestPlan)}
          >
            采用并生成文稿
          </button>
        </div>
      )}

      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
      >
        <div className="chat-composer-box">
          <textarea
            ref={composerRef}
            rows={2}
            value={input}
            aria-label="输入消息"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder={connectionStatus === 'connected'
              ? '说说你的想法…（Enter 发送，Shift+Enter 换行）'
              : '等待 Claude Code 连接…'}
            disabled={isReplying || connectionStatus !== 'connected'}
          />
          <div className="chat-composer-actions">
            <button
              type="button"
              className="chat-composer-clear"
              onClick={() => setClearConfirmOpen(true)}
              disabled={isReplying || !activeSessionId}
            >
              清空
            </button>
            {isReplying ? (
              <button
                type="button"
                className="chat-composer-send chat-composer-stop"
                onClick={onStop}
              >
                停止
              </button>
            ) : (
              <button
                type="submit"
                className="chat-composer-send"
                disabled={!input.trim() || connectionStatus !== 'connected'}
              >
                发送
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
})

export default ChatPanel
