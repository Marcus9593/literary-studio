#!/usr/bin/env node
/**
 * 递增发布版本（SemVer），同步子包与 README 徽章。
 *
 * 用法:
 *   node scripts/bump-version.mjs patch
 *   node scripts/bump-version.mjs minor
 *   node scripts/bump-version.mjs major
 *   node scripts/bump-version.mjs 2.7.0   # 指定版本
 *
 * 版本唯一来源: 根 package.json（electron-builder / Docker 均读取此处）
 */
import fs from 'fs'
import path from 'path'
import {
  ROOT,
  readVersion,
  bumpVersion,
  writeJsonVersion,
} from './lib/version.mjs'

const PKG_FILES = [
  'package.json',
  'frontend/package.json',
  'backend-node/package.json',
]

const README = path.join(ROOT, 'README.md')
const BADGE_RE = /badge\/Version-[\d.]+/

function syncReadmeBadge(version) {
  if (!fs.existsSync(README)) return
  const text = fs.readFileSync(README, 'utf8')
  const next = text.replace(BADGE_RE, `badge/Version-${version}`)
  if (next !== text) {
    fs.writeFileSync(README, next, 'utf8')
    console.log(`  ✓ README.md 版本徽章 → ${version}`)
  }
}

function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('用法: node scripts/bump-version.mjs <patch|minor|major|x.y.z>')
    process.exit(1)
  }

  const current = readVersion()
  const next = /^\d+\.\d+\.\d+/.test(arg) ? arg : bumpVersion(current, arg)

  if (next === current) {
    console.log(`版本未变: ${current}`)
    return
  }

  console.log(`版本: ${current} → ${next}\n`)

  for (const rel of PKG_FILES) {
    const full = path.join(ROOT, rel)
    if (!fs.existsSync(full)) continue
    writeJsonVersion(full, next)
    console.log(`  ✓ ${rel}`)
  }

  syncReadmeBadge(next)

  console.log(`
下一步（发布清单）:
  1. 更新 CHANGELOG 或 Release Notes（本次改动摘要）
  2. git add -A && git commit -m "chore: release v${next}"
  3. git tag v${next} && git push origin main --tags
  4. npm run electron:build:win   # 或对应平台
  5. gh release create v${next} --title "文匠 Studio ${next}" --notes "..." <安装包>
`)
}

main()
