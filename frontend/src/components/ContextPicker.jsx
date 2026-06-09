import { useEffect, useState } from 'react'
import {
  CONTEXT_PREF_LABELS,
  DEFAULT_CONTEXT_PREFS,
  loadContextPrefs,
  saveContextPrefs,
} from '../lib/contextPrefs.js'

export default function ContextPicker({ projectId, compact = false }) {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState({ ...DEFAULT_CONTEXT_PREFS })

  useEffect(() => {
    if (projectId) setPrefs(loadContextPrefs(projectId))
  }, [projectId])

  const toggle = (key) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    saveContextPrefs(projectId, next)
  }

  const enabledCount = Object.values(prefs).filter(Boolean).length

  return (
    <div className={`context-picker ${compact ? 'context-picker-compact' : ''}`}>
      <button
        type="button"
        className="btn btn-ghost btn-sm context-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        title="选择 AI 参考的内容范围"
      >
        上下文 {enabledCount}/{Object.keys(CONTEXT_PREF_LABELS).length}
      </button>
      {open && (
        <div className="context-picker-menu" role="dialog" aria-label="AI 上下文">
          <p className="muted context-picker-hint">勾选参与 AI 请求的项目资料</p>
          {Object.entries(CONTEXT_PREF_LABELS).map(([key, label]) => (
            <label key={key} className="context-picker-row">
              <input
                type="checkbox"
                checked={!!prefs[key]}
                onChange={() => toggle(key)}
              />
              {label}
            </label>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
            完成
          </button>
        </div>
      )}
    </div>
  )
}

export function getContextOptionsForProject(projectId) {
  return loadContextPrefs(projectId)
}
