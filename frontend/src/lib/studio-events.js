/** 全局事件：AI 中心模型/MCP 等配置变更后通知各页刷新 /health */
export const STUDIO_HEALTH_CHANGED = 'literary-studio:health-changed'

export function notifyStudioHealthChanged(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STUDIO_HEALTH_CHANGED, { detail }))
}

export function onStudioHealthChanged(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(STUDIO_HEALTH_CHANGED, handler)
  return () => window.removeEventListener(STUDIO_HEALTH_CHANGED, handler)
}
