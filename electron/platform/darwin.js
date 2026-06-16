const path = require('path')
const { pathToFileURL } = require('url')

function getBackendDir(isDev, resourcesPath, electronDir) {
  if (isDev) {
    return path.resolve(electronDir, '..', 'backend-node')
  }
  return path.join(resourcesPath, 'app.asar', 'backend-node')
}

function getBackendNodeModulesDir(isDev, resourcesPath, electronDir) {
  if (isDev) {
    return path.resolve(electronDir, '..', 'backend-node', 'node_modules')
  }
  return path.join(resourcesPath, 'app.asar.unpacked', 'backend-node', 'node_modules')
}

function loadBackendModule(serverPath) {
  // macOS 也统一走 file URL，行为一致
  return import(pathToFileURL(serverPath).href)
}

function getWindowOptions() {
  return {
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  }
}

function showStartupError(title, message) {
  const { dialog } = require('electron')
  dialog.showErrorBox(title, message)
}

module.exports = {
  id: 'darwin',
  getBackendDir,
  getBackendNodeModulesDir,
  loadBackendModule,
  getWindowOptions,
  showStartupError,
}
