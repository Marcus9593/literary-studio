const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const net = require('net')
const http = require('http')
const fs = require('fs')

const isDev = !app.isPackaged
const platform = process.platform

// ── 路径配置 ──

const DATA_DIR = isDev
  ? path.resolve(__dirname, '..', 'data')
  : path.join(app.getPath('userData'), 'data')

const SKILLS_DIR = isDev
  ? path.resolve(__dirname, '..', 'skills')
  : path.join(process.resourcesPath, 'skills')

// 打包的依赖目录
const VENDOR_DIR = isDev
  ? path.resolve(__dirname, 'vendor')
  : path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'vendor')

// 设置环境变量
process.env.LITERARY_STUDIO_DATA = DATA_DIR
process.env.LITERARY_WRITER_ROOT = path.join(SKILLS_DIR, 'literary-writer')
process.env.STUDIO_HOST = '127.0.0.1'

// Python 脚本目录
if (!isDev) {
  process.env.PYTHON_SCRIPTS_DIR = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend')
  process.env.LITERARY_STUDIO_BACKEND_DIR = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend-node')
} else if (!process.env.PYTHON_SCRIPTS_DIR) {
  process.env.PYTHON_SCRIPTS_DIR = path.resolve(__dirname, '..', 'backend')
}

let backendPort = null
let backendStarted = false

// ── 配置打包的 Python ──

function setupBundledPython() {
  const pythonDir = path.join(VENDOR_DIR, 'python')
  if (!fs.existsSync(pythonDir)) return

  let pythonBin
  if (platform === 'win32') {
    pythonBin = path.join(pythonDir, 'python.exe')
  } else {
    pythonBin = path.join(pythonDir, 'bin', 'python3')
    if (!fs.existsSync(pythonBin)) {
      pythonBin = path.join(pythonDir, 'bin', 'python')
    }
  }

  if (fs.existsSync(pythonBin)) {
    process.env.PYTHON = pythonBin
    console.log(`使用打包的 Python: ${pythonBin}`)
  }
}

// ── 配置打包的 Claude CLI ──

function setupBundledClaude() {
  const claudeDir = path.join(VENDOR_DIR, 'claude')
  if (!fs.existsSync(claudeDir)) return

  const nativeBin = platform === 'win32'
    ? path.join(claudeDir, 'claude.exe')
    : path.join(claudeDir, 'claude')

  if (fs.existsSync(nativeBin)) {
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

// ── 查找空闲端口 ──

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
        if (Date.now() - start > timeout) {
          resolve(false)
        } else {
          setTimeout(check, 300)
        }
      })
      req.setTimeout(2000, () => {
        req.destroy()
        if (Date.now() - start > timeout) {
          resolve(false)
        } else {
          setTimeout(check, 300)
        }
      })
    }
    check()
  })
}

// ── 启动后端 ──

async function startBackend(port) {
  if (backendStarted && backendPort === port) {
    return port
  }

  process.env.PORT = String(port)

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  const backendDir = isDev
    ? path.resolve(__dirname, '..', 'backend-node')
    : path.join(process.resourcesPath, 'app.asar', 'backend-node')

  const nodeModulesDir = isDev
    ? path.resolve(__dirname, '..', 'backend-node', 'node_modules')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'backend-node', 'node_modules')

  process.env.NODE_PATH = nodeModulesDir
  require('module').Module._initPaths()

  const serverPath = path.join(backendDir, 'server.js')
  console.log(`启动后端: ${serverPath}`)
  console.log(`数据目录: ${DATA_DIR}`)
  console.log(`Node Modules: ${nodeModulesDir}`)

  try {
    await import(serverPath)
    backendStarted = true
    backendPort = port
    console.log('后端加载完成')
    return port
  } catch (err) {
    console.error('后端加载失败:', err)
    throw err
  }
}

// ── 创建窗口 ──

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '文匠 Studio',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
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
    console.error('后端启动超时')
    app.quit()
    return
  }

  createWindow(port)
}

// ── 启动 ──

app.whenReady().then(async () => {
  try {
    await launchApp()
  } catch (err) {
    console.error('启动失败:', err)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      launchApp().catch((err) => {
        console.error('重新启动失败:', err)
        app.quit()
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
