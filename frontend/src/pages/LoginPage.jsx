import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRAND } from '../lib/brand.js'

const HERO_GLYPHS = ['纲', '墨', '戏', '文', '笔', '卷']
const FEATURES = [
  { icon: '◫', title: '项目工作台', desc: '大纲、场次、成稿同一空间迭代' },
  { icon: '◈', title: '叙事引擎', desc: 'Claude 驱动的编剧级 AI 辅助' },
  { icon: '⧉', title: '版本快照', desc: '大改前存档，随时对比回滚' },
]

export default function LoginPage() {
  const { user, loading, login, register } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/'

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setSubmitting(true)
    try {
      await register({
        username: username.trim(),
        password,
        display_name: displayName.trim() || username.trim(),
      })
    } catch (err) {
      setError(err.message || '注册失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero" aria-hidden="true">
        <div className="login-hero-bg" />
        <div className="login-hero-grid" />
        <div className="login-hero-glow login-hero-glow-a" />
        <div className="login-hero-glow login-hero-glow-b" />
        <div className="login-hero-glyphs">
          {HERO_GLYPHS.map((g, i) => (
            <span key={g} className="login-glyph" style={{ '--i': i }}>{g}</span>
          ))}
        </div>
        <div className="login-hero-paper" />
        <div className="login-hero-content">
          <span className="login-hero-mark">{BRAND.mark}</span>
          <h2>{BRAND.title}</h2>
          <p className="login-hero-tagline">{BRAND.tagline}</p>
          <p className="login-hero-slogan">{BRAND.slogan}</p>
          <ul className="login-hero-features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="login-feature-icon">{f.icon}</span>
                <div>
                  <strong>{f.title}</strong>
                  <span>{f.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="login-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => switchMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => switchMode('register')}
            >
              注册账号
            </button>
          </div>

          {mode === 'login' ? (
            <form className="login-form" onSubmit={handleLogin}>
              <p className="login-form-lead">欢迎回来，继续你的创作</p>
              <label className="field">
                <span>用户名</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="输入用户名"
                  required
                />
              </label>
              <label className="field">
                <span>密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="输入密码"
                  required
                />
              </label>
              {error && <p className="login-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
                {submitting ? '登录中…' : '进入工作台'}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={handleRegister}>
              <p className="login-form-lead">创建账号，开启你的叙事项目</p>
              <label className="field">
                <span>用户名</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="至少 2 个字符"
                  minLength={2}
                  required
                />
              </label>
              <label className="field">
                <span>显示名</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  placeholder="可选，默认同用户名"
                />
              </label>
              <label className="field">
                <span>密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="至少 6 位"
                  minLength={6}
                  required
                />
              </label>
              <label className="field">
                <span>确认密码</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="再次输入密码"
                  minLength={6}
                  required
                />
              </label>
              {error && <p className="login-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
                {submitting ? '注册中…' : '注册并登录'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
