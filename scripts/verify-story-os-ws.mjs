#!/usr/bin/env node
/**
 * WebSocket Story OS 事件验证
 * 运行: cd backend-node && node ../scripts/verify-story-os-ws.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend-node/package.json'));
const WebSocket = require('ws');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const PROJECT_ID = process.env.PROJECT_ID || '583e5628-24b';
const WS_URL = BASE.replace(/^http/, 'ws') + '/ws';

function waitFor(ws, predicate, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    const onMsg = (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(msg);
      }
    };
    ws.on('message', onMsg);
  });
}

async function chatUntilDone(ws, message) {
  const types = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout, saw: ${types.join(',')}`)), 90000);
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      types.push(msg.type);
      if (msg.type === 'story_tasks_today' || msg.type === 'task_execute' || msg.type === 'planner_result') {
        clearTimeout(timer);
        resolve({ event: msg, types });
        return;
      }
      if (msg.type === 'status' && msg.status === 'done') {
        clearTimeout(timer);
        resolve({ event: null, types });
      }
      if (msg.type === 'error') {
        clearTimeout(timer);
        reject(new Error(msg.error || 'ws error'));
      }
    });
    ws.send(JSON.stringify({
      type: 'chat',
      projectId: PROJECT_ID,
      message,
    }));
  });
}

async function main() {
  console.log(`\nWS 验证 — ${WS_URL}\n`);
  const ws = new WebSocket(WS_URL);
  await new Promise((res, rej) => {
    ws.once('open', res);
    ws.once('error', rej);
  });
  console.log('✓ WebSocket 已连接');

  // 需要项目会话 — 先等 session 或发 chat 带 sessionId
  const today = await chatUntilDone(ws, '今天写什么');
  if (today.event?.type === 'story_tasks_today') {
    console.log('✓ WS story_tasks_today 事件', `tasks=${today.event.today?.today?.tasks?.length ?? '?'}`);
  } else {
    console.error('✗ 未收到 story_tasks_today', today.types.join(','));
    process.exit(1);
  }

  const ws2 = new WebSocket(WS_URL);
  await new Promise((res) => ws2.once('open', res));
  const next = await chatUntilDone(ws2, '下一步做什么');
  if (next.event?.type === 'task_execute') {
    console.log('✓ WS task_execute（改稿路径）', next.event.plan?.type);
  } else if (next.types.includes('write_result') || next.types.some((t) => t === 'content')) {
    console.log('✓ WS 写章路径（content/write，plan_next→write）', next.types.filter((t) => t !== 'status').join(','));
  } else {
    console.log('? plan_next 结果', next.types.join(','));
  }

  ws.close();
  ws2.close();
  console.log('\n--- WS 验证完成 ---\n');
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
