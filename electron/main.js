const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const net = require('net')
const http = require('http')
const fs = require('fs')
const platformAdapter = require('./platform')
const packagedPaths = require('./packaged-paths')

const isDev = !app.isPackaged
const osPlatform = process.platform

// ── 路径配置 ──

const DATA_DIR = isDev
  ? path.resolve(__dirname, '..', 'data')
  : path.join(app.getPath('userData'), 'data')

const SKILLS_DIR = isDev
  ? path.resolve(__dirname, '..', 'skills')
  : packagedPaths.skillsDir(process.resourcesPath)

const VENDOR_DIR = isDev
  ? path.resolve(__dirname, 'vendor')
  : packagedPaths.vendorDir(process.resourcesPath)

process.env.LITERARY_STUDIO_DATA = DATA_DIR
process.env.LITERARY_WRITER_ROOT = path.join(SKILLS_DIR, 'literary-writer')
process.env.STUDIO_HOST = '127.0.0.1'

if (!isDev) {
  process.env.PYTHON_SCRIPTS_DIR = packagedPaths.backendScriptsDir(process.resourcesPath)
  process.env.LITERARY_STUDIO_BACKEND_DIR = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend-node')
} else if (!process.env.PYTHON_SCRIPTS_DIR) {
  process.env.PYTHON_SCRIPTS_DIR = path.resolve(__dirname, '..', 'backend')
}

const HEALTH_WAIT_MS = 60000

let backendPort = null
let backendStarted = false
let startupLogPath = null

function getStartupLogPath() {
  if (startupLogPath) return startupLogPath
  const logsDir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logsDir, { recursive: true })
  startupLogPath = path.join(logsDir, 'startup.log')
  return startupLogPath
}

function logStartup(message, level = 'info') {
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`
  try {
    fs.appendFileSync(getStartupLogPath(), line, 'utf8')
  } catch (err) {
    console.error('写入 startup.log 失败:', err.message)
  }
  if (level === 'error') console.error(message)
  else console.log(message)
}

function initStartupLog() {
  try {
    const logPath = getStartupLogPath()
    const header = [
      '',
      '='.repeat(60),
      `文匠 Studio 启动 ${new Date().toISOString()}`,
      `版本: ${app.getVersion?.() || 'unknown'} | packaged: ${app.isPackaged}`,
      `平台: ${process.platform} ${process.arch}`,
      `userData: ${app.getPath('userData')}`,
      `resourcesPath: ${process.resourcesPath || '(dev)'}`,
      '='.repeat(60),
    ].join('\n')
    fs.appendFileSync(logPath, `${header}\n`, 'utf8')
  } catch (err) {
    console.error('初始化 startup.log 失败:', err.message)
  }
}

function failStartup(title, err) {
  const message = err?.stack || err?.message || String(err)
  logStartup(`${title}: ${message}`, 'error')
  logStartup(`详细日志: ${getStartupLogPath()}`, 'error')
  platformAdapter.showStartupError(title, `${message}\n\n启动日志: ${getStartupLogPath()}`)
  app.quit()
}

// ── 配置打包的 Python / Claude ──

function setupBundledPython() {
  const pythonDir = path.join(VENDOR_DIR, 'python')
  if (!fs.existsSync(pythonDir)) return

  let pythonBin
  if (osPlatform === 'win32') {
    pythonBin = path.join(pythonDir, 'python.exe')
  } else {
    pythonBin = path.join(pythonDir, 'bin', 'python3')
    if (!fs.existsSync(pythonBin)) {
      pythonBin = path.join(pythonDir, 'bin', 'python')
    }
  }

  if (fs.existsSync(pythonBin)) {
    packagedPaths.assertNoAsarInSpawnPath('PYTHON', pythonBin)
    process.env.PYTHON = pythonBin
    logStartup(`使用打包的 Python: ${pythonBin}`)
  } else {
    logStartup(`未找到打包的 Python: ${pythonBin}`, 'warn')
  }
}

function setupBundledClaude() {
  const claudeDir = path.join(VENDOR_DIR, 'claude')
  if (!fs.existsSync(claudeDir)) return

  const nativeBin = osPlatform === 'win32'
    ? path.join(claudeDir, 'claude.exe')
    : path.join(claudeDir, 'claude')

  if (fs.existsSync(nativeBin)) {
    packagedPaths.assertNoAsarInSpawnPath('CLAUDE_BIN', nativeBin)
    process.env.CLAUDE_BIN = nativeBin
    logStartup(`使用打包的 Claude CLI: ${nativeBin}`)
    return
  }

  logStartup('未找到打包的 Claude 原生二进制，将尝试系统 PATH 中的 claude 命令', 'warn')
}

function setupBundledDeps() {
  setupBundledPython()
  setupBundledClaude()
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

function waitForBackend(port, timeout = HEALTH_WAIT_MS) {
  return new Promise((resolve) => {
    const start = Date.now()
    let attempts = 0
    const check = () => {
      attempts += 1
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume()
        const ok = res.statusCode === 200
        logStartup(`health 探测 #${attempts}: HTTP ${res.statusCode} (${Date.now() - start}ms)`)
        resolve(ok)
      })
      req.on('error', (err) => {
        const elapsed = Date.now() - start
        if (elapsed > timeout) {
          logStartup(`health 超时 (${elapsed}ms, ${attempts} 次): ${err.message}`, 'error')
          resolve(false)
        } else {
          setTimeout(check, 300)
        }
      })
      req.setTimeout(2000, () => {
        req.destroy()
        const elapsed = Date.now() - start
        if (elapsed > timeout) {
          logStartup(`health 超时 (${elapsed}ms, ${attempts} 次): 请求 2s 无响应`, 'error')
          resolve(false)
        } else {
          setTimeout(check, 300)
        }
      })
    }
    logStartup(`等待 /api/health 就绪（最多 ${timeout / 1000}s）…`)
    check()
  })
}

