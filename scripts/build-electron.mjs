#!/usr/bin/env node
/**
 * 文匠 Studio — Electron DMG 构建脚本
 *
 * 用法:
 *   node scripts/build-electron.mjs          # 构建当前架构的 DMG
 *   node scripts/build-electron.mjs --arm64  # 仅构建 Apple Silicon
 *   node scripts/build-electron.mjs --x64    # 仅构建 Intel
 *   node scripts/build-electron.mjs --all    # 构建双架构
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function run(cmd, opts = {}) {
  console.log(`\n▸ ${cmd}`)
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts })
}

function exists(p) {
  return fs.existsSync(path.join(ROOT, p))
}

// ── 解析参数 ──
const args = process.argv.slice(2)
let arch = process.arch === 'arm64' ? 'arm64' : 'x64'
if (args.includes('--all')) arch = 'universal'
if (args.includes('--arm64')) arch = 'arm64'
if (args.includes('--x64')) arch = 'x64'

console.log('╔══════════════════════════════════════╗')
console.log('║   文匠 Studio — Electron DMG 构建    ║')
console.log('╚══════════════════════════════════════╝')
console.log(`\n目标架构: ${arch}`)
console.log(`输出目录: release/`)

// ── 检查图标 ──
if (!exists('electron/icons/icon.icns')) {
  console.log('\n⚠️  未找到 electron/icons/icon.icns')
  console.log('   将使用 Electron 默认图标。')
  console.log('   如需自定义图标，请准备 1024x1024 PNG 并转换为 .icns 格式。')
}

// ── 第 1 步: 安装依赖 ──
console.log('\n━━━ 第 1 步: 安装依赖 ━━━')
if (!exists('backend-node/node_modules')) {
  run('npm install --prefix backend-node')
}
if (!exists('node_modules/electron')) {
  run('npm install')
}

// ── 第 2 步: 构建前端 ──
console.log('\n━━━ 第 2 步: 构建前端 ━━━')
run('npm run build --prefix frontend')

// ── 第 3 步: 重编译原生模块 ──
console.log('\n━━━ 第 3 步: 重编译原生模块 (匹配 Electron Node ABI) ━━━')
run('npx electron-rebuild')

// ── 第 4 步: 构建 DMG ──
console.log('\n━━━ 第 4 步: 构建 DMG ━━━')
const archFlag = arch === 'universal' ? '' : `--${arch}`
run(`npx electron-builder --mac dmg ${archFlag}`)

// ── 完成 ──
console.log('\n╔══════════════════════════════════════╗')
console.log('║           构建完成！                  ║')
console.log('╚══════════════════════════════════════╝')
console.log('\n输出文件:')

const releaseDir = path.join(ROOT, 'release')
if (fs.existsSync(releaseDir)) {
  const files = fs.readdirSync(releaseDir).filter(f => f.endsWith('.dmg') || f.endsWith('.zip'))
  for (const f of files) {
    const size = fs.statSync(path.join(releaseDir, f)).size
    const sizeMB = (size / 1024 / 1024).toFixed(1)
    console.log(`  📦 ${f} (${sizeMB} MB)`)
  }
}

console.log('\n使用方法:')
console.log('  1. 双击 .dmg 文件')
console.log('  2. 拖拽"文匠 Studio"到"Applications"')
console.log('  3. 在启动台点击图标启动')
console.log('')
