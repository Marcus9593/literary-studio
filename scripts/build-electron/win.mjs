#!/usr/bin/env node
/**
 * Windows NSIS 安装包打包 → release/*.exe
 *
 * 用法:
 *   node scripts/build-electron/win.mjs
 *   node scripts/build-electron/win.mjs --rebuild-deps
 *   node scripts/build-electron/win.mjs --keep-user-data
 */

import {
  run,
  exists,
  RELEASE_DIR,
  prepReleaseDir,
  cleanPackEnvironment,
  printReleaseArtifacts,
  installDependencies,
  buildFrontend,
  bundleVendorDeps,
  rebuildNativeModules,
} from './shared.mjs'

const args = process.argv.slice(2)
const keepUserData = args.includes('--keep-user-data')

console.log('╔══════════════════════════════════════╗')
console.log('║   文匠 Studio — Windows NSIS 构建    ║')
console.log('╚══════════════════════════════════════╝')
console.log('\n目标平台: win32-x64')
console.log(`输出目录: release/`)

if (!exists('electron/icons/icon.ico')) {
  console.log('\n⚠️  未找到 electron/icons/icon.ico，将使用 Electron 默认图标。')
}

cleanPackEnvironment('win', { keepUserData })
prepReleaseDir()
installDependencies()
buildFrontend()
bundleVendorDeps(args)
rebuildNativeModules()

console.log('\n━━━ 第 5 步: 构建 NSIS 安装包 → release/ ━━━')
run('npx electron-builder --win nsis --x64')

console.log('\n━━━ 校验打包产物 (extraResources / spawn) ━━━')
run('node scripts/validate-electron-packaged.mjs --dir release/win-unpacked')

console.log('\n╔══════════════════════════════════════╗')
console.log('║          Windows 构建完成！           ║')
console.log('╚══════════════════════════════════════╝\n')
printReleaseArtifacts(
  (name) => name.endsWith('.exe') && !name.toLowerCase().includes('uninstall'),
  'Windows 安装包',
)
console.log(`\n输出路径: ${RELEASE_DIR}`)
