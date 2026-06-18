#!/usr/bin/env node
/**
 * 从 CC Switch 同步供应商图标 → frontend/public/provider-icons/
 * 读取 shared/cc-switch-claude-presets.json 中的 icon 字段。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PRESETS_JSON = path.join(ROOT, 'shared', 'cc-switch-claude-presets.json')
const OUT_DIR = path.join(ROOT, 'frontend', 'public', 'provider-icons')
const MANIFEST = path.join(ROOT, 'shared', 'provider-icons-manifest.json')
const ICON_BASE =
  'https://raw.githubusercontent.com/farion1231/cc-switch/main/src/icons/extracted'

/** CC Switch 图标 id → 实际文件名（与 extracted 目录一致） */
const FILE_OVERRIDES = {
  claudeapi: 'ClaudeApi.png',
  apinebula: 'apinebula_icon.png',
  atlascloud: 'atlascloud_icon.png',
  aihubmix: 'aihubmix-color.svg',
  modelscope: 'modelscope-color.svg',
  longcat: 'longcat-color.svg',
  opencode: 'opencode-logo-light.svg',
  github: 'githubcopilot.svg',
  openai: 'openai.svg',
  gemini: 'gemini.svg',
  nvidia: 'nvidia.svg',
  novita: 'novita.svg',
  doubao: 'doubao.svg',
  baidu: 'baidu.svg',
  bailian: 'bailian.svg',
  zhipu: 'zhipu.svg',
  kimi: 'kimi.svg',
  deepseek: 'deepseek.svg',
  minimax: 'minimax.svg',
  siliconflow: 'siliconflow.svg',
  stepfun: 'stepfun.svg',
  openrouter: 'openrouter.svg',
  xiaomimimo: 'xiaomimimo.svg',
  aws: 'aws.svg',
  anthropic: 'anthropic.svg',
  claude: 'claude.svg',
}

const CANDIDATE_SUFFIXES = ['.svg', '.png', '.jpg', '.jpeg', '.webp']

function candidateFiles(iconId) {
  const key = String(iconId || '').trim().toLowerCase()
  if (!key) return []
  const set = new Set()
  if (FILE_OVERRIDES[key]) set.add(FILE_OVERRIDES[key])
  for (const ext of CANDIDATE_SUFFIXES) {
    set.add(`${key}${ext}`)
    set.add(`${key}_icon${ext}`)
  }
  // 原样大小写变体（如 ClaudeApi.png）
  if (FILE_OVERRIDES[key]) set.add(FILE_OVERRIDES[key])
  return [...set]
}

async function tryDownload(filename) {
  const url = `${ICON_BASE}/${filename}`
  const res = await fetch(url)
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 32) return null
  return { filename, buf }
}

async function resolveIconFile(iconId) {
  for (const name of candidateFiles(iconId)) {
    const hit = await tryDownload(name)
    if (hit) return hit
  }
  return null
}

async function main() {
  if (!fs.existsSync(PRESETS_JSON)) {
    throw new Error('请先运行 node scripts/sync-cc-switch-presets.mjs')
  }
  const catalog = JSON.parse(fs.readFileSync(PRESETS_JSON, 'utf8'))
  const iconIds = [...new Set(
    (catalog.presets || [])
      .map((p) => p.icon)
      .filter(Boolean),
  )]

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const manifest = {}
  let ok = 0
  let miss = 0

  for (const iconId of iconIds) {
    const hit = await resolveIconFile(iconId)
    if (!hit) {
      miss += 1
      console.warn(`  ⚠ 未找到图标: ${iconId}`)
      continue
    }
    const dest = path.join(OUT_DIR, hit.filename)
    fs.writeFileSync(dest, hit.buf)
    manifest[iconId] = {
      file: hit.filename,
      url: `/provider-icons/${hit.filename}`,
    }
    ok += 1
  }

  fs.writeFileSync(
    MANIFEST,
    `${JSON.stringify({ source: ICON_BASE, synced_at: new Date().toISOString(), icons: manifest }, null, 2)}\n`,
    'utf8',
  )

  console.log(`图标同步完成: ${ok} 成功, ${miss} 缺失 → ${path.relative(ROOT, OUT_DIR)}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
