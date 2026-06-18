#!/usr/bin/env node
/**
 * 打包前清理：release 产物、仓库测试数据、Electron userData
 *
 * 用法:
 *   node scripts/clean-pack-environment.mjs
 *   node scripts/clean-pack-environment.mjs --platform mac --arch x64
 *   node scripts/clean-pack-environment.mjs --platform win
 *   node scripts/clean-pack-environment.mjs --platform linux
 *   node scripts/clean-pack-environment.mjs --keep-user-data
 */
import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')
export const RELEASE_DIR = path.join(ROOT, 'release')

const REPO_DATA_DIRS = [
  path.join(ROOT, 'data'),
  path.join(ROOT, 'backend-node', 'data'),
]

const FORBIDDEN_IN_BUNDLE = ['studio.db', 'projects', 'guestbook.json']

/** Electron userData 根目录（与 appId / name 一致） */
export function electronUserDataRoot() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'literary-studio')
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'literary-studio')
  }
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  return path.join(configHome, 'literary-studio')
}

function rmDirContents(dir) {
  if (!fs.existsSync(dir)) return 0
  let removed = 0
  for (const name of fs.readdirSync(dir)) {
    if (name === '.gitkeep') continue
    fs.rmSync(path.join(dir, name), { recursive: true, force: true })
    removed += 1
  }
  return removed
}

function rmIfExists(full, label) {
  if (!fs.existsSync(full)) return false
  fs.rmSync(full, { recursive: true, force: true })
  if (label) console.log(`  ✓ ${label}`)
  return true
}

export function quitRunningApp(platform = process.platform) {
  if (platform === 'mac' || platform === 'darwin') {
    try { execSync('osascript -e \'quit app "文匠 Studio"\'', { stdio: 'ignore' }) } catch { /* not running */ }
    try { execSync('pkill -f "文匠 Studio.app/Contents/MacOS"', { stdio: 'ignore' }) } catch { /* not running */ }
    return
  }
  if (platform === 'win' || platform === 'win32') {
    try { execSync('taskkill /F /IM "文匠 Studio.exe" /T', { stdio: 'ignore' }) } catch { /* not running */ }
    return
  }
  try { execSync('pkill -f "文匠 Studio"', { stdio: 'ignore' }) } catch { /* not running */ }
  try { execSync('pkill -f literary-studio', { stdio: 'ignore' }) } catch { /* not running */ }
}

function cleanReleaseMeta(releaseDir) {
  if (!fs.existsSync(releaseDir)) return
  const metaPatterns = [
    (n) => n.endsWith('.blockmap'),
    (n) => n === 'builder-debug.yml',
    (n) => n === 'builder-effective-config.yaml',
    (n) => n.startsWith('latest-') && n.endsWith('.yml'),
    (n) => n.endsWith('.tmp'),
  ]
  for (const name of fs.readdirSync(releaseDir)) {
    if (metaPatterns.some((fn) => fn(name))) {
      rmIfExists(path.join(releaseDir, name), `已删除 release/${name}`)
    }
  }
}

/** 按目标平台清理 release/ 中的旧产物与 unpacked 目录 */
export function cleanReleaseArtifacts(platform, arch = 'x64') {
  const dirs = []
  const files = []

  if (platform === 'mac') {
    if (arch === 'x64' || arch === 'universal') dirs.push('mac', 'mac-unpacked')
    if (arch === 'arm64' || arch === 'universal') dirs.push('mac-arm64', 'mac-unpacked')
    files.push((n) => n.endsWith('.dmg') || n.endsWith('.zip'))
  } else if (platform === 'win') {
    dirs.push('win-unpacked')
    files.push((n) => n.endsWith('.exe') && !n.toLowerCase().includes('uninstall'))
  } else if (platform === 'linux') {
    dirs.push('linux-unpacked')
    files.push((n) => n.endsWith('.rpm') || n.endsWith('.AppImage') || n.endsWith('.deb'))
  }

  for (const dir of [...new Set(dirs)]) {
    rmIfExists(path.join(RELEASE_DIR, dir), `已删除 release/${dir}/`)
  }

  if (fs.existsSync(RELEASE_DIR)) {
    for (const name of fs.readdirSync(RELEASE_DIR)) {
      if (files.some((fn) => fn(name))) {
        rmIfExists(path.join(RELEASE_DIR, name), `已删除 release/${name}`)
      }
    }
  }

  cleanReleaseMeta(RELEASE_DIR)
}

