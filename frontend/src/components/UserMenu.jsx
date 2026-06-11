import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import UserManualModal from './UserManualModal.jsx'

const ROLE_LABEL = {
  super_admin: '超级管理员',
  user: '普通用户',
}

function userInitial(user) {
  const name = user?.display_name || user?.username || '?'
  return name.trim().charAt(0).toUpperCase()
}

export default function UserMenu({ compact = false }) {
  const { user, logout, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const roleLabel = ROLE_LABEL[user.role] || '普通用户'

  return (
    <div className={`user-menu ${compact ? 'user-menu-compact' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={user.username}
      >
        <span className="user-menu-avatar" aria-hidden="true">
          {userInitial(user)}
        </span>
        {!compact && (
          <span className="user-menu-meta">
            <span className="user-menu-name">{user.display_name || user.username}</span>
            <span className="user-menu-role">{roleLabel}</span>
          </span>
        )}
        <span className="user-menu-chevron" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-panel-head">
            <span className="user-menu-panel-avatar">{userInitial(user)}</span>
            <div>
              <strong>{user.display_name || user.username}</strong>
              <span className="user-menu-panel-username">@{user.username}</span>
            </div>
          </div>
          <div className="user-menu-panel-role">
            <span className={`user-role-badge user-role-${user.role || 'user'}`}>
              {roleLabel}
            </span>
          </div>
          {isAdmin && (
            <Link
              to="/users"
              className="user-menu-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              用户管理
            </Link>
          )}
          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setManualOpen(true)
            }}
          >
            📖 用户手册
          </button>
          <button
            type="button"
            className="user-menu-item user-menu-item-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              logout()
            }}
          >
            退出登录
          </button>
          <UserManualModal open={manualOpen} onClose={() => setManualOpen(false)} />
        </div>
      )}
    </div>
  )
}
