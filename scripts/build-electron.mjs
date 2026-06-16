#!/usr/bin/env node
/**
 * Electron 打包入口 — 按平台分发到 macOS / Windows / Linux 专用脚本
 *
 * 用法:
 *   node scripts/build-electron.mjs            # 当前系统自动选择
 *   node scripts/build-electron.mjs --mac      # macOS DMG  → release/*.dmg
 *   node scripts/build-electron.mjs --win      # Windows    → release/*.exe
 *   node scripts/build-electron.mjs --linux    # Linux RPM  → release/*.rpm
 *   node scripts/build-electron.mjs --arm64    # 仅 macOS，传给 mac.mjs
 *
 * 所有平台安装包统一输出到项目根目录 release/
 */

import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)

let target = null
if (args.includes('--mac')) target = 'mac'
if (args.includes('--win')) target = 'win'
if (args.includes('--linux')) target = 'linux'

if (!target) {
  if (process.platform === 'darwin') target = 'mac'
  else if (process.platform === 'win32') target = 'win'
  else if (process.platform === 'linux') target = 'linux'
  else {
    console.error('请指定目标平台: --mac、--win 或 --linux')
    process.exit(1)
  }
}

const script = path.join(__dirname, 'build-electron', `${target}.mjs`)
const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' })
process.exit(result.status ?? 1)
