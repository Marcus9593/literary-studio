import { Link, NavLink, useParams } from 'react-router-dom'
import { STORY_NAV_ITEMS } from '../lib/storyNavItems.js'

const TABS = [
  { path: 'suggestions', label: '今日创作' },
  ...STORY_NAV_ITEMS.filter((i) => i.to !== 'suggestions').map((i) => ({
    path: i.to,
    label: i.label,
  })),
]

export default function StorySubnav({ projectTitle }) {
  const { projectId } = useParams()
  const base = `/projects/${projectId}`

  return (
    <div className="story-subnav-bar">
      <Link to={base} className="story-back-link">
        ← 返回工作台
        {projectTitle ? <span className="story-back-title">{projectTitle}</span> : null}
      </Link>
      <div className="story-subnav-tabs" role="tablist">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={`${base}/${tab.path}`}
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
  )
}
