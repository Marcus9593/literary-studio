import { create } from 'zustand'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

type ChatState = {
  connectionStatus: ConnectionState
  streaming: boolean
  streamText: string
  contextSummary: Record<string, unknown> | null
  sessionMemory: Record<string, unknown> | null
  writeStatus: string
  setConnectionStatus: (s: ConnectionState) => void
  setStreaming: (v: boolean) => void
  appendStreamText: (text: string) => void
  resetStream: () => void
  setContextSummary: (ctx: Record<string, unknown> | null) => void
  mergeContextSummary: (ctx: Record<string, unknown>) => void
  setSessionMemory: (m: Record<string, unknown> | null) => void
  setWriteStatus: (s: string) => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  connectionStatus: 'disconnected',
  streaming: false,
  streamText: '',
  contextSummary: null,
  sessionMemory: null,
  writeStatus: '',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setStreaming: (streaming) => set({ streaming }),
  setStreamText: (streamText) => set({ streamText }),
  appendStreamText: (text) => set((s) => ({ streamText: s.streamText + text })),
  resetStream: () => set({ streamText: '', streaming: false }),
  setContextSummary: (contextSummary) => set({ contextSummary }),
  mergeContextSummary: (ctx) => set((s) => ({
    contextSummary: { ...(s.contextSummary || {}), ...ctx },
  })),
  setSessionMemory: (sessionMemory) => set({ sessionMemory }),
  setWriteStatus: (writeStatus) => set({ writeStatus }),
  reset: () => set({
    connectionStatus: 'disconnected',
    streaming: false,
    streamText: '',
    contextSummary: null,
    sessionMemory: null,
    writeStatus: '',
  }),
}))
