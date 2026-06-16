/**
 * 打包后资源路径（extraResources）。
 * Python / Claude / Skill 脚本必须放在不含 `.asar` 的物理目录，
 * 否则 Electron 内置 Node 的 child_process.spawn 会 ENOENT。
 */
const path = require('path')

function vendorDir(resourcesPath) {
  return path.join(resourcesPath, 'vendor')
}

function skillsDir(resourcesPath) {
  return path.join(resourcesPath, 'skills')
}

function backendScriptsDir(resourcesPath) {
  return path.join(resourcesPath, 'backend')
}

function pythonBin(resourcesPath, platform = process.platform) {
  const pythonRoot = path.join(vendorDir(resourcesPath), 'python')
  if (platform === 'win32') {
    return path.join(pythonRoot, 'python.exe')
  }
  const py3 = path.join(pythonRoot, 'bin', 'python3')
  const py = path.join(pythonRoot, 'bin', 'python')
  return py3 // caller should fs.existsSync fallback to py
}

function claudeBin(resourcesPath, platform = process.platform) {
  const claudeRoot = path.join(vendorDir(resourcesPath), 'claude')
  return platform === 'win32'
    ? path.join(claudeRoot, 'claude.exe')
    : path.join(claudeRoot, 'claude')
}

function literaryWriterRoot(resourcesPath) {
  return path.join(skillsDir(resourcesPath), 'literary-writer')
}

function assertNoAsarInSpawnPath(label, filePath) {
  if (String(filePath).includes('.asar')) {
    throw new Error(`${label} 路径不能包含 .asar（会导致 spawn ENOENT）: ${filePath}`)
  }
}

module.exports = {
  vendorDir,
  skillsDir,
  backendScriptsDir,
  pythonBin,
  claudeBin,
  literaryWriterRoot,
  assertNoAsarInSpawnPath,
}
