#!/usr/bin/env node
/**
 * DMG / Electron 后端全量冒烟验证
 * 用法: node scripts/verify-dmg-backend.mjs [port]
 */

const PORT = Number(process.argv[2] || process.env.STUDIO_PORT || 53950)
const BASE = `http://127.0.0.1:${PORT}/api`
const TIMEOUT_MS = 8000

const results = []

function record(name, ok, detail = '', ms = 0) {
  results.push({ name, ok, detail, ms })
  const mark = ok ? '✓' : '✗'
  const timing = ms ? ` (${ms}ms)` : ''
  console.log(`${mark} ${name}${timing}${detail ? ` — ${detail}` : ''}`)
}

async function req(method, path, { token, body, timeout = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  const start = Date.now()
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { /* plain */ }
    return { status: res.status, json, text, ms: Date.now() - start }
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  console.log(`\n文匠 Studio DMG 后端验证 — 127.0.0.1:${PORT}\n`)

  // 1. Health (no auth)
  let r = await req('GET', '/health', { timeout: 10000 })
  const health = r.json
  record(
    '健康检查 /api/health',
    r.status === 200 && health?.status === 'ok',
    health?.claude_code?.available
      ? `Claude ${health.claude_code.version}`
      : `Claude 不可用`,
    r.ms,
  )
  record(
    'HTTP API 模型',
    health?.api_model?.configured === true,
    health?.api_model?.available ? health.api_model.model : '未配置或不可用',
  )
  record(
    '推理运行时',
    Array.isArray(health?.runtime_providers) && health.runtime_providers.length > 0,
    (health?.runtime_providers || []).join(', '),
  )

  // 2. Auth
  r = await req('POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } })
  const token = r.json?.token
  record('登录 /api/auth/login', r.status === 200 && !!token, r.json?.user?.username || r.text?.slice(0, 80), r.ms)

  if (!token) {
    console.log('\n无法继续：登录失败\n')
    process.exit(1)
  }

  r = await req('GET', '/auth/me', { token })
  record('当前用户 /api/auth/me', r.status === 200 && r.json?.username, r.json?.role, r.ms)

  // 3. Core APIs
  const coreGets = [
    ['/projects', '项目列表'],
    ['/models', '模型配置'],
    ['/tools/overview', '工具总览'],
    ['/tools/skills', '技能列表'],
    ['/tools/default-skill', '默认技能'],
    ['/mcp/overview', 'MCP 总览'],
    ['/mcp/servers', 'MCP 服务器'],
    ['/usage', '用量统计'],
    ['/guestbook', '创作备忘录'],
    ['/export/formats', '导出格式'],
    ['/upload/formats', '上传格式'],
    ['/settings', '设置(legacy)'],
  ]

  for (const [path, label] of coreGets) {
    r = await req('GET', path, { token })
    const ok = r.status === 200 && r.json != null
    let detail = ''
    if (path === '/projects' && ok) detail = `${(r.json || []).length} 个项目`
    if (path === '/tools/overview' && ok) detail = `skills=${r.json?.skills?.installed ?? r.json?.installed_skills ?? '?'}`
    if (path === '/tools/skills' && ok) detail = `${(r.json?.skills || r.json || []).length} 个技能`
    record(label, ok, detail || (ok ? '' : `HTTP ${r.status}`), r.ms)
  }

  // 4. Pick first project for deep tests
  r = await req('GET', '/projects', { token })
  const projects = Array.isArray(r.json) ? r.json : []
  if (!projects.length) {
    record('项目深度验证', false, '无项目可测')
    printSummary()
    return
  }

  const project = projects[0]
  const pid = project.id
  record('测试项目', true, `${project.title} (${pid})`)

  const projectGets = [
    [`/projects/${pid}`, '项目详情'],
    [`/projects/${pid}/chapters`, '章节列表'],
    [`/projects/${pid}/sessions`, '会话列表'],
    [`/projects/${pid}/usage`, '项目用量'],
    [`/projects/${pid}/takeover`, '项目诊断'],
    [`/projects/${pid}/story/health`, '故事健康度'],
    [`/projects/${pid}/story/knowledge`, '知识库'],
    [`/projects/${pid}/story/plans`, '写作计划'],
    [`/projects/${pid}/story/tasks`, '任务列表'],
    [`/projects/${pid}/story/understanding`, '故事理解'],
    [`/projects/${pid}/story/verify`, '验收记录'],
    [`/projects/${pid}/measurement/health`, '测量健康度'],
    [`/projects/${pid}/measurement/review`, '审稿测量'],
    [`/projects/${pid}/versions`, '版本列表'],
    [`/projects/${pid}/story-engine/canon`, 'Canon 规则'],
    [`/projects/${pid}/story-engine/critic-reports`, '批评报告'],
    [`/projects/${pid}/story-engine/bible`, '故事圣经'],
    [`/projects/${pid}/story-engine/beats`, '节拍'],
    [`/projects/${pid}/skill/preflight`, 'Skill 预检'],
    [`/projects/${pid}/files/settings`, '设定文件列表'],
    [`/projects/${pid}/files/outline`, '大纲文件列表'],
  ]

  for (const [path, label] of projectGets) {
    r = await req('GET', path, { token, timeout: 15000 })
    const ok = r.status === 200
    let detail = ''
    if (path.endsWith('/chapters') && ok) detail = `${(r.json || []).length} 章`
    if (path.endsWith('/sessions') && ok) detail = `${(r.json || []).length} 会话`
    if (path.includes('/skill/preflight') && ok) detail = r.json?.ok === true ? '就绪' : (r.json?.issues?.[0] || r.json?.error || '有告警')
    record(label, ok, detail || (ok ? '' : `HTTP ${r.status} ${(r.json?.error || r.text || '').slice(0, 60)}`), r.ms)
  }

  // 5. Chapter read
  r = await req('GET', `/projects/${pid}/chapters`, { token })
  const chapters = Array.isArray(r.json) ? r.json : []
  if (chapters.length) {
    const ch = chapters[0]
    r = await req('GET', `/projects/${pid}/chapters/${encodeURIComponent(ch.filename)}`, { token })
    record('章节读取', r.status === 200 && typeof r.json?.content === 'string', ch.title, r.ms)

    r = await req('GET', `/projects/${pid}/search?q=${encodeURIComponent(ch.title?.slice(0, 4) || '王')}`, { token })
    record('全文搜索', r.status === 200, `${(r.json?.results || r.json || []).length ?? 0} 条`, r.ms)
  }

  // 6. Semantic critic availability (POST, may need model)
  r = await req('POST', `/projects/${pid}/story-engine/critic/llm`, {
    token,
    body: { unit_index: 0, dry_run: true },
    timeout: 12000,
  })
  const criticOk = r.status === 200 || r.status === 400
  const criticDetail = r.json?.error || r.json?.available != null
    ? String(r.json.error || (r.json.available ? '可用' : '不可用'))
    : `HTTP ${r.status}`
  record('语义审稿接口', criticOk, criticDetail.slice(0, 80), r.ms)

  // 7. Model test (quick)
  r = await req('GET', '/models', { token })
  const models = r.json?.models || r.json || []
  const active = models.find((m) => m.active) || models[0]
  if (active?.id) {
    r = await req('POST', `/models/${active.id}/test`, { token, timeout: 20000 })
    record('模型连通测试', r.status === 200 && r.json?.ok !== false, r.json?.message || r.json?.error || '', r.ms)
  }

  // 8. CC Switch import endpoint
  r = await req('GET', '/models/import/cc-switch', { token })
  record('CC Switch 导入', r.status === 200 || r.status === 400, r.json?.source || r.json?.error || '', r.ms)

  // 9. WebSocket handshake
  await testWebSocket(pid, token)

  printSummary()
}

function testWebSocket(projectId, token) {
  return new Promise((resolve) => {
    const start = Date.now()
    try {
      // Node 18+ global WebSocket
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${encodeURIComponent(token)}&projectId=${projectId}`)
      const timer = setTimeout(() => {
        ws.close()
        record('WebSocket 连接', false, '超时', Date.now() - start)
        resolve()
      }, 5000)
      ws.addEventListener('open', () => {
        clearTimeout(timer)
        record('WebSocket 连接', true, '已建立', Date.now() - start)
        ws.close()
        resolve()
      })
      ws.addEventListener('error', () => {
        clearTimeout(timer)
        record('WebSocket 连接', false, '连接失败', Date.now() - start)
        resolve()
      })
    } catch (err) {
      record('WebSocket 连接', false, err.message)
      resolve()
    }
  })
}

function printSummary() {
  const passed = results.filter((x) => x.ok).length
  const failed = results.filter((x) => !x.ok)
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`合计: ${passed}/${results.length} 通过`)
  if (failed.length) {
    console.log('\n未通过:')
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
    process.exit(1)
  }
  console.log('全部检查通过\n')
}

main().catch((err) => {
  console.error('验证脚本异常:', err)
  process.exit(1)
})
