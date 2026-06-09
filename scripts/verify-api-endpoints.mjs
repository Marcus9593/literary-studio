#!/usr/bin/env node
/**
 * 扫描前端 api.js 调用的主要 REST 端点是否可达（需本地服务已启动）
 * 用法：node scripts/verify-api-endpoints.mjs
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:8765/api';

const checks = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/projects' },
  { method: 'GET', path: '/studio/overview' },
  { method: 'GET', path: '/studio/dashboard' },
  { method: 'GET', path: '/tools/overview' },
  { method: 'GET', path: '/upload/formats' },
  { method: 'GET', path: '/export/formats' },
];

async function main() {
  let projectId = '';
  try {
    const res = await fetch(`${BASE}/projects`);
    const projects = await res.json();
    projectId = projects?.[0]?.id || '';
  } catch (e) {
    console.error('无法连接 API，请先运行 ./start.sh');
    process.exit(1);
  }

  if (projectId) {
    checks.push(
      { method: 'GET', path: `/projects/${projectId}` },
      { method: 'GET', path: `/projects/${projectId}/versions` },
      { method: 'GET', path: `/projects/${projectId}/story/health` },
      { method: 'GET', path: `/projects/${projectId}/story/knowledge` },
      { method: 'GET', path: `/projects/${projectId}/story/tasks/today` },
      { method: 'GET', path: `/projects/${projectId}/measurement/review` },
      { method: 'GET', path: `/projects/${projectId}/measurement/health` },
      { method: 'GET', path: `/studio/assets?project_id=${projectId}` },
    );
  }

  let failed = 0;
  for (const c of checks) {
    const url = `${BASE}${c.path}`;
    try {
      const res = await fetch(url, { method: c.method });
      const ok = res.status >= 200 && res.status < 400;
      const body = await res.text();
      let err = '';
      if (!ok) {
        try {
          err = JSON.parse(body).error || body.slice(0, 80);
        } catch {
          err = body.slice(0, 80);
        }
      }
      console.log(`${ok ? 'OK' : 'FAIL'} ${res.status} ${c.method} ${c.path}${err ? ` — ${err}` : ''}`);
      if (!ok) failed += 1;
    } catch (e) {
      console.log(`FAIL --- ${c.method} ${c.path} — ${e.message}`);
      failed += 1;
    }
  }

  console.log(failed ? `\n${failed} 个端点异常` : '\n全部端点正常');
  process.exit(failed ? 1 : 0);
}

main();
