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
      } catch {
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

export function savePlan(projectId, plan) {
  fs.mkdirSync(plansDir(projectId), { recursive: true });
  const id = plan.id || randomUUID().slice(0, 12);
  const full = { ...plan, id, updated_at: now() };
  fs.writeFileSync(planPath(projectId, id), JSON.stringify(full, null, 2), 'utf-8');
  return full;
}

export function createPlan(projectId, payload) {
  return savePlan(projectId, {
    ...payload,
    id: randomUUID().slice(0, 12),
    status: 'pending_confirm',
    created_at: now(),
  });
}

export function updatePlanStatus(projectId, planId, status, extra = {}) {
  const plan = getPlan(projectId, planId);
  return savePlan(projectId, { ...plan, status, ...extra });
}
