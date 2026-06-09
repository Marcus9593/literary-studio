import { useCallback, useEffect, useRef, useState } from 'react'
import { createWebSocket } from '../services/ws.ts'

const ACTION_LABELS = {
  rewrite: '改写',
  expand: '扩写',
  polish: '润色',
}

export function useInlineEdit(projectId, { onResult, onError, onStatus } = {}) {
  const wsRef = useRef(null)
  const [busy, setBusy] = useState('')
  const callbacksRef = useRef({ onResult, onError, onStatus })
  callbacksRef.current = { onResult, onError, onStatus }

  useEffect(() => {
    if (!projectId) return undefined
    const ws = createWebSocket(projectId, {
      onStatus: (status, meta) => {
        if (status === 'thinking' || status === 'streaming') {
          setBusy(ACTION_LABELS[meta?.action] || 'AI')
        }
        if (status === 'done' || status === 'error' || status === 'cancelled') {
          setBusy('')
        }
        callbacksRef.current.onStatus?.(status, meta)
      },
      onInlineEditResult: (msg) => {
        setBusy('')
        callbacksRef.current.onResult?.(msg)
      },
      onError: (err) => {
        setBusy('')
        callbacksRef.current.onError?.(err instanceof Error ? err : new Error(String(err)))
      },
    })
    wsRef.current = ws
    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [projectId])

  const runInlineEdit = useCallback((payload) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      onError?.(new Error('WebSocket 未连接，请稍后重试'))
      return false
    }
    setBusy(ACTION_LABELS[payload.action] || 'AI')
    ws.sendInlineEdit(payload)
    return true
  }, [onError])

  const cancel = useCallback(() => {
    wsRef.current?.cancel()
    setBusy('')
  }, [])

  return { runInlineEdit, cancel, busy }
}

export { ACTION_LABELS }
