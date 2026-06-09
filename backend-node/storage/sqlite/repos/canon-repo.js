import { getDb } from '../db.js';

const CANON_LEVELS = new Set(['immutable', 'semi_mutable', 'mutable']);
const DEFAULT_MAX_OVERRIDES = 2;

function now() {
  return new Date().toISOString();
}

function rowToCanon(row) {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    category: row.category,
    title: row.title,
    content: row.content,
    level: row.level,
    unit_index: row.unit_index,
    source: row.source,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listCanonRules(projectId, { activeOnly = true } = {}) {
  const sql = activeOnly
    ? `SELECT * FROM canon_rules
       WHERE project_id = ? AND deleted_at IS NULL AND active = 1
       ORDER BY category, title`
    : `SELECT * FROM canon_rules
       WHERE project_id = ? AND deleted_at IS NULL
       ORDER BY category, title`;
  return getDb().prepare(sql).all(projectId).map(rowToCanon);
}

export function getCanonRule(projectId, id) {
  const row = getDb().prepare(
    `SELECT * FROM canon_rules
     WHERE project_id = ? AND id = ? AND deleted_at IS NULL`,
  ).get(projectId, id);
  return rowToCanon(row);
}

export function createCanonRule(projectId, data) {
  const level = CANON_LEVELS.has(data.level) ? data.level : 'mutable';
  const ts = now();
  const result = getDb().prepare(`
    INSERT INTO canon_rules (
      project_id, category, title, content, level, unit_index, source, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    data.category || 'world_rule',
    data.title || '未命名规则',
    data.content || '',
    level,
    Number(data.unit_index) || 1,
    data.source || 'manual',
    data.active === false ? 0 : 1,
    ts,
    ts,
  );
  return getCanonRule(projectId, result.lastInsertRowid);
}

export function updateCanonRule(projectId, id, patch) {
  const existing = getCanonRule(projectId, id);
  if (!existing) return null;
  if (existing.level === 'immutable' && patch.level && patch.level !== 'immutable') {
    throw new Error('不可变设定规则不能降级为可变');
  }
  if (existing.level === 'immutable') {
    const blocked = ['title', 'content', 'category', 'level'].some(
      (k) => patch[k] !== undefined && patch[k] !== existing[k],
    );
    if (blocked) throw new Error('不可变设定规则不能修改内容');
  }

  const ts = now();
  const next = {
    category: patch.category ?? existing.category,
    title: patch.title ?? existing.title,
    content: patch.content ?? existing.content,
    level: patch.level ?? existing.level,
    unit_index: patch.unit_index ?? existing.unit_index,
    source: patch.source ?? existing.source,
    active: patch.active !== undefined ? (patch.active ? 1 : 0) : (existing.active ? 1 : 0),
  };

  getDb().prepare(`
    UPDATE canon_rules
    SET category = ?, title = ?, content = ?, level = ?, unit_index = ?, source = ?, active = ?, updated_at = ?
    WHERE project_id = ? AND id = ? AND deleted_at IS NULL
  `).run(
    next.category,
    next.title,
    next.content,
    next.level,
    next.unit_index,
    next.source,
    next.active,
    ts,
    projectId,
    id,
  );
  return getCanonRule(projectId, id);
}

export function softDeleteCanonRule(projectId, id) {
  const ts = now();
  const result = getDb().prepare(`
    UPDATE canon_rules SET deleted_at = ?, active = 0, updated_at = ?
    WHERE project_id = ? AND id = ? AND deleted_at IS NULL
  `).run(ts, ts, projectId, id);
  return result.changes > 0;
}

export function getOverrideBudget(projectId, unitIndex) {
  const row = getDb().prepare(
    'SELECT * FROM override_budget WHERE project_id = ? AND unit_index = ?',
  ).get(projectId, unitIndex);

  if (row) {
    return {
      id: row.id,
      project_id: row.project_id,
      unit_index: row.unit_index,
      used: row.used,
      max: row.max_overrides,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  const ts = now();
  const result = getDb().prepare(`
    INSERT INTO override_budget (project_id, unit_index, used, max_overrides, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?)
  `).run(projectId, unitIndex, DEFAULT_MAX_OVERRIDES, ts, ts);

  return {
    id: result.lastInsertRowid,
    project_id: projectId,
    unit_index: unitIndex,
    used: 0,
    max: DEFAULT_MAX_OVERRIDES,
    created_at: ts,
    updated_at: ts,
  };
}

export function useOverride(projectId, unitIndex) {
  const budget = getOverrideBudget(projectId, unitIndex);
  if (budget.used >= budget.max) return { ok: false, budget };

  const ts = now();
  getDb().prepare(`
    UPDATE override_budget SET used = used + 1, updated_at = ?
    WHERE project_id = ? AND unit_index = ?
  `).run(ts, projectId, unitIndex);

  return { ok: true, budget: getOverrideBudget(projectId, unitIndex) };
}

export function deleteProjectCanonData(projectId) {
  getDb().prepare('DELETE FROM canon_rules WHERE project_id = ?').run(projectId);
  getDb().prepare('DELETE FROM override_budget WHERE project_id = ?').run(projectId);
}