export function cleanRepoTestData() {
  let total = 0
  for (const dir of REPO_DATA_DIRS) {
    const n = rmDirContents(dir)
    if (n) console.log(`  ✓ ${path.relative(ROOT, dir)} (${n} 项)`)
    total += n
    fs.mkdirSync(dir, { recursive: true })
  }

  const testDir = path.join(ROOT, 'test')
  if (fs.existsSync(testDir)) {
    for (const name of fs.readdirSync(testDir)) {
      if (name.startsWith('regression') && name.endsWith('.log')) {
        fs.rmSync(path.join(testDir, name), { force: true })
        console.log(`  ✓ test/${name}`)
        total += 1
      }
    }
  }

  return total
}

export function cleanElectronUserData() {
  const dataDir = path.join(electronUserDataRoot(), 'data')
  if (!fs.existsSync(dataDir)) {
    console.log(`  ⏭ Electron 用户数据不存在: ${dataDir}`)
    return 0
  }

  let projectCount = 0
  const projectsDir = path.join(dataDir, 'projects')
  try {
    projectCount = fs.readdirSync(projectsDir).filter((n) => !n.startsWith('.')).length
  } catch { /* no projects dir */ }

  fs.rmSync(dataDir, { recursive: true, force: true })
  console.log(`  ✓ 已清空 ${dataDir}（原 ${projectCount} 个项目）`)
  return 1
}

export function verifyAppBundleClean(appPath) {
  const errors = []
  if (!fs.existsSync(appPath)) return errors

  function walk(dir, prefix = '') {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name
      const full = path.join(dir, ent.name)
      if (FORBIDDEN_IN_BUNDLE.some((bad) => rel === bad || rel.endsWith(`/${bad}`))) {
        errors.push(rel)
      }
      if (ent.isDirectory()) {
        walk(full, rel)
      }
    }
  }

  walk(appPath)
  return errors
}

/**
 * @param {object} options
 * @param {'mac'|'win'|'linux'} [options.platform]
 * @param {'x64'|'arm64'|'universal'} [options.arch]
 * @param {boolean} [options.freshUserData=true] 清空 Electron userData/data
 * @param {boolean} [options.cleanRepo=true] 清空仓库 data/
 */
export function runCleanPackEnvironment(options = {}) {
  const platform = options.platform
    || (process.platform === 'darwin' ? 'mac'
      : process.platform === 'win32' ? 'win' : 'linux')
  const arch = options.arch || 'x64'
  const freshUserData = options.freshUserData !== false
  const cleanRepo = options.cleanRepo !== false

  console.log('\n━━━ 第 0 步: 清理打包环境 ━━━')
  console.log(`  目标平台: ${platform}${platform === 'mac' ? ` (${arch})` : ''}`)

  quitRunningApp(platform)
  cleanReleaseArtifacts(platform, arch)

  if (cleanRepo) {
    console.log('  清理仓库测试数据…')
    const n = cleanRepoTestData()
    if (!n) console.log('  （仓库 data/ 已为空）')
  }

  if (freshUserData) {
    cleanElectronUserData()
  } else {
    console.log('  ⏭ 保留 Electron 用户数据（--keep-user-data）')
  }

  console.log('  ✓ 打包环境已清理\n')
}

function parseCliArgs(argv) {
  let platform = process.platform === 'darwin' ? 'mac'
    : process.platform === 'win32' ? 'win' : 'linux'
  let arch = 'x64'

  const platformFlag = argv.find((a) => a.startsWith('--platform='))
  if (platformFlag) platform = platformFlag.split('=')[1]
  else if (argv.includes('--platform')) {
    platform = argv[argv.indexOf('--platform') + 1]
  } else if (argv.includes('--mac')) platform = 'mac'
  else if (argv.includes('--win')) platform = 'win'
  else if (argv.includes('--linux')) platform = 'linux'

  if (argv.includes('--arm64')) arch = 'arm64'
  if (argv.includes('--all')) arch = 'universal'
  if (argv.includes('--x64')) arch = 'x64'

  return {
    platform,
    arch,
    freshUserData: !argv.includes('--keep-user-data'),
    cleanRepo: !argv.includes('--skip-repo-data'),
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCleanPackEnvironment(parseCliArgs(process.argv.slice(2)))
}
