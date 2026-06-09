export type WsStatus = 'connected' | 'thinking' | 'streaming' | 'done' | 'error' | 'cancelled'

export type WsHandlers = {
  onOpen?: () => void
  onClose?: () => void
  onStatus?: (status: WsStatus | string, meta?: Record<string, unknown>) => void
  onContent?: (text: string) => void
  onContext?: (ctx: Record<string, unknown>) => void
  onWriteResult?: (result: Record<string, unknown>) => void
  onSession?: (meta: Record<string, unknown>) => void
  onError?: (err: Error | Event) => void
  onStoryPlan?: (plan: Record<string, unknown>) => void
  onTaskExecute?: (msg: Record<string, unknown>) => void
  onStoryTasksToday?: (msg: Record<string, unknown>) => void
  onPlannerResult?: (msg: Record<string, unknown>) => void
  onInlineEditResult?: (msg: Record<string, unknown>) => void
}

export type WebSocketClient = {
  sendChat: (message: string, sessionId?: string, options?: { regenerate?: boolean; planId?: string; contextOptions?: Record<string, boolean> }) => void
  sendWrite: (chapter: number, title: string, outline: string) => void
  sendInlineEdit: (payload: Record<string, unknown>) => void
  cancel: () => void
  reconnect: () => void
  close: () => void
  readyState: number
}

function wsToken(): string {
  try {
    return localStorage.getItem('studio_auth_token') || ''
  } catch {
    return ''
  }
}

export function createWebSocket(projectId: string, handlers: WsHandlers = {}): WebSocketClient {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let closedIntentionally = false
  let sessionReady = false
  const maxAttempts = 10

  const dispatch = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(String(event.data))
      if (msg.type === 'status' && msg.status === 'connected') {
        if (!sessionReady) {
          sessionReady = true
          reconnectAttempts = 0
          handlers.onOpen?.()
        }
      }
      switch (msg.type) {
        case 'status':
          handlers.onStatus?.(msg.status, msg)
          break
        case 'content':
          handlers.onContent?.(msg.text)
          break
        case 'context_summary':
          handlers.onContext?.(msg)
          break
        case 'write_result':
          handlers.onWriteResult?.(msg)
          break
        case 'session':
          handlers.onSession?.(msg)
          break
        case 'error':
          handlers.onError?.(new Error(msg.error))
          break
        case 'story_plan':
          handlers.onStoryPlan?.(msg)
          break
        case 'task_execute':
          handlers.onTaskExecute?.(msg)
          break
        case 'story_tasks_today':
          handlers.onStoryTasksToday?.(msg)
          break
        case 'planner_result':
          handlers.onPlannerResult?.(msg)
          break
        case 'inline_edit_result':
          handlers.onInlineEditResult?.(msg)
          break
        default:
          break
      }
    } catch {
      /* ignore malformed frames */
    }
  }

  const scheduleReconnect = () => {
    if (closedIntentionally || reconnectAttempts >= maxAttempts) return
    if (!wsToken()) return
    const delay = Math.min(800 * 2 ** reconnectAttempts, 15000)
    reconnectAttempts += 1
    reconnectTimer = setTimeout(connect, delay)
  }

  const connect = () => {
    if (closedIntentionally) return
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    const token = wsToken()
    if (!token) {
      handlers.onError?.(new Error('未登录'))
      return
    }

    sessionReady = false
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: 'auth', token }))
    }
    ws.onclose = () => {
      sessionReady = false
      handlers.onClose?.()
      scheduleReconnect()
    }
    ws.onerror = (e) => handlers.onError?.(e)
    ws.onmessage = dispatch
  }

  connect()

  return {
    sendChat(message, sessionId, options = {}) {
      if (ws?.readyState === WebSocket.OPEN && sessionReady) {
        const payload: Record<string, unknown> = { type: 'chat', projectId, message }
        if (sessionId) payload.sessionId = sessionId
        if (options.regenerate) payload.regenerate = true
        if (options.planId) payload.planId = options.planId
        if (options.contextOptions) payload.contextOptions = options.contextOptions
        ws.send(JSON.stringify(payload))
        return true
      }
      return false
    },
    sendWrite(chapter, title, outline) {
      if (ws?.readyState === WebSocket.OPEN && sessionReady) {
        ws.send(JSON.stringify({ type: 'write', projectId, chapter, title, outline }))
      }
    },
    sendInlineEdit(payload) {
      if (ws?.readyState === WebSocket.OPEN && sessionReady) {
        ws.send(JSON.stringify({ type: 'inline_edit', projectId, ...payload }))
      }
    },
    cancel() {
      if (ws?.readyState === WebSocket.OPEN && sessionReady) {
        ws.send(JSON.stringify({ type: 'cancel' }))
      }
    },
    reconnect() {
      closedIntentionally = false
      reconnectAttempts = 0
      try { ws?.close() } catch { /* noop */ }
      connect()
    },
    close() {
      closedIntentionally = true
      sessionReady = false
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      ws?.close()
    },
    get readyState() {
      return ws?.readyState ?? WebSocket.CLOSED
    },
  }
}