async function startBackend(port) {
  if (backendStarted && backendPort === port) {
    return port
  }

  process.env.PORT = String(port)

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  const backendDir = platformAdapter.getBackendDir(isDev, process.resourcesPath, __dirname)
  const nodeModulesDir = platformAdapter.getBackendNodeModulesDir(isDev, process.resourcesPath, __dirname)

  process.env.NODE_PATH = nodeModulesDir
  require('module').Module._initPaths()

  const serverPath = path.join(backendDir, 'server.js')
  logStartup(`[${platformAdapter.id}] 启动后端: ${serverPath}`)
  logStartup(`数据目录: ${DATA_DIR}`)
  logStartup(`Node Modules: ${nodeModulesDir}`)

  const t0 = Date.now()
  await platformAdapter.loadBackendModule(serverPath)
  logStartup(`后端模块加载完成 (${Date.now() - t0}ms)`)
  backendStarted = true
  backendPort = port
  return port
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '文匠 Studio',
    ...platformAdapter.getWindowOptions(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadURL(`http://127.0.0.1:${port}`)

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.webContents.openDevTools()
  }

  return win
}

async function launchApp() {
  initStartupLog()
  logStartup('开始启动…')

  setupBundledDeps()

  const port = backendPort || await findFreePort()
  logStartup(`使用端口: ${port}`)

  const backendT0 = Date.now()
  await startBackend(port)
  logStartup(`startBackend 完成 (${Date.now() - backendT0}ms)`)

  const ready = await waitForBackend(port)
  if (!ready) {
    failStartup('后端启动超时', new Error(`等待 /api/health 超过 ${HEALTH_WAIT_MS / 1000}s，请查看启动日志或重新安装。`))
    return
  }

  logStartup('后端已就绪，打开主窗口')
  createWindow(port)
}

app.whenReady().then(async () => {
  try {
    await launchApp()
  } catch (err) {
    failStartup('启动失败', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      launchApp().catch((err) => failStartup('重新启动失败', err))
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
