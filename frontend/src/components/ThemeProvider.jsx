import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, storeTheme } from '../lib/theme.js'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    storeTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/** 仅展示切换按钮，可在任意页面使用 */
export function ThemeToggle({ className = '', compact = false, inline = false }) {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? '浅色' : '深色'
  const base = inline ? 'theme-toggle-inline' : 'theme-toggle'
  return (
    <button
      type="button"
      className={`${base} ${className}`.trim()}
      onClick={toggleTheme}
      title={`切换为${label}模式`}
      aria-label={`切换为${label}模式`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {theme === 'dark' ? '☀' : '☾'}
      </span>
      {!compact && <span>{label}</span>}
    </button>
  )
}
