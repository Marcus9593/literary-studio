#!/usr/bin/env node
/**
 * 编译打包前自检清单 — 在 electron-builder 之前运行，提前发现缺模块、版本不一致等问题。
 *
 * 用法:
 *   node scripts/prepack-checklist.mjs
 *   node scripts/prepack-checklist.mjs --platform win32
 *   node scripts/prepack-checklist.mjs --strict   # 要求 frontend/dist 已构建
 */
import { spawnSync } from 'child_process'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const picomatch = require('picomatch')

const strict = process.argv.includes('--strict')
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
const warnings = []
const passed = []

function fail(section, msg) {
  errors.push({ section, msg })
}

function warn(section, msg) {
  warnings.push({ section, msg })
}

function ok(section, msg) {
  passed.push({ section, msg })
}

function relPosix(full) {
  return path.relative(ROOT, full).replace(/\\/g, '/')
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
}

function requireFile(rel, section, label) {
  const full = path.join(ROOT, rel)
  if (!fs.existsSync(full)) {
    fail(section, `缺少 ${label}: ${rel}`)
    return false
  }
  ok(section, `${label} 存在 (${rel})`)
  return true
}

/** electron-builder build.files 是否会把该路径打进 app.asar */
function isIncludedInAsar(relPath, patterns) {
  const normalized = relPath.replace(/\\/g, '/')
  let included = false
  for (const pattern of patterns) {
    const negated = pattern.startsWith('!')
    const pat = negated ? pattern.slice(1) : pattern
    const matcher = picomatch(pat, { dot: true })
    if (matcher(normalized)) {
      included = !negated
    }
  }
  return included
}

function walkJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      walkJsFiles(full, out)
      continue
    }
    if (/\.(m?js|cjs)$/.test(ent.name)) out.push(full)
  }
  return out
}

const IMPORT_FROM_RE = /\bfrom\s+['"](\.\.[^'"]+)['"]/g

/** backend-node 运行时引用、但不在 backend-node 目录内的模块（须单独打进 asar） */
function collectExternalAsarDeps() {
  const backendRoot = path.join(ROOT, 'backend-node')
  const deps = new Map()

  for (const file of walkJsFiles(backendRoot)) {
    const content = fs.readFileSync(file, 'utf8')
    for (const m of content.matchAll(IMPORT_FROM_RE)) {
      const spec = m[1]
      let resolved = path.resolve(path.dirname(file), spec)
      if (!path.extname(resolved)) {
        for (const ext of ['.js', '.mjs', '.json']) {
          const candidate = resolved + ext
          if (fs.existsSync(candidate)) {
            resolved = candidate
            break
          }
        }
      }
      if (!resolved.startsWith(backendRoot + path.sep) && resolved.startsWith(ROOT + path.sep)) {
        deps.set(relPosix(resolved), relPosix(file))
      }
    }
  }

  // shared/ 内 JSON 等子依赖（如 cli-model-compat → cc-switch-claude-presets.json）
  const sharedRoot = path.join(ROOT, 'shared')
  if (fs.existsSync(sharedRoot)) {
    for (const file of walkJsFiles(sharedRoot)) {
      const content = fs.readFileSync(file, 'utf8')
      for (const m of content.matchAll(/\bfrom\s+['"](\.\/[^'"]+)['"]/g)) {
        let resolved = path.resolve(path.dirname(file), m[1])
        if (!path.extname(resolved)) resolved += '.json'
        if (fs.existsSync(resolved)) {
          deps.set(relPosix(resolved), relPosix(file))
        }
      }
    }
  }

  return deps
}

function checkVersionSync() {
  const section = '版本一致'
  const rootVer = readJson('package.json').version
  const frontendVer = readJson('frontend/package.json').version
  const backendVer = readJson('backend-node/package.json').version

  if (rootVer === frontendVer && rootVer === backendVer) {
    ok(section, `package.json 版本均为 ${rootVer}`)
  } else {
    fail(section, `版本不一致: 根=${rootVer}, frontend=${frontendVer}, backend-node=${backendVer}`)
  }

  const routesPath = path.join(ROOT, 'backend-node/routes/index.js')
  if (fs.existsSync(routesPath)) {
    const content = fs.readFileSync(routesPath, 'utf8')
    const healthMatch = content.match(/version:\s*['"]([^'"]+)['"]/g)
    if (healthMatch) {
      const versions = [...new Set(healthMatch.map((s) => s.match(/['"]([^'"]+)['"]/)[1]))]
      if (versions.length === 1 && versions[0] === rootVer) {
        ok(section, `health API 版本与 package.json 一致 (${rootVer})`)
      } else {
        fail(section, `health API 版本 (${versions.join(', ')}) 与 package.json (${rootVer}) 不一致`)
      }
    }
  }
}

