import UserMenu from './UserMenu.jsx'

export default function AppTopBar({ compact = false }) {
  return (
    <header className={`app-topbar ${compact ? 'app-topbar-float' : ''}`}>
      <div className="app-topbar-inner">
        <UserMenu compact={compact} />
      </div>
    </header>
  )
}
