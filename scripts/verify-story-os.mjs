#!/usr/bin/env node
/**
 * Story OS Phase 1 功能验证脚本
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const PROJECT_ID = process.env.PROJECT_ID || '583e5628-24b';

const results = [];
let passed = 0;
let failed = 0;

function ok(name, detail = '') {
  passed++;
  results.push({ ok: true, name, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed++;
  results.push({ ok: false, name, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, path, body) {
  const opts = { method, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json, ok: res.ok };
}

async function main() {
  console.log(`\nStory OS 验证 — 项目 ${PROJECT_ID}\n`);

  // 1. Health
  const health = await api('GET', '/api/health');
  if (health.ok) ok('服务健康检查', `HTTP ${health.status}`);
  else fail('服务健康检查', `HTTP ${health.status}`);

  // 2. Today tasks
  const today = await api('GET', `/api/projects/${PROJECT_ID}/story/tasks/today`);
  if (!today.ok) {
    fail('GET /tasks/today', JSON.stringify(today.json?.error || today.status));
  } else {
    const d = today.json;
    const tasks = d?.today?.tasks || [];
    ok('今日创作 API', `${tasks.length} 项任务, phase=${d.story_os_phase}`);
    if (!d.story_goal) fail('今日创作含 story_goal');
    else ok('story_goal 存在');
    if (!d.roadmap?.chapters?.length && !d.planner_summary) {
      fail('路线图或 planner_summary');
    } else ok('路线图/摘要存在');
    if (typeof d.today?.capacity_minutes !== 'number') fail('Scheduler capacity');
    else ok('Scheduler 容量字段', `${d.today.capacity_minutes} 分钟`);
  }

  // 3. Planner bundle
  const bundle = await api('GET', `/api/projects/${PROJECT_ID}/story/planner/bundle`);
  if (bundle.ok && bundle.json?.story_goal && bundle.json?.chapter_roadmap) {
    ok('Planner bundle', `horizon=${bundle.json.chapter_roadmap?.horizon}`);
  } else {
    fail('Planner bundle', bundle.json?.error || bundle.status);
  }

  // 4. Preferences
  const prefs = await api('GET', `/api/projects/${PROJECT_ID}/story/planner/preferences`);
  if (prefs.ok && prefs.json?.default_horizon) {
    ok('Planner preferences', `horizon=${prefs.json.default_horizon}`);
  } else {
    fail('Planner preferences');
  }

  // 5. Tasks list
  const tasks = await api('GET', `/api/projects/${PROJECT_ID}/story/tasks`);
  if (!tasks.ok) {
    fail('GET /tasks', tasks.json?.error);
  } else {
    const items = tasks.json?.items || [];
    ok('任务列表', `${items.length} 项`);
    const writeTodo = items.filter((t) => t.type === 'write_chapter' && t.status === 'todo');
    if (writeTodo.length) ok('存在待办写章任务', `ch${writeTodo[writeTodo.length - 1].chapter}`);
  }

  // 6. Chief editor route — plan_today (via route endpoint if exists)
  const routeToday = await api('POST', `/api/projects/${PROJECT_ID}/story/route`, {
    message: '今天写什么',
  });
  if (routeToday.ok) {
    const action = routeToday.json?.action;
    if (action === 'tasks_today') ok('意图 plan_today → tasks_today');
    else fail('意图 plan_today', `action=${action}`);
  } else {
    // try alternate endpoint
    const alt = await api('POST', `/api/projects/${PROJECT_ID}/story/intent`, { message: '今天写什么' });
    if (alt.ok && alt.json?.action === 'tasks_today') ok('意图 plan_today (intent API)');
    else fail('意图 plan_today', routeToday.json?.error || '无 route API');
  }

  // 7. plan_next — should be write or task_execute
  const routeNext = await api('POST', `/api/projects/${PROJECT_ID}/story/route`, {
    message: '下一步做什么',
  });
  if (routeNext.ok) {
    const a = routeNext.json?.action;
    if (a === 'write' || a === 'task_execute' || a === 'notify') {
      ok('意图 plan_next', `action=${a}`);
    } else {
      fail('意图 plan_next', `action=${a}`);
    }
  } else {
    fail('意图 plan_next', routeNext.json?.error);
  }

  // 8. Idempotent task start (if we have a todo task)
  const tasksDoc = tasks.json;
  const todoTask = tasksDoc?.items?.find((t) => t.status === 'todo');
  if (todoTask) {
    const start1 = await api('POST', `/api/projects/${PROJECT_ID}/story/tasks/${todoTask.id}/start`);
    const start2 = await api('POST', `/api/projects/${PROJECT_ID}/story/tasks/${todoTask.id}/start`);
    if (start1.ok && start2.ok) {
      const p1 = start1.json?.plan?.id;
      const p2 = start2.json?.plan?.id;
      if (p1 && p1 === p2) ok('任务启动幂等', `plan=${p1}`);
      else fail('任务启动幂等', `p1=${p1} p2=${p2}`);
      if (start1.json?.plan?.type === 'chapter_plan') {
        ok('写章任务生成 chapter_plan');
      } else if (start1.json?.plan?.execution_prompt) {
        ok('改稿任务含 execution_prompt');
      }
    } else {
      fail('任务启动', start1.json?.error || start2.json?.error);
    }
  } else {
    ok('任务启动（跳过）', '无 todo 任务');
  }

  // 9. Rebuild preserves done (mark one task done then rebuild)
  const anyTodo = tasksDoc?.items?.find((t) => t.status === 'todo' && t.type === 'align_goal');
  if (anyTodo) {
    await api('POST', `/api/projects/${PROJECT_ID}/story/tasks/${anyTodo.id}/complete`);
    const afterComplete = await api('GET', `/api/projects/${PROJECT_ID}/story/tasks`);
    const doneBefore = afterComplete.json?.items?.filter((t) => t.status === 'done').length || 0;
    await api('POST', `/api/projects/${PROJECT_ID}/story/tasks/rebuild`, { horizon: 5 });
    const afterRebuild = await api('GET', `/api/projects/${PROJECT_ID}/story/tasks`);
    const doneAfter = afterRebuild.json?.items?.filter((t) => t.status === 'done').length || 0;
    if (doneAfter >= doneBefore && doneBefore > 0) {
      ok('重建后保留 done 状态', `done: ${doneBefore} → ${doneAfter}`);
    } else if (doneBefore === 0) {
      ok('重建状态合并（跳过）', '无 done 任务可测');
    } else {
      fail('重建后保留 done', `done: ${doneBefore} → ${doneAfter}`);
    }
  }

  // 10. Regex: bare "开始" should NOT be plan_next
  const bareStart = await api('POST', `/api/projects/${PROJECT_ID}/story/route`, { message: '开始' });
  if (bareStart.ok) {
    const intent = bareStart.json?.intent;
    if (intent === 'plan_next') fail('「开始」不应触发 plan_next');
    else ok('「开始」不误触 plan_next', `intent=${intent || bareStart.json?.action}`);
  }

  // Verify layer
  const verifyRes = await api('GET', `/api/projects/${PROJECT_ID}/story/verify`);
  if (verifyRes.ok && verifyRes.json?.recent != null) {
    ok('GET /story/verify', `${(verifyRes.json.recent || []).length} 条记录`);
  } else {
    fail('GET /story/verify', verifyRes.json?.error || verifyRes.status);
  }

  const healthRes = await api('GET', `/api/projects/${PROJECT_ID}/story/health`);
  if (healthRes.ok && healthRes.json?.verify != null) {
    ok('health 含 verify 聚合');
  } else {
    fail('health 含 verify', 'missing verify field');
  }

  console.log(`\n--- 结果: ${passed} 通过, ${failed} 失败 ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
