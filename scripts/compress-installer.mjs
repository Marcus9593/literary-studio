#!/usr/bin/env node
/**
 * 无损压缩 release/ 下的 NSIS 安装包（7-Zip LZMA2 最高级别）。
 * 安装包内所有资源（vendor / skills / backend 等）原样保留，仅外层再压缩便于分发。
 *
 * 用法:
 *   node scripts/compress-installer.mjs
 *   node scripts/compress-installer.mjs --input "release/文匠 Studio Setup 2.7.0.exe"
 */

import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RELEASE = path.join(ROOT, 'release')

const SEVEN_ZIP_CANDIDATES = [
  process.env.SEVEN_ZIP,
  'C:\\Program Files\\7-Zip\\7z.exe',
  'C:\\Program Files (x86)\\7-Zip\\7z.exe',
].filter(Boolean)

function find7z() {
  for (const candidate of SEVEN_ZIP_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  const which = spawnSync('where', ['7z'], { encoding: 'utf8', shell: true })
  const line = (which.stdout || '').trim().split(/\r?\n/)[0]
  return line && fs.existsSync(line) ? line : null
}

function pickInstaller(inputArg) {
  if (inputArg) {
    const p = path.isAbsolute(inputArg) ? inputArg : path.join(ROOT, inputArg)
    if (!fs.existsSync(p)) throw new Error(`找不到安装包: ${p}`)
    return p
  }
  if (!fs.existsSync(RELEASE)) throw new Error('release/ 目录不存在，请先构建安装包')
  const exes = fs.readdirSync(RELEASE)
    .filter((n) => n.endsWith('.exe') && !/uninstall/i.test(n))
    .map((n) => path.join(RELEASE, n))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  if (!exes.length) throw new Error('release/ 中未找到 .exe 安装包')
  return exes[0]
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function main() {
  const args = process.argv.slice(2)
  const inputIdx = args.indexOf('--input')
  const inputArg = inputIdx >= 0 ? args[inputIdx + 1] : null
  const installer = pickInstaller(inputArg)
  const out7z = `${installer}.7z`

  const sevenZip = find7z()
  if (!sevenZip) {
    console.error('未找到 7-Zip。请安装 https://www.7-zip.org/ 或设置环境变量 SEVEN_ZIP')
    process.exit(1)
  }

  const before = fs.statSync(installer).size
  console.log(`\n▸ 源安装包: ${path.basename(installer)} (${formatMb(before)})`)
  console.log(`▸ 7-Zip: ${sevenZip}`)
  console.log(`▸ 输出: ${path.basename(out7z)}\n`)

  execSync(
    `"${sevenZip}" a -t7z -mx=9 -mfb=273 -ms=on -mmt=on -y "${out7z}" "${installer}"`,
    { stdio: 'inherit', shell: true },
  )
  execSync(`"${sevenZip}" t "${out7z}"`, { stdio: 'inherit', shell: true })

  const after = fs.statSync(out7z).size
  const saved = before - after
  const pct = before ? ((saved / before) * 100).toFixed(1) : '0.0'

  console.log('\n━━━ 压缩完成（无损）━━━')
  console.log(`  原始: ${formatMb(before)}`)
  console.log(`  7z:   ${formatMb(after)}`)
  console.log(`  节省: ${formatMb(Math.max(saved, 0))} (${pct}%)`)
  console.log('\n解压后安装包与原始 exe 字节级一致，可直接运行安装。\n')
}

main()
