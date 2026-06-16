const path = require('path')
const { pathToFileURL } = require('url')

function getBackendDir(isDev, resourcesPath, electronDir) {
  if (isDev) {
    return path.resolve(electronDir, '..', 'backend-node')
  }
  // 后端源码在 app.asar 内；Windows 通过 file:// URL 加载（见 loadBackendModule）
  return path.join(resourcesPath, 'app.asar', 'backend-node')
}

function getBackendNodeModulesDir(isDev, resourcesPath, electronDir) {
  if (isDev) {
    return path.resolve(electronDir, '..', 'backend-node', 'node_modules')
  }
  return path.join(resourcesPath, 'app.asar.unpacked', 'backend-node', 'node_modules')
}

function loadBackendModule(serverPath) {
  // Windows 动态 import 必须使用 file:// URL，否则 E: 会被当成协议
  return import(pathToFileURL(serverPath).href)
}

function getWindowOptions() {
  return {
    titleBarStyle: 'default',
    frame: true,
  }
}

function showStartupError(title, message) {
  const { dialog } = require('electron')
  dialog.showErrorBox(title, message)
}

module.exports = {
  id: 'win32',
  getBackendDir,
  getBackendNodeModulesDir,
  loadBackendModule,
  getWindowOptions,
  showStartupError,
}
