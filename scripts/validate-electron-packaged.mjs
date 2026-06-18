#!/usr/bin/env node
/**
 * 校验 electron-builder 产物（win-unpacked / mac-unpacked）中的 extraResources 布局，
 * 并模拟 Node spawn Python，确保纯净机器安装后不会出现 app.asar ENOENT。
 *
 * 用法:
 *   node scripts/validate-electron-packaged.mjs
 *   node scripts/validate-electron-packaged.mjs --dir release/win-unpacked
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const platform = process.platform
const isWin = platform === 'win32'

function parseDirArg() {
  const flag = process.argv.find((a) => a.startsWith('--dir='))
  if (flag) return path.resolve(flag.split('=')[1])
  if (process.argv.includes('--dir')) {
    const i = process.argv.indexOf('--dir')
    return path.resolve(process.argv[i + 1])
  }
  const candidates = [
    path.join(ROOT, 'release', 'win-unpacked'),
    path.join(ROOT, 'release', 'mac'),
    path.join(ROOT, 'release', 'mac-arm64'),
    path.join(ROOT, 'release', 'mac-unpacked'),
    path.join(ROOT, 'release', 'linux-unpacked'),
  ]
  return candidates.find((d) => fs.existsSync(d)) || candidates[0]
}

/** win/linux: appDir/resources；mac .app: Contents/Resources */
function resolveResourcesDir(appDir) {
  if (appDir.endsWith('.app')) {
    return path.join(appDir, 'Contents', 'Resources')
  }
  if (fs.existsSync(path.join(appDir, 'Contents', 'Resources'))) {
    return path.join(appDir, 'Contents', 'Resources')
  }
  if (fs.existsSync(appDir)) {
    for (const name of fs.readdirSync(appDir)) {
      if (name.endsWith('.app')) {
        return path.join(appDir, name, 'Contents', 'Resources')
      }
    }
  }
  return path.join(appDir, 'resources')
}

const appDir = parseDirArg()
const resources = resolveResourcesDir(appDir)
const errors = []

function requireFile(full, label) {
  if (!fs.existsSync(full)) {
    errors.push(`缺少 ${label}: ${full}`)
    return null
  }
  return full
}

function forbidAsar(p, label) {
  if (String(p).includes('.asar')) {
    errors.push(`${label} 路径含 .asar，安装后 spawn 会失败: ${p}`)
  }
}

function spawnOk(exe, args, label) {
  forbidAsar(exe, label)
  const r = spawnSync(exe, args, { encoding: 'utf-8', timeout: 30000 })
  if (r.error) {
    errors.push(`${label} spawn 失败: ${r.error.message}`)
    return
  }
  if (r.status !== 0) {
    errors.push(`${label} 退出码 ${r.status}: ${(r.stderr || r.stdout || '').trim()}`)
  }
}

console.log(`校验打包产物: ${appDir}`)

if (!fs.existsSync(appDir)) {
  console.error(`目录不存在: ${appDir}`)
  process.exit(1)
}

const vendor = path.join(resources, 'vendor')
const backend = path.join(resources, 'backend')
const skills = path.join(resources, 'skills')

const python = isWin
  ? requireFile(path.join(vendor, 'python', 'python.exe'), 'Python 运行时')
  : requireFile(path.join(vendor, 'python', 'bin', 'python3'), 'Python 运行时')
    || requireFile(path.join(vendor, 'python', 'bin', 'python'), 'Python 运行时')

const claude = isWin
  ? requireFile(path.join(vendor, 'claude', 'claude.exe'), 'Claude CLI')
  : requireFile(path.join(vendor, 'claude', 'claude'), 'Claude CLI')

requireFile(path.join(backend, 'export_cli.py'), 'export_cli.py')
requireFile(path.join(skills, 'literary-writer', 'SKILL.md'), 'literary-writer Skill')
requireFile(path.join(skills, 'literary-writer', 'scripts', 'webnovel.py'), 'webnovel.py')

const asarPath = path.join(resources, 'app.asar')
if (fs.existsSync(asarPath)) {
  const list = spawnSync(process.execPath, [
    path.join(ROOT, 'node_modules', '@electron', 'asar', 'bin', 'asar.js'),
    'list',
    asarPath,
  ], { encoding: 'utf-8', cwd: ROOT })
  const out = (list.stdout || '').replace(/\\/g, '/')
  for (const rel of [
    'shared/cli-model-compat.js',
    'shared/cc-switch-claude-presets.json',
  ]) {
    if (!out.includes(rel)) {
      errors.push(`app.asar 缺少后端依赖: ${rel}`)
    }
  }
}

for (const p of [python, claude, path.join(backend, 'export_cli.py')]) {
  if (p) forbidAsar(p, '可执行资源')
}

if (python) {
  spawnOk(python, ['--version'], 'Python')
  spawnOk(python, ['-c', 'import mammoth, fitz, markdownify, docx, charset_normalizer'], 'Python 文档库')
}

if (claude) {
  spawnOk(claude, ['--version'], 'Claude CLI')
}

const badVendorInAsar = path.join(resources, 'app.asar.unpacked', 'electron', 'vendor', 'python', 'python.exe')
if (fs.existsSync(badVendorInAsar)) {
  console.warn('  ⚠ 仍存在 app.asar.unpacked/electron/vendor（旧布局），请确认 main.js 使用 resources/vendor')
}

function scanForBundledUserData(dir, label) {
  if (!fs.existsSync(dir)) return
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === 'projects' && full.replace(/\\/g, '/').includes('/data/projects')) {
          errors.push(`${label} 含用户项目目录（不应打进安装包）: ${full}`)
        }
        stack.push(full)
        continue
      }
      const lower = ent.name.toLowerCase()
      if (lower.endsWith('.db') || lower.endsWith('.db-wal') || lower.endsWith('.db-shm')) {
        errors.push(`${label} 含数据库文件（不应打进安装包）: ${full}`)
      }
      if (/^pytest-/i.test(ent.name) || ent.name === 'catalog-test') {
        errors.push(`${label} 含测试数据文件: ${full}`)
      }
    }
  }
}

scanForBundledUserData(resources, 'extraResources')
scanForBundledUserData(path.join(resources, 'app.asar.unpacked'), 'app.asar.unpacked')

if (errors.length) {
  console.error('\n❌ 打包产物校验失败:\n')
  for (const e of errors) console.error(`  • ${e}`)
  process.exit(1)
}

console.log('\n✅ 打包产物校验通过（extraResources 路径可 spawn，适用于纯净机器安装）')