function checkAsarCoverage() {
  const section = 'app.asar 清单'
  const buildFiles = readJson('package.json').build?.files
  if (!Array.isArray(buildFiles)) {
    fail(section, 'package.json 缺少 build.files 配置')
    return
  }

  const requiredAsar = [
    'package.json',
    'electron/main.js',
    'frontend/dist/index.html',
    'shared/cli-model-compat.js',
    'shared/cc-switch-claude-presets.json',
    'backend-node/routes/index.js',
  ]

  for (const rel of requiredAsar) {
    if (!fs.existsSync(path.join(ROOT, rel))) {
      fail(section, `关键文件不存在: ${rel}`)
      continue
    }
    if (!isIncludedInAsar(rel, buildFiles)) {
      fail(section, `${rel} 未包含在 build.files，安装后可能 ERR_MODULE_NOT_FOUND`)
    } else {
      ok(section, `build.files 已覆盖 ${rel}`)
    }
  }

  const externalDeps = collectExternalAsarDeps()
  for (const [dep, importedBy] of externalDeps) {
    if (!fs.existsSync(path.join(ROOT, dep))) {
      fail(section, `${importedBy} 引用的文件不存在: ${dep}`)
      continue
    }
    if (!isIncludedInAsar(dep, buildFiles)) {
      fail(section, `${importedBy} 引用 ${dep}，但 build.files 未将其打入 app.asar`)
    } else {
      ok(section, `外部引用已纳入 asar: ${dep}`)
    }
  }
}

function checkExtraResources() {
  const section = 'extraResources'
  const pkg = readJson('package.json')
  const extras = pkg.build?.extraResources
  if (!Array.isArray(extras)) {
    fail(section, 'package.json 缺少 build.extraResources')
    return
  }

  const required = [
    { from: 'skills', files: ['literary-writer/SKILL.md', 'literary-writer/scripts/webnovel.py'] },
    { from: 'backend', files: ['export_cli.py'] },
    { from: 'electron/vendor', files: [] },
  ]

  for (const { from, files } of required) {
    if (!requireFile(from, section, `源目录 ${from}`)) continue
    for (const f of files) {
      requireFile(path.join(from, f).replace(/\\/g, '/'), section, f)
    }
  }

  const hasVendor = extras.some((e) => (typeof e === 'string' ? e : e.from) === 'electron/vendor'
    || (typeof e === 'object' && e.from === 'electron/vendor'))
  if (hasVendor) {
    ok(section, 'extraResources 含 electron/vendor → vendor')
  } else {
    fail(section, 'extraResources 未配置 electron/vendor')
  }

  if (platform === 'win32') {
    requireFile('electron/vendor/python/python.exe', section, 'Python 运行时')
    requireFile('electron/vendor/claude/claude.exe', section, 'Claude CLI')
  } else if (platform === 'darwin' || platform === 'linux') {
    const py = fs.existsSync(path.join(ROOT, 'electron/vendor/python/bin/python3'))
      ? 'electron/vendor/python/bin/python3'
      : 'electron/vendor/python/bin/python'
    requireFile(py, section, 'Python 运行时')
    requireFile('electron/vendor/claude/claude', section, 'Claude CLI')
  }
}

function checkFrontendDist() {
  const section = '前端产物'
  const indexHtml = 'frontend/dist/index.html'
  if (!fs.existsSync(path.join(ROOT, indexHtml))) {
    if (strict) {
      fail(section, 'frontend/dist 未构建，请先运行 npm run frontend:build')
    } else {
      warn(section, 'frontend/dist 不存在，构建流程会在打包时自动构建；若跳过构建步骤会安装空白界面')
    }
    return
  }

  const stat = fs.statSync(path.join(ROOT, indexHtml))
  ok(section, `frontend/dist 已存在 (${stat.mtime.toISOString().slice(0, 10)})`)

  const assetsDir = path.join(ROOT, 'frontend/dist/assets')
  if (!fs.existsSync(assetsDir) || !fs.readdirSync(assetsDir).length) {
    fail(section, 'frontend/dist/assets 为空，前端构建可能不完整')
  }
}

