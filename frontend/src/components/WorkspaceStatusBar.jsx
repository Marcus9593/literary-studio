import { creationModeOf, unitLabel, workTypeOf } from '../lib/projectProfile.js'

export default function WorkspaceStatusBar({ project, chapters }) {
  if (!project) return null
  const wt = workTypeOf(project)
  const cm = creationModeOf(project)
  const u = unitLabel(project, chapters.length || 1)
  const count = chapters.length
  const words = project.stats?.total_words ?? chapters.reduce((s, c) => s + (c.words || 0), 0)

  return (
    <div className="workspace-status-bar workspace-status-bar-readonly">
      <div className="workspace-status-meta">
        <span className="workspace-status-tag">{wt.label}</span>
        <span className="workspace-status-tag workspace-status-tag-mode">{cm.label}</span>
        <span className="workspace-status-sep" aria-hidden="true">·</span>
        <span>{count} {u}</span>
        {words > 0 && (
          <>
            <span className="workspace-status-sep" aria-hidden="true">·</span>
            <span>{words.toLocaleString()} 字</span>
          </>
        )}
        {project.rewrite_note && (
          <>
            <span className="workspace-status-sep" aria-hidden="true">·</span>
            <span className="workspace-status-note" title={project.rewrite_note}>
              {project.rewrite_note.length > 24 ? `${project.rewrite_note.slice(0, 24)}…` : project.rewrite_note}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
