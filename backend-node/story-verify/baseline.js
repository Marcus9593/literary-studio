import fs from 'fs';
import { baselinePath, baselinesDir } from './paths.js';
import { loadCurrentMetrics } from './metrics.js';

function now() {
  return new Date().toISOString();
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {
    return null;
  }
}

function resolveKey({ planId, taskId, chapter }) {
  if (planId) return `plan_${planId}`;
  if (taskId) return `task_${taskId}`;
  if (chapter != null) return `chapter_${chapter}`;
  return null;
}

/**
 * Execute 前快照 Understanding 指标（供 Verify 对比）
 */
export function captureExecutionBaseline(projectId, ctx = {}) {
  const key = resolveKey(ctx);
  if (!key) return null;

  const snapshot = {
    project_id: projectId,
    key,
    plan_id: ctx.planId || null,
    task_id: ctx.taskId || null,
    chapter: ctx.chapter ?? null,
    kind: ctx.kind || null,
    metrics: loadCurrentMetrics(projectId),
    captured_at: now(),
  };

  fs.mkdirSync(baselinesDir(projectId), { recursive: true });
  fs.writeFileSync(baselinePath(projectId, key), JSON.stringify(snapshot, null, 2), 'utf-8');
  return snapshot;
}

export function loadExecutionBaseline(projectId, ctx = {}) {
  const key = resolveKey(ctx);
  if (!key) return null;
  const fp = baselinePath(projectId, key);
  if (!fs.existsSync(fp)) return null;
  return readJson(fp);
}

export function loadBaselineForVerify(projectId, verifyResult) {
  if (verifyResult.plan_id) {
    return loadExecutionBaseline(projectId, { planId: verifyResult.plan_id });
  }
  if (verifyResult.task_id) {
    return loadExecutionBaseline(projectId, { taskId: verifyResult.task_id });
  }
  if (verifyResult.chapter != null) {
    return loadExecutionBaseline(projectId, { chapter: verifyResult.chapter });
  }
  return null;
}
