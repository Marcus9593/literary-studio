#!/usr/bin/env node
/**
 * 对照 frontend/src/api.js 与 backend-node 路由，列出前端调用但后端可能缺失的端点
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiSrc = fs.readFileSync(path.join(ROOT, 'frontend/src/api.js'), 'utf8');

const pathPatterns = new Set();
for (const m of apiSrc.matchAll(/request\(\s*[`'"]([^`'"]+)[`'"]/g)) {
  pathPatterns.add(m[1].replace(/\$\{[^}]+\}/g, ':param'));
}
for (const m of apiSrc.matchAll(/fetch\(\s*`\$\{API\}([^`]+)`/g)) {
  pathPatterns.add(m[1].replace(/\$\{[^}]+\}/g, ':param').split('?')[0]);
}

function collectRoutes(dir) {
  const routes = [];
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    if (fs.statSync(fp).isDirectory()) {
      if (name === 'node_modules') continue;
      routes.push(...collectRoutes(fp));
      continue;
    }
    if (!name.endsWith('.js')) continue;
    const text = fs.readFileSync(fp, 'utf8');
    for (const m of text.matchAll(/router\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]+)[`'"]/g)) {
      routes.push({ method: m[1].toUpperCase(), path: m[2], file: path.relative(ROOT, fp) });
    }
    for (const m of text.matchAll(/router\.(get|post|put|patch|delete)\(\s*`\$\{base\}([^`]+)`/g)) {
      routes.push({ method: m[1].toUpperCase(), path: `/projects/:id/story${m[2]}`, file: path.relative(ROOT, fp) });
    }
    for (const m of text.matchAll(/router\.(get|post|put|patch|delete)\(\s*`\$\{base\}`/g)) {
      routes.push({ method: m[1].toUpperCase(), path: '/projects/:id/story', file: path.relative(ROOT, fp) });
    }
  }
  return routes;
}

const backendRoutes = collectRoutes(path.join(ROOT, 'backend-node'));
const mounted = backendRoutes.map((r) => {
  let p = r.path;
  if (!p.startsWith('/')) p = `/projects/:id/${p}`;
  if (r.file.includes('routes.js') && !p.startsWith('/api')) {
    if (p.startsWith('/studio')) return { ...r, path: p };
    if (p.startsWith('/projects')) return { ...r, path: p };
    if (p.startsWith('/health') || p.startsWith('/models') || p.startsWith('/tools')) return { ...r, path: p };
  }
  return { ...r, path: p };
});

function normalize(p) {
  return p
    .replace(/encodeURIComponent\([^)]+\)/g, ':param')
    .replace(/\/+/g, '/');
}

function matchRoute(apiPath, method = 'GET') {
  const p = normalize(apiPath.startsWith('/') ? apiPath : `/${apiPath}`);
  for (const r of mounted) {
    const rp = normalize(r.path);
    const re = new RegExp(`^${rp.replace(/:[^/]+/g, '[^/]+')}$`);
    if (re.test(p)) return r;
  }
  return null;
}

const missing = [];
const covered = [];

for (const p of [...pathPatterns].sort()) {
  const hit = matchRoute(p);
  if (hit) covered.push({ api: p, route: hit });
  else missing.push(p);
}

console.log(`前端 API 路径: ${pathPatterns.size} 个`);
console.log(`已匹配后端路由: ${covered.length} 个`);
if (missing.length) {
  console.log('\n未匹配（可能由子路由 / 动态挂载 / WebSocket 提供）:');
  for (const m of missing) console.log(`  - ${m}`);
} else {
  console.log('\n全部路径均有对应后端路由');
}
