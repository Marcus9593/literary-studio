#!/usr/bin/env node
/**
 * 验证 SQLite 性能/并发修复：busy_timeout、事务删除、override 原子性、会话锁
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeRmDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch (err) {
    console.warn(`  ⚠ 无法删除临时目录 ${dir}: ${err.message}`);
  }
}

async function importWithData(dataDir, relPath) {
  process.env.LITERARY_STUDIO_DATA = dataDir;
  return import(`${pathToFileURL(path.join(BACKEND, relPath)).href}?v=${Date.now()}`);
}

async function testBusyTimeoutAndTransaction() {
  console.log('\n[1] SQLite busy_timeout + runInTransaction');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-verify-sqlite-'));
  try {
    const dbMod = await importWithData(dataDir, 'storage/sqlite/db.js');
    const db = dbMod.getDb();
    const busyRow = db.prepare('PRAGMA busy_timeout').get();
    const busyMs = busyRow?.busy_timeout ?? busyRow?.timeout ?? Object.values(busyRow || {})[0];
    assert('PRAGMA busy_timeout 已设置', Number(busyMs) >= 5000, String(busyMs));

    const journal = db.prepare('PRAGMA journal_mode').get();
    const mode = journal?.journal_mode ?? Object.values(journal || {})[0];
    assert('journal_mode 为 wal 或 fallback', ['wal', 'delete'].includes(String(mode)), String(mode));

    let txRan = false;
    dbMod.runInTransaction(() => {
      txRan = true;
      db.prepare('INSERT INTO kv (key, value_json, updated_at) VALUES (?, ?, ?)').run(
        'tx-test',
        '{"ok":true}',
        new Date().toISOString(),
      );
    });
    assert('runInTransaction 可执行', txRan);
    assert('runInTransaction 已提交', dbMod.kvGet('tx-test')?.ok === true);
  } finally {
    safeRmDir(dataDir);
  }
}

async function testDeleteProjectTransaction() {
  console.log('\n[2] deleteProjectRow 事务删除');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-verify-del-proj-'));
  try {
    const dbMod = await importWithData(dataDir, 'storage/sqlite/db.js');
    const { createCanonRule, listCanonRules } = await importWithData(
      dataDir,
      'storage/sqlite/repos/canon-repo.js',
    );

    const pid = 'proj-del-test';
    dbMod.saveProjectMeta({ id: pid, title: 'T', updated_at: new Date().toISOString() });
    dbMod.saveSession(pid, 's1', { id: 's1', title: 'S', messages: [], updated_at: new Date().toISOString() });
    createCanonRule(pid, { title: 'rule', content: 'c' });

    assert('删除前 canon 存在', listCanonRules(pid).length === 1);
    dbMod.deleteProjectRow(pid);
    assert('projects 行已删', dbMod.loadProjectMeta(pid) == null);
    assert('sessions 行已删', dbMod.loadSession(pid, 's1') == null);
    assert('canon 行已删', listCanonRules(pid).length === 0);
  } finally {
    safeRmDir(dataDir);
  }
}

async function testOverrideAtomicity() {
  console.log('\n[3] override_budget 原子性');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-verify-override-'));
  try {
    const { getOverrideBudget, useOverride } = await importWithData(
      dataDir,
      'storage/sqlite/repos/canon-repo.js',
    );
    const pid = 'proj-override';
    const unit = 1;

    const a = getOverrideBudget(pid, unit);
    const b = getOverrideBudget(pid, unit);
    assert('INSERT OR IGNORE 不重复行', a.id === b.id);

    const r1 = useOverride(pid, unit);
    const r2 = useOverride(pid, unit);
    const r3 = useOverride(pid, unit);
    assert('前两次 override 成功', r1.ok && r2.ok);
    assert('第三次 override 拒绝（max=2）', r3.ok === false);
    assert('used 不超过 max', r3.budget.used <= r3.budget.max, `used=${r3.budget.used}`);
  } finally {
    safeRmDir(dataDir);
  }
}

async function testSessionLock() {
  console.log('\n[4] 项目级会话锁');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-verify-slock-'));

  try {
    process.env.LITERARY_STUDIO_DATA = dataDir;
    const { createProject } = await import(
      `${pathToFileURL(path.join(BACKEND, 'storage/projects.js')).href}?v=${Date.now()}`
    );
    const sessions = await import(
      `${pathToFileURL(path.join(BACKEND, 'storage/sessions.js')).href}?v=${Date.now()}`
    );

    const project = createProject('Session Lock Test');
    const pid = project.id;

    const created = await sessions.createSession(pid, '并发测试');
    const sid = created.id;

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        sessions.appendSessionMessage(pid, sid, 'user', `msg-${i}`),
      ),
    );

    const final = sessions.getSessionWithMessages(pid, sid);
    const contents = new Set(final.messages.map((m) => m.content));
    assert('并发 append 20 条消息', final.messages.length === 20, `got ${final.messages.length}`);
    assert(
      '20 条消息内容无丢失',
      contents.size === 20 && [...contents].every((c) => /^msg-\d+$/.test(c)),
      `unique=${contents.size}`,
    );
    assert('所有 append 返回 Promise 结果', results.every((r) => r?.messages?.length > 0));
  } finally {
    safeRmDir(dataDir);
  }
}

async function testSessionApiIntegration() {
  console.log('\n[5] HTTP 会话 API（async + lock）');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-verify-sapi-'));
  const port = 19200 + Math.floor(Math.random() * 200);
  const base = `http://127.0.0.1:${port}/api`;
  let child = null;

  try {
    child = spawn('node', ['server.js'], {
      cwd: BACKEND,
      env: {
        ...process.env,
        LITERARY_STUDIO_DATA: dataDir,
        PORT: String(port),
        STUDIO_HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const start = Date.now();
    let ready = false;
    while (Date.now() - start < 15000) {
      try {
        const res = await fetch(`${base}/health`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        /* retry */
      }
      await sleep(300);
    }
    assert('后端就绪', ready);
    if (!ready) return;

    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    }).then((r) => r.json());
    const token = login.token;
    assert('admin 登录', !!token);

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const project = await fetch(`${base}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Session Lock Test' }),
    }).then((r) => r.json());
    assert('创建测试项目', project?.id);

    const session = await fetch(`${base}/projects/${project.id}/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'API 会话' }),
    }).then((r) => r.json());
    assert('POST /sessions 返回会话', session?.id);

    const cleared = await fetch(`${base}/projects/${project.id}/sessions/${session.id}/messages`, {
      method: 'DELETE',
      headers,
    }).then((r) => r.json());
    assert('DELETE /messages 清空成功', Array.isArray(cleared?.messages) && cleared.messages.length === 0);

    const renamed = await fetch(`${base}/projects/${project.id}/sessions/${session.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: '已重命名' }),
    }).then((r) => r.json());
    assert('PATCH 重命名会话', renamed?.title === '已重命名');
  } finally {
    if (child) {
      child.kill('SIGTERM');
      await sleep(400);
      if (!child.killed) child.kill('SIGKILL');
    }
    safeRmDir(dataDir);
  }
}

async function main() {
  console.log('=== SQLite / 会话并发修复验证 ===');
  console.log(`项目: ${ROOT}`);

  await testBusyTimeoutAndTransaction();
  await testDeleteProjectTransaction();
  await testOverrideAtomicity();
  await testSessionLock();
  await testSessionApiIntegration();

  console.log('\n=== 结果 ===');
  console.log(`通过: ${passed}  失败: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
