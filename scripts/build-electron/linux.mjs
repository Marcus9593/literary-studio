#!/usr/bin/env node
/**
 * Linux RPM 打包 → release/*.rpm
 *
 * 用法:
 *   node scripts/build-electron/linux.mjs
 *   node scripts/build-electron/linux.mjs --rebuild-deps
 *   node scripts/build-electron/linux.mjs --keep-user-data
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
console.log('║   文匠 Studio — Linux RPM 构建       ║')
console.log('╚══════════════════════════════════════╝')
console.log('\n目标平台: linux-x64')
console.log('输出目录: release/')

cleanPackEnvironment('linux', { keepUserData })
prepReleaseDir()
installDependencies()
buildFrontend()
bundleVendorDeps(args)
rebuildNativeModules()

console.log('\n━━━ 第 5 步: 构建 RPM → release/ ━━━')
run('npx electron-builder --linux rpm --x64')

console.log('\n━━━ 校验打包产物 (extraResources / spawn) ━━━')
run('node scripts/validate-electron-packaged.mjs --dir release/linux-unpacked')

console.log('\n╔══════════════════════════════════════╗')
console.log('║           Linux 构建完成！            ║')
console.log('╚══════════════════════════════════════╝\n')
printReleaseArtifacts((name) => name.endsWith('.rpm'), 'Linux RPM 包')
console.log(`\n输出路径: ${RELEASE_DIR}`)
