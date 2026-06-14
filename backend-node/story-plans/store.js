import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { plansDir, planPath } from '../story-kb/paths.js';

function now() {
  return new Date().toISOString();
}

export function listPlans(projectId, { status } = {}) {
  const dir = plansDir(projectId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      } catch (e) {
        console.warn(`[story-plans] JSON 解析失败，已跳过: ${f}`, e.message);
        return null;
      }
    })
    .filter(Boolean)
    .filter((p) => !status || p.status === status)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function getPlan(projectId, planId) {
  const fp = planPath(projectId, planId);
  if (!fs.existsSync(fp)) throw new Error('计划不存在');
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function readPlanSafe(projectId, planId) {
  try {
    const fp = planPath(projectId, planId);
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {
    return null;
  }
}

export function savePlan(projectId, plan, { expectedVersion } = {}) {
  fs.mkdirSync(plansDir(projectId), { recursive: true });
  const id = plan.id || randomUUID().slice(0, 12);
  // 乐观锁：如果提供了 expectedVersion，校验当前版本
  if (expectedVersion != null) {
    const existing = readPlanSafe(projectId, id);
    if (existing && existing._version !== expectedVersion) {
      throw new Error(`并发冲突：计划 ${id} 已被其他进程修改（期望版本 ${expectedVersion}，当前版本 ${existing._version}）`);
    }
  }
  const version = (plan._version || 0) + 1;
  const full = { ...plan, id, updated_at: now(), _version: version };
  fs.writeFileSync(planPath(projectId, id), JSON.stringify(full, null, 2), 'utf-8');
  return full;
}

export function createPlan(projectId, payload) {
  if (!payload || !payload.type || !payload.summary) {
    throw new Error('创建计划失败：type 和 summary 为必填字段');
  }
  return savePlan(projectId, {
    ...payload,
    id: randomUUID().slice(0, 12),
    status: 'pending_confirm',
    created_at: now(),
  });
}

export function updatePlanStatus(projectId, planId, status, extra = {}) {
  const plan = getPlan(projectId, planId);
  // 使用乐观锁防止并发修改冲突
  return savePlan(projectId, { ...plan, status, ...extra }, { expectedVersion: plan._version });
}
