const STORAGE_KEY = 'wenjiang-theme'

export function getStoredTheme() {
  if (typeof localStorage === 'undefined') return 'light'
  return localStorage.getItem(STORAGE_KEY) || 'light'
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light')
}

export function storeTheme(theme) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme)
  }
}

// 首屏防闪烁：在 main.jsx 之前于 index.html 也可内联，此处供 main 调用
applyTheme(getStoredTheme())
