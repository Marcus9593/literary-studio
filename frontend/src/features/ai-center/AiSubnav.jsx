import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/ai', label: '总览', end: true },
  { to: '/ai/models', label: '模型与连接', end: true },
  { to: '/ai/skills', label: '本机技能', end: true },
  { to: '/ai/skills/discover', label: '发现安装', end: true },
  { to: '/ai/mcp', label: 'MCP 扩展', end: true },
]

export default function AiSubnav() {
  return (
    <div className="ai-subnav-bar">
      <div className="story-subnav-tabs" role="tablist" aria-label="AI 中心">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
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
