#!/usr/bin/env node
/**
 * 从 CC Switch 官方仓库同步 Claude 供应商预设 → shared/cc-switch-claude-presets.json
 *
 * 来源: https://github.com/farion1231/cc-switch/blob/main/src/config/claudeProviderPresets.ts
 *
 * 用法:
 *   node scripts/sync-cc-switch-presets.mjs
 *   node scripts/sync-cc-switch-presets.mjs --check   # 仅对比，不写入
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'shared', 'cc-switch-claude-presets.json')
const SOURCE_URL =
  'https://raw.githubusercontent.com/farion1231/cc-switch/main/src/config/claudeProviderPresets.ts'

function extractHost(baseUrl) {
  if (!baseUrl) return ''
  try {
    const raw = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function parsePresetsFromTs(ts) {
  const start = ts.indexOf('export const providerPresets')
  if (start < 0) throw new Error('未找到 providerPresets 数组')
  const arrayStart = ts.indexOf('[', start)
  const arrayEnd = ts.lastIndexOf('];')
  const body = ts.slice(arrayStart + 1, arrayEnd)

  const presets = []
  let depth = 0
  let blockStart = -1

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (ch === '{') {
      if (depth === 0) blockStart = i
      depth += 1
    } else if (ch === '}') {
      depth -= 1
      if (depth === 0 && blockStart >= 0) {
        presets.push(body.slice(blockStart, i + 1))
        blockStart = -1
      }
    }
  }

  return presets.map(parsePresetBlock).filter(Boolean)
}

function pickString(block, key) {
  const re = new RegExp(`${key}:\\s*"([^"]*)"`)
  const m = block.match(re)
  return m ? m[1] : ''
}

function pickBool(block, key) {
  const re = new RegExp(`${key}:\\s*(true|false)`)
  const m = block.match(re)
  return m ? m[1] === 'true' : false
}

function pickEnv(block, envKey) {
  const re = new RegExp(`${envKey}:\\s*"([^"]*)"`)
  const m = block.match(re)
  return m ? m[1] : ''
}

function parsePresetBlock(block) {
  const name = pickString(block, 'name')
  if (!name) return null

  const websiteUrl = pickString(block, 'websiteUrl')
  const apiKeyUrl = pickString(block, 'apiKeyUrl')
  const apiFormat = pickString(block, 'apiFormat') || 'anthropic'
  const requiresOAuth = pickBool(block, 'requiresOAuth')
  const hidden = pickBool(block, 'hidden')
  const category = pickString(block, 'category')
  const isOfficial = pickBool(block, 'isOfficial')
  const icon = pickString(block, 'icon')

  const baseUrl =
    pickEnv(block, 'ANTHROPIC_BASE_URL')
    || pickEnv(block, 'OPENAI_BASE_URL')
    || null

  const defaultModel =
    pickEnv(block, 'ANTHROPIC_MODEL')
    || pickEnv(block, 'OPENAI_MODEL')
    || ''

  const hosts = baseUrl && !baseUrl.includes('${')
    ? [extractHost(baseUrl)].filter(Boolean)
    : []

  const hasTemplateVar = baseUrl && baseUrl.includes('${')
  const cliReady =
    !hidden
    && !requiresOAuth
    && !hasTemplateVar
    && apiFormat === 'anthropic'
    && Boolean(baseUrl)

  return {
    name,
    icon: icon || null,
    hosts,
    base_url: baseUrl || null,
    default_model: defaultModel || null,
    website_url: websiteUrl || null,
    api_key_url: apiKeyUrl || websiteUrl || null,
    apiFormat,
    oauth: requiresOAuth || (isOfficial && !baseUrl),
    category: category || null,
    hidden,
    cli_ready: cliReady,
  }
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  console.log(`拉取 CC Switch 预设: ${SOURCE_URL}`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ts = await res.text()
  const presets = parsePresetsFromTs(ts)
  const cliReady = presets.filter((p) => p.cli_ready)

  const payload = {
    version: 'cc-switch-claude-presets',
    source: 'farion1231/cc-switch',
    source_file: 'src/config/claudeProviderPresets.ts',
    synced_at: new Date().toISOString(),
    preset_count: presets.length,
    cli_ready_count: cliReady.length,
    presets,
  }

  console.log(`解析 ${presets.length} 个预设，其中 ${cliReady.length} 个可用于 Claude CLI（Anthropic + 固定 Base URL）`)

  if (checkOnly) {
    const existing = fs.existsSync(OUT)
      ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
      : null
    const oldCount = existing?.presets?.length ?? 0
    console.log(`本地文件: ${oldCount} 个 → 远程: ${presets.length} 个`)
    return
  }

  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`已写入 ${path.relative(ROOT, OUT)}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
