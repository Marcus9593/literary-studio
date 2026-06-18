#!/usr/bin/env node
/**
 * macOS DMG 打包 → release/*.dmg
 *
 * 用法:
 *   node scripts/build-electron/mac.mjs
 *   node scripts/build-electron/mac.mjs --arm64
 *   node scripts/build-electron/mac.mjs --x64
 *   node scripts/build-electron/mac.mjs --all
 *   node scripts/build-electron/mac.mjs --keep-user-data
 */

import {
  run,
  exists,
  RELEASE_DIR,
  prepReleaseDir,
  cleanPackEnvironment,
  printReleaseArtifacts,
  runPrepackChecklist,
  installDependencies,
  buildFrontend,
  bundleVendorDeps,
  rebuildNativeModules,
} from './shared.mjs'

const args = process.argv.slice(2)
let arch = process.arch === 'arm64' ? 'arm64' : 'x64'
if (args.includes('--all')) arch = 'universal'
if (args.includes('--arm64')) arch = 'arm64'
if (args.includes('--x64')) arch = 'x64'
const keepUserData = args.includes('--keep-user-data')

console.log('╔══════════════════════════════════════╗')
console.log('║   文匠 Studio — macOS DMG 构建       ║')
console.log('╚══════════════════════════════════════╝')
console.log(`\n目标架构: ${arch}`)
console.log('输出目录: release/')

if (!exists('electron/icons/icon.icns')) {
  console.log('\n⚠️  未找到 electron/icons/icon.icns，将使用 Electron 默认图标。')
}

runPrepackChecklist('mac')
cleanPackEnvironment('mac', { arch, keepUserData })
prepReleaseDir()
installDependencies()
buildFrontend()

console.log('\n━━━ 生成应用图标（Dock 安全区） ━━━')
if (exists('electron/icons/icon-source.png') || exists('electron/icons/icon.icns')) {
  run('python3 scripts/build-app-icon.py')
} else {
  console.log('  ⚠️  跳过：未找到 icon-source.png')
}

bundleVendorDeps(args)
rebuildNativeModules()

console.log('\n━━━ 第 5 步: 构建 DMG → release/ ━━━')
const archFlag = arch === 'universal' ? '' : `--${arch}`
run(`npx electron-builder --mac dmg ${archFlag}`)

console.log('\n━━━ 校验打包产物 (extraResources / spawn) ━━━')
run('node scripts/validate-electron-packaged.mjs --dir release/mac')

console.log('\n╔══════════════════════════════════════╗')
console.log('║           macOS 构建完成！            ║')
console.log('╚══════════════════════════════════════╝\n')
printReleaseArtifacts(
  (name) => name.endsWith('.dmg') || name.endsWith('.zip'),
  'macOS 安装包',
)
console.log(`\n输出路径: ${RELEASE_DIR}`)
console.log('使用方法: 打开 release/*.dmg → 拖入 Applications → 启动')
