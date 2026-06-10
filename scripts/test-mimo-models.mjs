#!/usr/bin/env node
/**
 * MiMo model API integration test suite (QA-style).
 * Usage:
 *   BASE_URL=http://127.0.0.1:8765 \
 *   MIMO_API_KEY=tp-xxx \
 *   ADMIN_PASSWORD=xxx \
 *   node scripts/test-mimo-models.mjs
 */
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const MIMO_BASE = process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1';
const MIMO_KEY = process.env.MIMO_API_KEY || '';
const MIMO_MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.STUDIO_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123';

const results = [];

function mask(s) {
  const t = String(s || '');
  return t.length > 8 ? `${t.slice(0, 4)}…${t.slice(-4)}` : '****';
}

async function req(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = { _raw: await res.text() };
  }
  return { status: res.status, ok: res.ok, data };
}

function record(id, name, pass, detail = '') {
  results.push({ id, name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login() {
  const { status, data } = await req('/auth/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  if (status !== 200 || !data?.token) {
    throw new Error(`登录失败: ${status} ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function directMimoChat() {
  const res = await fetch(`${MIMO_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MIMO_KEY}`,
    },
    body: JSON.stringify({
      model: MIMO_MODEL,
      max_tokens: 32,
      messages: [
        { role: 'system', content: '你是助手。' },
        { role: 'user', content: '只回复 OK' },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  if (!MIMO_KEY) {
    console.error('请设置 MIMO_API_KEY');
    process.exit(1);
  }

  console.log(`\n=== MiMo 模型功能测试 ===`);
  console.log(`Studio: ${BASE}`);
  console.log(`MiMo:   ${MIMO_BASE}`);
  console.log(`Key:    ${mask(MIMO_KEY)}\n`);

  let token;
  try {
    token = await login();
    record('TC-00', '管理员登录', true, `token ${mask(token)}`);
  } catch (e) {
    record('TC-00', '管理员登录', false, e.message);
    summarize();
    process.exit(1);
  }

  // TC-01 未认证访问
  {
    const { status } = await req('/models', { method: 'POST', body: { name: 'x' } });
    record('TC-01', '未登录创建模型应拒绝', status === 401, `status=${status}`);
  }

  // TC-02 直连 MiMo API（绕过 Studio）
  {
    try {
      const { status, data } = await directMimoChat();
      const text = data?.choices?.[0]?.message?.content || '';
      record('TC-02', '直连 MiMo OpenAI 兼容 API', status === 200 && !!text, `status=${status} reply=${String(text).slice(0, 40)}`);
    } catch (e) {
      record('TC-02', '直连 MiMo OpenAI 兼容 API', false, e.message);
    }
  }

  // TC-03 保存前测试连接（不落库）
  {
    const { status, data } = await req('/models/test', {
      method: 'POST',
      token,
      body: {
        protocol: 'openai',
        base_url: MIMO_BASE,
        model: MIMO_MODEL,
        api_key: MIMO_KEY,
      },
    });
    record('TC-03', '保存前测试连接 POST /models/test', status === 200 && data?.ok, `status=${status} preview=${data?.reply_preview || data?.error || ''}`);
  }

  // TC-04 非法：空 API Key
  {
    const { status, data } = await req('/models', {
      method: 'POST',
      token,
      body: {
        name: 'MiMo-无效',
        protocol: 'openai',
        base_url: MIMO_BASE,
        model: MIMO_MODEL,
        api_key: '',
      },
    });
    record('TC-04', '创建模型空 API Key 应失败', status === 400, `status=${status} err=${data?.error || ''}`);
  }

  // TC-05 非法：空 Base URL
  {
    const { status, data } = await req('/models', {
      method: 'POST',
      token,
      body: {
        name: 'MiMo-无效',
        protocol: 'openai',
        base_url: '',
        model: MIMO_MODEL,
        api_key: MIMO_KEY,
      },
    });
    record('TC-05', '创建模型空 Base URL 应失败', status === 400, `status=${status} err=${data?.error || ''}`);
  }

  // TC-06 非法：错误 API Key 测试
  {
    const { status, data } = await req('/models/test', {
      method: 'POST',
      token,
      body: {
        protocol: 'openai',
        base_url: MIMO_BASE,
        model: MIMO_MODEL,
        api_key: 'tp-invalid-key-000000000000',
      },
    });
    record('TC-06', '错误 API Key 测试应失败', status === 400, `status=${status} err=${data?.error || ''}`);
  }

  // TC-07 创建有效 MiMo 模型
  let modelId = '';
  {
    const name = `MiMo-QA-${Date.now().toString(36)}`;
    const { status, data } = await req('/models', {
      method: 'POST',
      token,
      body: {
        name,
        protocol: 'openai',
        base_url: MIMO_BASE,
        model: MIMO_MODEL,
        api_key: MIMO_KEY,
      },
    });
    modelId = data?.id || '';
    const noRawKey = data && !('api_key' in data) && data.api_key_set === true;
    record('TC-07', '创建 MiMo 模型成功且脱敏', status === 200 && !!modelId && noRawKey, `id=${modelId} preview=${data?.api_key_preview || ''}`);
  }

  if (!modelId) {
    summarize();
    process.exit(1);
  }

  // TC-08 列表不泄露明文 Key
  {
    const { status, data } = await req('/models', { token });
    const item = (data?.models || []).find((m) => m.id === modelId);
    const safe = item && !('api_key' in item) && item.api_key_set && item.api_key_preview;
    record('TC-08', '列表接口不返回明文 Key', status === 200 && safe, `preview=${item?.api_key_preview || 'n/a'}`);
  }

  // TC-09 已保存模型测试连接
  {
    const { status, data } = await req(`/models/${modelId}/test`, { method: 'POST', token });
    record('TC-09', '已保存模型 ID 测试连接', status === 200 && data?.ok, `preview=${data?.reply_preview || data?.error || ''}`);
  }

  // TC-10 编辑留空 Key 应保持原密钥
  {
    const { status } = await req(`/models/${modelId}`, {
      method: 'PUT',
      token,
      body: {
        name: 'MiMo-QA-Updated',
        protocol: 'openai',
        base_url: MIMO_BASE,
        model: MIMO_MODEL,
      },
    });
    const test = await req(`/models/${modelId}/test`, { method: 'POST', token });
    record('TC-10', '编辑时不改 Key 仍可用', status === 200 && test.status === 200 && test.data?.ok, `test=${test.data?.reply_preview || test.data?.error || ''}`);
  }

  // TC-11 设为当前启用
  {
    const { status, data } = await req(`/models/${modelId}/activate`, { method: 'POST', token });
    record('TC-11', '设为当前启用模型', status === 200 && data?.active_id === modelId, `active_id=${data?.active_id || ''}`);
  }

  // TC-12 用 model_id 测试（模拟前端编辑页测试，Key 留空）
  {
    const { status, data } = await req('/models/test', {
      method: 'POST',
      token,
      body: {
        protocol: 'openai',
        base_url: MIMO_BASE,
        model: MIMO_MODEL,
        model_id: modelId,
      },
    });
    record('TC-12', 'model_id 回退读取已存 Key 测试', status === 200 && data?.ok, `preview=${data?.reply_preview || data?.error || ''}`);
  }

  // TC-13 错误模型名
  {
    const { status, data } = await req('/models/test', {
      method: 'POST',
      token,
      body: {
        protocol: 'openai',
        base_url: MIMO_BASE,
        model: 'nonexistent-model-xyz',
        api_key: MIMO_KEY,
      },
    });
    record('TC-13', '错误模型名应失败', status === 400, `err=${data?.error || ''}`);
  }

  // TC-14 错误 Base URL
  {
    const { status, data } = await req('/models/test', {
      method: 'POST',
      token,
      body: {
        protocol: 'openai',
        base_url: 'https://invalid.example.com/v1',
        model: MIMO_MODEL,
        api_key: MIMO_KEY,
      },
    });
    record('TC-14', '不可达 Base URL 应失败', status === 400, `err=${String(data?.error || '').slice(0, 60)}`);
  }

  // TC-15 清理：删除测试模型
  {
    const { status } = await req(`/models/${modelId}`, { method: 'DELETE', token });
    record('TC-15', '删除测试模型', status === 200, `status=${status}`);
  }

  // TC-16 删除后测试应 404
  {
    const { status, data } = await req(`/models/${modelId}/test`, { method: 'POST', token });
    record('TC-16', '删除后按 ID 测试应失败', status === 400 || status === 404, `status=${status} err=${data?.error || ''}`);
  }

  summarize();
}

function summarize() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== 汇总: ${passed} 通过, ${failed} 失败, 共 ${results.length} 项 ===`);
  if (failed) {
    console.log('\n失败项:');
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  - ${r.id} ${r.name}: ${r.detail}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
