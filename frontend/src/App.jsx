import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import { AiCenterPage } from './features/ai-center/index.js'
import AiOverviewPanel from './features/ai-center/panels/AiOverviewPanel.jsx'
import AiModelsPanel from './features/ai-center/panels/AiModelsPanel.jsx'
import AiSkillsPanel from './features/ai-center/panels/AiSkillsPanel.jsx'
import AiDiscoverPanel from './features/ai-center/panels/AiDiscoverPanel.jsx'
import AiMcpPanel from './features/ai-center/panels/AiMcpPanel.jsx'
import ProjectPage from './pages/ProjectPage.jsx'
import { CockpitPage } from './features/cockpit/index.js'
import { VersionsPage } from './features/versions/index.js'
import { ReviewPage } from './features/review/index.js'
import { AssetsPage } from './features/assets/index.js'
import StorySuggestionsPage from './pages/StorySuggestionsPage.jsx'
import StoryKnowledgePage from './pages/StoryKnowledgePage.jsx'
import StoryPlansPage from './pages/StoryPlansPage.jsx'
import StoryHealthPage from './pages/StoryHealthPage.jsx'
import StoryRoadmapPage from './pages/StoryRoadmapPage.jsx'
import StorySuspensePage from './pages/StorySuspensePage.jsx'
import StoryCharactersPage from './pages/StoryCharactersPage.jsx'
import StoryBiblePage from './pages/StoryBiblePage.jsx'
import StoryBeatsPage from './pages/StoryBeatsPage.jsx'
import StoryEnginePage from './pages/StoryEnginePage.jsx'
import OnboardingGuide from './components/OnboardingGuide.jsx'
import GuestbookPage from './pages/GuestbookPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import UsersPage from './pages/UsersPage.jsx'
import { ThemeToggle } from './components/ThemeProvider.jsx'
import AppTopBar from './components/AppTopBar.jsx'
import { BRAND } from './lib/brand.js'
import { useAuth } from './auth/AuthContext.jsx'
import ProjectRightNav from './components/ProjectRightNav.jsx'

const NAV = [
  { to: '/', label: '创作看板', icon: '◉', end: true },
  { to: '/projects', label: '项目库', icon: '◫', end: true },
  { to: '/review', label: '审稿中心', icon: '◑', end: true },
  { to: '/assets', label: '素材中心', icon: '◧', end: true },
  { to: '/versions', label: '项目版本', icon: '⧉', end: true },
  { to: '/ai', label: 'AI 中心', icon: '◈', end: false },
  { to: '/guestbook', label: '留言板', icon: '💬', end: true },
]

function AppShell() {
  const location = useLocation()
  const { isAdmin } = useAuth()
  const isWorkspace = location.pathname.startsWith('/projects/')
  const isProjectScope = /^\/projects\/[^/]+/.test(location.pathname)

  const navItems = isAdmin
    ? [...NAV, { to: '/users', label: '用户管理', icon: '👤', end: true }]
    : NAV

  return (
    <div className={`shell ${isWorkspace ? 'shell-workspace' : ''} ${isProjectScope ? 'shell-project' : ''}`}>
      <aside className={`sidebar ${isWorkspace ? 'sidebar-compact' : ''}`}>
        <NavLink to="/" className="brand">
          <span className="brand-mark">{BRAND.mark}</span>
          {!isWorkspace && (
            <div className="brand-text">
              <h1>{BRAND.title}</h1>
              <p title={BRAND.taglineHint}>{BRAND.tagline}</p>
            </div>
          )}
        </NavLink>

        <nav className="nav" aria-label="主导航">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`.trim()
              }
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {!isWorkspace && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-tools">
          <ThemeToggle compact={isWorkspace} />
        </div>

        {!isWorkspace && (
          <footer className="sidebar-foot">
            <div className="sidebar-foot-row">
              <span className="status-dot status-dot-live" />
              <span>{BRAND.engine}</span>
            </div>
            <div className="sidebar-foot-row sidebar-foot-backend">
              <span className="status-dot status-dot-live" />
              <span>已接入后端</span>
            </div>
          </footer>
        )}
      </aside>

      <main className={`main ${isWorkspace ? 'main-workspace' : ''}`}>
        <AppTopBar compact={isWorkspace} />
        <div className="main-body">
        <Routes>
          <Route path="/" element={<CockpitPage />} />
          <Route path="/projects" element={<HomePage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/cockpit" element={<Navigate to="/" replace />} />
          <Route path="/versions" element={<VersionsPage />} />
          <Route path="/guestbook" element={<GuestbookPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/studio" element={<Navigate to="/" replace />} />
          <Route path="/studio/versions" element={<Navigate to="/versions" replace />} />
          <Route path="/studio/*" element={<Navigate to="/" replace />} />
          <Route path="/ai" element={<AiCenterPage />}>
            <Route index element={<AiOverviewPanel />} />
            <Route path="models" element={<AiModelsPanel />} />
            <Route path="skills" element={<AiSkillsPanel />} />
            <Route path="skills/discover" element={<AiDiscoverPanel />} />
            <Route path="mcp" element={<AiMcpPanel />} />
          </Route>
          <Route path="/settings" element={<Navigate to="/ai/models" replace />} />
          <Route path="/tools" element={<Navigate to="/ai/skills" replace />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/suggestions" element={<StorySuggestionsPage />} />
          <Route path="/projects/:projectId/beats" element={<StoryBeatsPage />} />
          <Route path="/projects/:projectId/characters" element={<StoryCharactersPage />} />
          <Route path="/projects/:projectId/bible" element={<StoryBiblePage />} />
          <Route path="/projects/:projectId/suspense" element={<StorySuspensePage />} />
          <Route path="/projects/:projectId/knowledge" element={<StoryKnowledgePage />} />
          <Route path="/projects/:projectId/plans" element={<StoryPlansPage />} />
          <Route path="/projects/:projectId/roadmap" element={<StoryRoadmapPage />} />
          <Route path="/projects/:projectId/health" element={<StoryHealthPage />} />
          <Route path="/projects/:projectId/engine" element={<StoryEnginePage />} />
        </Routes>
        </div>
      </main>
      {isProjectScope ? <ProjectRightNav /> : null}
      <OnboardingGuide />
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="login-page">
        <p className="muted">加载中…</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          user ? (
            <AppShell />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
      />
    </Routes>
  )
}