function checkIcons() {
  const section = '应用图标'
  if (platform === 'win32') {
    const ico = path.join(ROOT, 'electron/icons/icon.ico')
    if (!fs.existsSync(ico)) {
      warn(section, '缺少 electron/icons/icon.ico，将使用 Electron 默认图标')
      return
    }
    const size = fs.statSync(ico).size
    if (size < 8 * 1024) {
      warn(section, `icon.ico 仅 ${size} 字节，可能分辨率过低；建议运行 python3 scripts/build-app-icon.py`)
    } else {
      ok(section, `icon.ico 已就绪 (${Math.round(size / 1024)} KB)`)
    }
  } else if (platform === 'darwin') {
    if (fs.existsSync(path.join(ROOT, 'electron/icons/icon.icns'))) {
      ok(section, 'icon.icns 已就绪')
    } else {
      warn(section, '缺少 electron/icons/icon.icns')
    }
  }
}

function checkForbiddenBundleContent() {
  const section = '禁止打入包'
  const forbidden = [
    'data/studio.db',
    'backend-node/data/studio.db',
  ]
  for (const rel of forbidden) {
    const full = path.join(ROOT, rel)
    if (fs.existsSync(full)) {
      warn(section, `${rel} 仍存在；打包前 clean 会清理，若跳过 clean 可能把开发数据库打进安装包`)
    }
  }
  ok(section, '未检测到必须立即中止的打包污染（clean 步骤会再次清理 data/）')
}

function checkDevServerConflict() {
  const section = '运行环境'
  const portCheck = spawnSync('netstat', ['-ano'], { encoding: 'utf-8' })
  const out = portCheck.stdout || ''
  if (out.includes(':8765')) {
    warn(section, '8765 端口占用中（可能是 npm start）；打包前 clean 会尝试结束进程，studio.db 可能被锁定')
  } else {
    ok(section, '8765 端口空闲')
  }
}

function checkVendor() {
  const section = 'vendor 依赖'
  const platformFlag = `--platform ${platform}`
  const r = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts/validate-electron-vendor.mjs'),
    platformFlag,
  ], { encoding: 'utf-8', cwd: ROOT })
  if (r.status === 0) {
    ok(section, 'validate-electron-vendor 通过')
  } else {
    const detail = (r.stderr || r.stdout || '').trim().split('\n').slice(-5).join('\n')
    fail(section, `vendor 校验失败，请运行 node scripts/bundle-deps.mjs\n${detail}`)
  }
}

console.log('╔══════════════════════════════════════╗')
console.log('║   文匠 Studio — 打包前自检清单       ║')
console.log('╚══════════════════════════════════════╝')
console.log(`平台: ${platform}${strict ? ' | 严格模式' : ''}\n`)

checkVersionSync()
checkAsarCoverage()
checkExtraResources()
checkFrontendDist()
checkIcons()
checkForbiddenBundleContent()
checkDevServerConflict()
checkVendor()

const sections = [...new Set([
  ...passed.map((p) => p.section),
  ...warnings.map((w) => w.section),
  ...errors.map((e) => e.section),
])]

for (const section of sections) {
  console.log(`\n── ${section} ──`)
  for (const p of passed.filter((x) => x.section === section)) {
    console.log(`  ✓ ${p.msg}`)
  }
  for (const w of warnings.filter((x) => x.section === section)) {
    console.log(`  ⚠ ${w.msg}`)
  }
  for (const e of errors.filter((x) => x.section === section)) {
    console.log(`  ✗ ${e.msg}`)
  }
}

console.log('\n────────────────────────────────────')
console.log(`通过 ${passed.length} 项 | 警告 ${warnings.length} 项 | 失败 ${errors.length} 项`)

if (errors.length) {
  console.error('\n❌ 打包前自检未通过，请修复后再运行 electron:build')
  process.exit(1)
}

if (warnings.length) {
  console.log('\n⚠️  存在警告，可继续打包但建议先处理')
} else {
  console.log('\n✅ 打包前自检全部通过，可以开始 electron:build')
}
