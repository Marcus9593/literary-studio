#!/usr/bin/env node
/**
 * 校验 Electron 打包 vendor 依赖是否完整。
 * Windows / macOS 各检查对应二进制与 Python 包。
 *
 * 用法:
 *   node scripts/validate-electron-vendor.mjs
 *   node scripts/validate-electron-vendor.mjs --platform win32
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const VENDOR = path.join(ROOT, 'electron', 'vendor')

const platform = (() => {
  const arg = process.argv.find((a) => a.startsWith('--platform='))
  if (arg) return arg.split('=')[1]
  if (process.argv.includes('--platform')) {
    const i = process.argv.indexOf('--platform')
    return process.argv[i + 1]
  }
  return process.platform
})()

const errors = []

function requirePath(relPath, label) {
  const full = path.join(VENDOR, relPath)
  if (!fs.existsSync(full)) {
    errors.push(`缺少 ${label}: ${full}`)
    return null
  }
  return full
}

function run(cmd, label) {
  try {
    execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' })
  } catch (err) {
    const detail = err.stderr?.trim() || err.stdout?.trim() || err.message
    errors.push(`${label} 运行失败: ${detail}`)
  }
}

console.log(`校验 Electron vendor 依赖 (platform=${platform})`)

const skillsRoot = path.join(ROOT, 'skills', 'literary-writer')
if (!fs.existsSync(path.join(skillsRoot, 'SKILL.md'))) {
  errors.push(`缺少 literary-writer Skill: ${skillsRoot}`)
}

if (platform === 'win32') {
  const python = requirePath('python/python.exe', 'Python 运行时')
  requirePath('claude/claude.exe', 'Claude CLI')

  if (python) {
    run(`"${python}" -c "import mammoth, fitz, markdownify, docx, charset_normalizer"`, 'Python 文档转换库')
    run(`"${python}" --version`, 'Python 版本')
  }

  const claude = path.join(VENDOR, 'claude', 'claude.exe')
  if (fs.existsSync(claude)) {
    run(`"${claude}" --version`, 'Claude CLI')
  }
} else if (platform === 'darwin' || platform === 'linux') {
  const python = requirePath('python/bin/python3', 'Python 运行时')
  requirePath('claude/claude', 'Claude CLI')

  if (python) {
    run(`"${python}" -c "import mammoth, fitz, markdownify, docx, charset_normalizer"`, 'Python 文档转换库')
    run(`"${python}" --version`, 'Python 版本')
  }

  const claude = path.join(VENDOR, 'claude', 'claude')
  if (fs.existsSync(claude)) {
    run(`"${claude}" --version`, 'Claude CLI')
  }
} else {
  console.warn(`未定义 ${platform} 的 vendor 校验规则，跳过`)
  process.exit(0)
}

if (errors.length) {
  console.error('\n❌ vendor 依赖校验失败:\n')
  for (const e of errors) console.error(`  • ${e}`)
  console.error('\n请先运行: node scripts/bundle-deps.mjs')
  process.exit(1)
}

console.log('\n✅ vendor 依赖校验通过')
