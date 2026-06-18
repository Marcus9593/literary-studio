import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { runCleanPackEnvironment } from '../clean-pack-environment.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '../..')
/** 各平台安装包统一输出目录（与 package.json build.directories.output 一致） */
export const RELEASE_DIR = path.join(ROOT, 'release')

export function prepReleaseDir() {
  fs.mkdirSync(RELEASE_DIR, { recursive: true })
}

/**
 * 打包前清理 release 产物、仓库测试数据、Electron userData
 * @param {'mac'|'win'|'linux'} platform
 * @param {{ arch?: string, keepUserData?: boolean }} [opts]
 */
export function cleanPackEnvironment(platform, opts = {}) {
  runCleanPackEnvironment({
    platform,
    arch: opts.arch || 'x64',
    freshUserData: !opts.keepUserData,
    cleanRepo: true,
  })
}

export function printReleaseArtifacts(filterFn, label = '安装包') {
  if (!fs.existsSync(RELEASE_DIR)) return
  const files = fs.readdirSync(RELEASE_DIR).filter(filterFn)
  for (const f of files) {
    const full = path.join(RELEASE_DIR, f)
    const sizeMB = (fs.statSync(full).size / 1024 / 1024).toFixed(1)
    console.log(`  📦 ${f} (${sizeMB} MB)`)
  }
  if (!files.length) console.log(`  （release/ 中暂无 ${label}）`)
}

export function run(cmd, opts = {}) {
  console.log(`\n▸ ${cmd}`)
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts })
}

export function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath))
}

export function claudeBundled() {
  if (process.platform === 'win32') return exists('electron/vendor/claude/claude.exe')
  return exists('electron/vendor/claude/claude')
}

export function installDependencies() {
  console.log('\n━━━ 第 1 步: 安装依赖 ━━━')
  if (!exists('backend-node/node_modules')) {
    run('npm install --prefix backend-node')
  }
  if (!exists('node_modules/electron')) {
    run('npm install')
  }
}

export function buildFrontend() {
  console.log('\n━━━ 第 2 步: 构建前端 ━━━')
  run('npm run build --prefix frontend')
}

export function bundleVendorDeps(args = []) {
  console.log('\n━━━ 第 3 步: 打包 Python 运行时和 Claude CLI ━━━')
  if (!exists('electron/vendor/python') || args.includes('--rebuild-deps')) {
    run('node scripts/bundle-deps.mjs')
  } else if (!claudeBundled()) {
    console.log('  Claude CLI 未打包，尝试补装…')
    run('node scripts/bundle-deps.mjs --claude-only')
  } else {
    console.log('  ⏭ 依赖已存在，跳过（使用 --rebuild-deps 强制重新打包）')
  }
  validateVendorDeps()
}

export function validateVendorDeps() {
  console.log('\n━━━ 校验 vendor 依赖 ━━━')
  const platformFlag = process.platform === 'win32' ? '--platform win32'
    : process.platform === 'darwin' ? '--platform darwin'
      : process.platform === 'linux' ? '--platform linux' : ''
  run(`node scripts/validate-electron-vendor.mjs ${platformFlag}`.trim())
}

export function rebuildNativeModules() {
  console.log('\n━━━ 第 4 步: 重编译原生模块 (匹配 Electron Node ABI) ━━━')
  run('npx electron-rebuild -w @lancedb/lancedb -w @lancedb/lancedb-win32-x64-msvc')
}

export function listReleaseArtifacts(filterFn) {
  if (!fs.existsSync(RELEASE_DIR)) return []
  return fs.readdirSync(RELEASE_DIR).filter(filterFn)
}
