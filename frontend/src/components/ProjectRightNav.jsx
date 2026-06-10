import { useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  STORY_NAV_GROUPS,
  storyNavBadge,
  storyNavGroupForSegment,
  storyNavSegment,
} from '../lib/storyNavItems.js'
import { useWorkspaceStoryStats } from '../lib/useWorkspaceStoryStats.js'
import { useToast } from './Toast.jsx'

export default function ProjectRightNav() {
  const location = useLocation()
  const showToast = useToast()
  const match = location.pathname.match(/^\/projects\/([^/]+)/)
  const projectId = match?.[1]
  const onStatsError = useCallback((msg) => showToast(msg, 'error'), [showToast])
  const storyStats = useWorkspaceStoryStats(projectId, { onError: onStatsError })

  if (!projectId) return null

  const base = `/projects/${projectId}`
  const onWorkspace = location.pathname === base || location.pathname === `${base}/`
  const segment = storyNavSegment(location.pathname, projectId)
  const activeGroup = storyNavGroupForSegment(segment)

  return (
    <aside className="project-right-nav" aria-label="故事工程">
      <NavLink
        to={base}
        end
        className={`project-right-nav-btn ${onWorkspace ? 'active' : ''}`}
        title="写作工作台"
      >
        <span className="project-right-nav-icon project-right-nav-brand">文</span>
        <span className="project-right-nav-label">写作</span>
      </NavLink>

      <div className="project-right-nav-divider" />

      <nav className="project-right-nav-items">
        {STORY_NAV_GROUPS.map((group) => (
          <div
            key={group.id}
            className={`project-right-nav-group ${group.id === activeGroup.id ? 'is-active-group' : ''}`}
          >
            <div className="project-right-nav-group-label" title={group.hint}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const badge = storyNavBadge(item, storyStats)
              return (
                <NavLink
                  key={item.to}
                  to={`${base}/${item.to}`}
                  className={({ isActive }) =>
                    `project-right-nav-btn ${isActive ? 'active' : ''}`.trim()
                  }
                  title={item.label}
                >
                  <span className="project-right-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="project-right-nav-label">{item.shortLabel || item.label}</span>
                  {badge != null && (
                    <span className="project-right-nav-badge">{badge}</span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
