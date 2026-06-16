import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { ThemeProvider } from './components/ThemeProvider.jsx'
import './lib/theme.js'
import './index.css'
import './styles/ui-polish.css'
import './features/screenplay/screenplay.css'

// 检测是否在 Electron 环境中运行
if (typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron')) {
  document.body.setAttribute('data-electron', 'true')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
