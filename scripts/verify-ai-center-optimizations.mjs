#!/usr/bin/env node
/**
 * 验证 AI 中心 P0–P3 优化项（单元 + 静态 + API 集成）
 * 用法: node scripts/verify-ai-center-optimizations.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const BACKEND = path.join(ROOT, 'backend-node');

let passed = 0;
let failed = 0;

function ok(name, detail = '') {
  passed += 1;
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(name, cond, detail = '') {
  if (cond) ok(name, detail);
  else fail(name, detail || 'assertion failed');
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf-8');
}

function safeRmDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch (err) {
    console.warn(`  ⚠ 无法删除临时目录 ${dir}: ${err.message}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function importWithData(dataDir, modulePath) {
  process.env.LITERARY_STUDIO_DATA = dataDir;
  const url = pathToFileURL(modulePath).href;
  return import(`${url}?t=${Date.now()}`);
}

async function api(base, token, method, pathname, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

async function waitForHealth(base, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await sleep(300);
  }
  return false;
}

function startServer(dataDir, port) {
  return spawn('node', ['server.js'], {
    cwd: BACKEND,
    env: {
      ...process.env,
      LITERARY_STUDIO_DATA: dataDir,
      PORT: String(port),
      STUDIO_HOST: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// ── 1. shared/cli-model-compat ──
async function testSharedCompat() {
  console.log('\n[1] shared/cli-model-compat');
  const mod = await import(pathToFileURL(path.join(ROOT, 'shared/cli-model-compat.js')).href);

  const openaiCompat = mod.assessClaudeCliCompatibility({
    name: 'OpenAI test',
    protocol: 'openai',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  });
  assert('P0 OpenAI 协议 cli_ready=false', openaiCompat.cli_ready === false, JSON.stringify(openaiCompat.severity));

  const anthropicCompat = mod.assessClaudeCliCompatibility({
    name: 'DeepSeek',
    protocol: 'anthropic',
    base_url: 'https://api.deepseek.com/anthropic',
    model: 'deepseek-chat',
  });
  assert('Anthropic 兼容 cli_ready=true', anthropicCompat.cli_ready === true);

  const icon = mod.resolveProviderIconForModel({
    base_url: 'https://api.deepseek.com/anthropic',
  });
  assert('P3 resolveProviderIconForModel 返回 icon', typeof icon === 'string' && icon.length > 0, icon || 'null');

  const presets = mod.listCliPresetTemplates();
  assert('预设 templates 非空', Array.isArray(presets) && presets.length > 0, `${presets.length} 项`);

  const catalog = mod.getCcSwitchPresetCatalogMeta();
  assert('预设 catalog meta 存在', catalog && typeof catalog.version !== 'undefined');
}

// ── 2. settings storage (cli_compat + icon) ──
async function testSettingsStorage() {
  console.log('\n[2] backend storage/settings');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-verify-settings-'));
  try {
    const settings = await importWithData(dataDir, path.join(BACKEND, 'storage/settings.js'));

    const created = settings.createModel({
      name: 'Test Anthropic',
      protocol: 'anthropic',
      base_url: 'https://api.deepseek.com/anthropic',
      model: 'deepseek-chat',
      api_key: 'sk-test-key-12345678',
    });
    assert('createModel 成功', created?.id);

    const listed = settings.listModelsPublic();
    const pub = listed.models.find((m) => m.id === created.id);
    assert('P0 listModels 含 cli_compat', pub?.cli_compat && typeof pub.cli_compat.cli_ready === 'boolean');
    assert('P3 listModels 含 icon 字段', 'icon' in pub, String(pub.icon));

    const openai = settings.createModel({
      name: 'Test OpenAI',
      protocol: 'openai',
      base_url: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      api_key: 'sk-openai-test-key-99',
    });
    const openaiPub = settings.listModelsPublic().models.find((m) => m.id === openai.id);
    assert('OpenAI 模型 cli_ready=false', openaiPub?.cli_compat?.cli_ready === false);

    const deleted = settings.deleteModel(openai.id);
    assert('P0 deleteModel 返回 active_id', deleted?.status === 'deleted' && deleted.active_id);
  } finally {
    safeRmDir(dataDir);
  }
}

// ── 3. token usage by_project ──
async function testTokenUsage() {
  console.log('\n[3] ai-runtime/token-usage');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-verify-usage-'));
  try {
    const usage = await importWithData(dataDir, path.join(BACKEND, 'ai-runtime/token-usage.js'));
    usage.recordTokenUsage({
      projectId: 'proj-verify-001',
      kind: 'chat',
      promptText: '你好世界',
      responseText: '回复内容',
    });
    const summary = usage.getUsageSummary();
    assert('P2 usage.by_project 有项目记录', summary.by_project?.['proj-verify-001']?.requests >= 1);
    assert('usage.by_kind 有 chat', summary.by_kind?.chat?.requests >= 1);
  } finally {
    safeRmDir(dataDir);
  }
}

// ── 4. runtime mode ──
async function testRuntimeMode() {
  console.log('\n[4] ai-runtime/runtime');
  const runtime = await import(pathToFileURL(path.join(BACKEND, 'ai-runtime/runtime.js')).href);
  const mode = runtime.getActiveInferenceMode();
  const mode = runtime.getActiveInferenceMode();
  assert('getActiveInferenceMode 返回 mode', typeof mode.mode === 'string', mode.mode);
  assert('usesHttpRuntime 恒 false（CLI 优先）', runtime.usesHttpRuntime(null) === false);
  assert(
    'supportsHttpFallback DeepSeek 可用',
    runtime.supportsHttpFallback({
      api_key: 'k',
      base_url: 'https://api.deepseek.com/anthropic',
      model: 'deepseek-chat',
      protocol: 'anthropic',
    }) === true,
  );
  assert(
    'supportsHttpFallback 官方 Anthropic 不可用',
    runtime.supportsHttpFallback({
      api_key: 'k',
      base_url: 'https://api.anthropic.com',
      model: 'claude-sonnet-4',
      protocol: 'anthropic',
    }) === false,
  );
}

// ── 5. frontend static ──
function testFrontendStatic() {
  console.log('\n[5] frontend 静态检查');

  const app = read('frontend/src/App.jsx');
  assert('P2 /ai/* 404 重定向', app.includes('<Route path="*" element={<Navigate to="/ai" replace />} />'));
  assert('旧 /settings 重定向 AI 中心', app.includes('<Route path="/settings" element={<Navigate to="/ai/models"'));

  const models = read('frontend/src/features/ai-center/panels/AiModelsPanel.jsx');
  assert('P0 激活按钮 cli_ready 禁用', models.includes('item.cli_compat?.cli_ready === false'));
  assert('P0 notifyStudioHealthChanged 保存/激活/删除', models.includes("notifyStudioHealthChanged({ source: 'models-save' })"));
  assert('P2 listCcSwitchPresets API', models.includes('listCcSwitchPresets()'));
  assert('P2 projectUsage by_project', models.includes('usageData?.by_project'));
  assert('P3 ProviderLogo 模型卡片', models.includes('className="model-card-logo"'));

  const overview = read('frontend/src/features/ai-center/panels/AiOverviewPanel.jsx');
  assert('P1 非 HTTP 降级文案', overview.includes('非 HTTP 降级'));
  assert('P1 语义审稿 HTTP 区块', overview.includes('语义审稿等 · HTTP API'));
  assert('P3 CLI 凭据说明', overview.includes('ai-overview-cred-note'));

  const discover = read('frontend/src/features/ai-center/panels/AiDiscoverPanel.jsx');
  assert('P2 Skills admin 门槛', discover.includes('DiscoverAdminNotice') && discover.includes('!isAdmin'));

  const mcpDiscover = read('frontend/src/features/ai-center/panels/AiMcpDiscoverSection.jsx');
  assert('P3 MCP 共用 DiscoverLayout', mcpDiscover.includes("from '../components/DiscoverLayout.jsx'"));
  assert('P3 MCP admin 门槛', mcpDiscover.includes('DiscoverAdminNotice') && mcpDiscover.includes('!isAdmin'));

  const layout = read('frontend/src/features/ai-center/components/DiscoverLayout.jsx');
  assert('DiscoverLayout 导出 DiscoverCard', layout.includes('export function DiscoverCard'));

  const chat = read('frontend/src/components/ChatPanel.jsx');
  assert('P0 ChatPanel 监听 health 事件', chat.includes('onStudioHealthChanged'));

  const home = read('frontend/src/pages/HomePage.jsx');
  assert('P0 HomePage 监听 health 事件', home.includes('onStudioHealthChanged'));

  const css = read('frontend/src/index.css');
  assert('CSS ai-admin-notice', css.includes('.ai-admin-notice'));
  assert('CSS ai-usage-by-project', css.includes('.ai-usage-by-project'));
  assert('CSS model-card-logo', css.includes('.model-card-logo'));
}

// ── 6. API 集成 ──
async function testApiIntegration() {
  console.log('\n[6] API 集成（临时 data 目录 + 本地 server）');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-verify-api-'));
  const port = 18765 + Math.floor(Math.random() * 200);
  const base = `http://127.0.0.1:${port}/api`;
  let child = null;

  try {
    child = startServer(dataDir, port);
    const ready = await waitForHealth(base);
    assert('后端 /health 就绪', ready);
    if (!ready) return;

    const login = await api(base, null, 'POST', '/auth/login', {
      username: 'admin',
      password: 'admin123',
    });
    assert('admin 登录', login.status === 200 && login.json?.token);
    const adminToken = login.json?.token;
    if (!adminToken) return;

    const anthropic = await api(base, adminToken, 'POST', '/models', {
      name: 'Verify Anthropic',
      protocol: 'anthropic',
      base_url: 'https://api.deepseek.com/anthropic',
      model: 'deepseek-chat',
      api_key: 'sk-verify-anthropic-key',
    });
    assert('创建 Anthropic 模型', anthropic.status === 200 && anthropic.json?.id);

    const openai = await api(base, adminToken, 'POST', '/models', {
      name: 'Verify OpenAI',
      protocol: 'openai',
      base_url: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      api_key: 'sk-verify-openai-key',
    });
    assert('创建 OpenAI 模型', openai.status === 200 && openai.json?.id);
    const openaiId = openai.json?.id;
    const anthropicId = anthropic.json?.id;

    const list = await api(base, adminToken, 'GET', '/models');
    const openaiRow = list.json?.models?.find((m) => m.id === openaiId);
    const anthropicRow = list.json?.models?.find((m) => m.id === anthropicId);
    assert('GET /models 含 cli_compat', openaiRow?.cli_compat && anthropicRow?.cli_compat);
    assert('GET /models OpenAI cli_ready=false', openaiRow?.cli_compat?.cli_ready === false);
    assert('GET /models 含 icon', 'icon' in (anthropicRow || {}));

    const activateOpenai = await api(base, adminToken, 'POST', `/models/${openaiId}/activate`);
    assert('P0 禁止激活 OpenAI 模型', activateOpenai.status === 400 && activateOpenai.json?.cli_compat);

    const activateAnthropic = await api(base, adminToken, 'POST', `/models/${anthropicId}/activate`);
    assert('激活 Anthropic 模型成功', activateAnthropic.status === 200);
    assert('P0 激活后 claude_settings_sync', 'claude_settings_sync' in (activateAnthropic.json || {}));

    const health = await api(base, adminToken, 'GET', '/health');
    assert('P0 /health 含 cli_compat', health.json?.cli_compat != null);

    const del = await api(base, adminToken, 'DELETE', `/models/${openaiId}`);
    assert('P0 DELETE 模型成功', del.status === 200);
    assert('P0 DELETE 含 claude_settings_sync', 'claude_settings_sync' in (del.json || {}));

    const putSettings = await api(base, adminToken, 'PUT', '/settings', {
      protocol: 'anthropic',
      base_url: 'https://api.deepseek.com/anthropic',
      model: 'deepseek-chat',
    });
    assert('P1 PUT /settings 成功', putSettings.status === 200);
    assert('P1 PUT /settings 含 claude_settings_sync', 'claude_settings_sync' in (putSettings.json || {}));

    const presets = await api(base, adminToken, 'GET', '/models/presets/cc-switch');
    assert('P2 GET /models/presets/cc-switch', presets.status === 200);
    assert('P2 presets 含 templates', Array.isArray(presets.json?.templates) && presets.json.templates.length > 0);

    const usageMod = await importWithData(dataDir, path.join(BACKEND, 'ai-runtime/token-usage.js'));
    usageMod.recordTokenUsage({
      projectId: 'api-proj-test',
      kind: 'verify',
      promptText: 'test',
      responseText: 'ok',
    });
    const usage = await api(base, adminToken, 'GET', '/usage');
    assert('P2 GET /usage 含 by_project', usage.json?.by_project?.['api-proj-test']);

    const reg = await api(base, null, 'POST', '/auth/register', {
      username: `verify_user_${Date.now()}`,
      password: 'testpass99',
    });
    const userToken = reg.json?.token;
    assert('注册普通用户', reg.status === 201 && userToken);

    const installDenied = await api(base, userToken, 'POST', '/tools/skills/install', {
      source: 'test/skill',
      target: 'claude',
    });
    assert('P2 Skills 安装需 admin (403)', installDenied.status === 403);

    const catalogueDenied = await api(base, userToken, 'POST', '/tools/skills/catalogue/update');
    assert('P2 Skills 同步需 admin (403)', catalogueDenied.status === 403);

    const mcpSearch = await api(base, adminToken, 'GET', '/mcp/registry/search?q=filesystem&limit=5');
    assert('MCP Registry 搜索', mcpSearch.status === 200 && Array.isArray(mcpSearch.json?.items));
  } finally {
    if (child) {
      child.kill('SIGTERM');
      await sleep(400);
      if (!child.killed) child.kill('SIGKILL');
    }
    safeRmDir(dataDir);
  }
}

// ── 7. frontend build ──
async function testFrontendBuild() {
  console.log('\n[7] frontend production build');
  const distIndex = path.join(FRONTEND, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    fail('dist/index.html 存在', '请先 npm run build --prefix frontend');
    return;
  }
  ok('dist/index.html 存在');
  const assetsDir = path.join(FRONTEND, 'dist', 'assets');
  const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  assert('dist 含打包 JS', jsFiles.length > 0, jsFiles[0]);
  const bundle = fs.readFileSync(path.join(assetsDir, jsFiles[0]), 'utf-8');
  assert('bundle 含 AI 中心路由', bundle.includes('/ai') || bundle.includes('ai-center'));
  assert('bundle 含 DiscoverLayout', bundle.includes('DiscoverCard') || bundle.includes('tools-discover-hero'));
}

async function main() {
  console.log('=== AI 中心优化验证 ===');
  console.log(`项目: ${ROOT}`);

  await testSharedCompat();
  await testSettingsStorage();
  await testTokenUsage();
  await testRuntimeMode();
  testFrontendStatic();
  await testApiIntegration();
  await testFrontendBuild();

  console.log('\n=== 结果 ===');
  console.log(`通过: ${passed}  失败: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
