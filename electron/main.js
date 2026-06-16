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

let backendPort = null
let backendStarted = false

function failStartup(title, err) {
  const message = err?.stack || err?.message || String(err)
  console.error(`${title}:`, message)
  platformAdapter.showStartupError(title, message)
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
    console.log(`使用打包的 Python: ${pythonBin}`)
  } else {
    console.warn(`未找到打包的 Python: ${pythonBin}`)
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
    console.log(`使用打包的 Claude CLI: ${nativeBin}`)
    return
  }

  console.warn('未找到打包的 Claude 原生二进制，将尝试系统 PATH 中的 claude 命令')
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

function waitForBackend(port, timeout = 20000) {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      })
      req.on('error', () => {
        if (Date.now() - start > timeout) resolve(false)
        else setTimeout(check, 300)
      })
      req.setTimeout(2000, () => {
        req.destroy()
        if (Date.now() - start > timeout) resolve(false)
        else setTimeout(check, 300)
      })
    }
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
  console.log(`[${platformAdapter.id}] 启动后端: ${serverPath}`)
  console.log(`数据目录: ${DATA_DIR}`)
  console.log(`Node Modules: ${nodeModulesDir}`)

  await platformAdapter.loadBackendModule(serverPath)
  backendStarted = true
  backendPort = port
  console.log('后端加载完成')
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
  setupBundledDeps()

  const port = backendPort || await findFreePort()
  console.log(`使用端口: ${port}`)

  await startBackend(port)

  const ready = await waitForBackend(port)
  if (!ready) {
    failStartup('后端启动超时', new Error('等待 /api/health 超时，请查看日志或重新安装。'))
    return
  }

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
