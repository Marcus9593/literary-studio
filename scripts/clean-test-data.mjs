#!/usr/bin/env node
/**
 * 清理开发/测试产生的本地数据，确保打包前仓库内无用户内容。
 *
 * 用法:
 *   node scripts/clean-test-data.mjs
 *   node scripts/clean-test-data.mjs --appdata   # 同时清理 Electron userData 中的 data/
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const DATA_DIRS = [
  path.join(ROOT, 'data'),
  path.join(ROOT, 'backend-node', 'data'),
]

const LOG_GLOBS = ['test/regression*.log', 'test/*.log']

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

function cleanLogFiles() {
  let removed = 0
  const testDir = path.join(ROOT, 'test')
  if (!fs.existsSync(testDir)) return removed
  for (const name of fs.readdirSync(testDir)) {
    if (name.startsWith('regression') && name.endsWith('.log')) {
      fs.rmSync(path.join(testDir, name), { force: true })
      removed += 1
    }
  }
  return removed
}

function electronUserDataDir() {
  const appData = process.env.APPDATA
    || (process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), 'AppData', 'Roaming'))
  return path.join(appData, 'literary-studio')
}

const cleanAppData = process.argv.includes('--appdata')
let total = 0

console.log('清理项目内测试数据…')
for (const dir of DATA_DIRS) {
  const n = rmDirContents(dir)
  if (n) console.log(`  ✓ ${path.relative(ROOT, dir)} (${n} 项)`)
  total += n
  fs.mkdirSync(dir, { recursive: true })
}

const logs = cleanLogFiles()
if (logs) {
  console.log(`  ✓ test/ 回归日志 (${logs} 个)`)
  total += logs
}

if (cleanAppData) {
  const userData = electronUserDataDir()
  const dataDir = path.join(userData, 'data')
  const n = rmDirContents(dataDir)
  console.log(`  ✓ ${dataDir} (${n} 项)`)
  total += n
}

console.log(total ? `\n已清理 ${total} 项。` : '\n无需清理（目录已为空）。')
