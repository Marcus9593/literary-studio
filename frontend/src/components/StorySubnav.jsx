import { Link, NavLink, useLocation, useParams } from 'react-router-dom'
import {
  STORY_NAV_GROUPS,
  storyNavGroupForSegment,
  storyNavSegment,
} from '../lib/storyNavItems.js'

export default function StorySubnav({ projectTitle }) {
  const { projectId } = useParams()
  const location = useLocation()
  const base = `/projects/${projectId}`
  const segment = storyNavSegment(location.pathname, projectId)
  const activeGroup = storyNavGroupForSegment(segment)

  return (
    <header className="story-subnav-bar">
      <div className="story-subnav-top">
        <Link to={base} className="story-back-link">
          ← 返回工作台
          {projectTitle ? <span className="story-back-title">{projectTitle}</span> : null}
        </Link>
      </div>

      <div className="story-subnav-toolbar">
        <div className="story-subnav-scenarios" role="tablist" aria-label="Story OS 场景">
          {STORY_NAV_GROUPS.map((group) => {
            const isActive = group.id === activeGroup.id
            const firstTo = group.items[0]?.to
            return (
              <NavLink
                key={group.id}
                to={`${base}/${firstTo}`}
                className={`story-subnav-scenario ${isActive ? 'active' : ''}`.trim()}
                title={group.hint}
                role="tab"
                aria-selected={isActive}
              >
                {group.label}
              </NavLink>
            )
          })}
        </div>

        <div className="story-subnav-tabs" role="tablist" aria-label={activeGroup.label}>
          {activeGroup.items.map((tab) => (
            <NavLink
              key={tab.to}
              to={`${base}/${tab.to}`}
              className={({ isActive }) =>
                `story-subnav-tab ${isActive ? 'active' : ''}`.trim()
              }
              role="tab"
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  )
}
