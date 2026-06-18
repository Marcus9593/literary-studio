#!/usr/bin/env node
/**
 * 模拟 Electron 打包环境启动后端（需在 ELECTRON_RUN_AS_NODE=1 下用安装包 exe 运行）
 * 用法:
 *   $env:ELECTRON_RUN_AS_NODE='1'
 *   & 'E:\literary-studio\文匠 Studio.exe' 'path\to\debug-packaged-startup.mjs'
 */
import { createRequire } from 'module'
import net from 'net'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const resourcesPath = process.resourcesPath || path.join(__dirname, '..', 'release', 'win-unpacked', 'resources')

const require = createRequire(import.meta.url)
const platformAdapter = require(path.join(resourcesPath, 'app.asar', 'electron', 'platform', 'win32.js'))
const packagedPaths = require(path.join(resourcesPath, 'app.asar', 'electron', 'packaged-paths.js'))

const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(process.env.APPDATA || '', 'literary-studio', 'data')
process.env.LITERARY_STUDIO_DATA = DATA_DIR
process.env.STUDIO_HOST = '127.0.0.1'
process.env.PYTHON_SCRIPTS_DIR = packagedPaths.backendScriptsDir(resourcesPath)
process.env.LITERARY_STUDIO_BACKEND_DIR = path.join(resourcesPath, 'app.asar.unpacked', 'backend-node')

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
  process.env.PORT = String(port)
  fs.mkdirSync(DATA_DIR, { recursive: true })

  const electronDir = path.join(resourcesPath, 'app.asar', 'electron')
  const backendDir = platformAdapter.getBackendDir(false, resourcesPath, electronDir)
  const nodeModulesDir = platformAdapter.getBackendNodeModulesDir(false, resourcesPath, electronDir)

  console.log('[debug] resourcesPath:', resourcesPath)
  console.log('[debug] backendDir:', backendDir)
  console.log('[debug] nodeModules:', nodeModulesDir)
  console.log('[debug] DATA_DIR:', DATA_DIR)
  console.log('[debug] NODE_ENV:', process.env.NODE_ENV)

  process.env.NODE_PATH = nodeModulesDir
  require('module').Module._initPaths()

  const serverPath = path.join(backendDir, 'server.js')
  const t0 = Date.now()
  await platformAdapter.loadBackendModule(serverPath)
  console.log('[debug] import ms:', Date.now() - t0)
}

const port = await findFreePort()
console.log('[debug] port:', port)
await startBackend(port)
const ready = await waitForBackend(port)
console.log('[debug] health ready:', ready, 'total ms:', Date.now())
process.exit(ready ? 0 : 1)
