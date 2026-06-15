const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const net = require('net')

const isDev = !app.isPackaged

// ── 路径配置 ──

const DATA_DIR = isDev
  ? path.resolve(__dirname, '..', 'data')
  : path.join(app.getPath('userData'), 'data')

const SKILLS_DIR = isDev
  ? path.resolve(__dirname, '..', 'skills')
  : path.join(process.resourcesPath, 'skills')

// 设置环境变量
process.env.LITERARY_STUDIO_DATA = DATA_DIR
process.env.LITERARY_WRITER_ROOT = path.join(SKILLS_DIR, 'literary-writer')
process.env.STUDIO_HOST = '127.0.0.1'

if (!isDev) {
  process.env.PYTHON_SCRIPTS_DIR = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend')
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
      const socket = net.createConnection(port, '127.0.0.1')
      socket.on('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.on('error', () => {
        socket.destroy()
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
  process.env.PORT = String(port)
  const backendDir = path.resolve(__dirname, '..', 'backend-node')
  process.env.NODE_PATH = path.join(backendDir, 'node_modules')
  require('module').Module._initPaths()
  const serverPath = path.join(backendDir, 'server.js')
  await import(serverPath)
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

// ── 启动 ──

app.whenReady().then(async () => {
  try {
    // 找一个空闲端口
    const port = await findFreePort()
    console.log(`使用端口: ${port}`)

    // 启动后端
    await startBackend(port)

    // 等待后端就绪
    const ready = await waitForBackend(port)
    if (!ready) {
      console.error('后端启动超时')
      app.quit()
      return
    }

    // 打开窗口
    createWindow(port)
  } catch (err) {
    console.error('启动失败:', err)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      findFreePort().then((port) => {
        startBackend(port).then(() => waitForBackend(port)).then(() => createWindow(port))
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
