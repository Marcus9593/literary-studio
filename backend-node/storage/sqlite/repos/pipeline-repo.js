import { getDb } from '../db.js';

const STATUSES = new Set(['pending', 'running', 'complete', 'failed']);
const DECISIONS = new Set(['APPROVE', 'REVISE', 'REJECT']);
export const MAX_REVISIONS = 2;

function now() {
  return new Date().toISOString();
}

function rowToPipeline(row) {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    unit_index: row.unit_index,
    status: row.status,
    workspace_ref: row.workspace_ref,
    beat_json: row.beat_json,
    critic_json: row.critic_json ? JSON.parse(row.critic_json) : null,
    governor_decision: row.governor_decision,
    governor_memo: row.governor_memo,
    revision_count: row.revision_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createPipelineRun(projectId, data = {}) {
  const ts = now();
  const beatJson = data.beat_json != null
    ? (typeof data.beat_json === 'string' ? data.beat_json : JSON.stringify(data.beat_json))
    : null;

  const result = getDb().prepare(`
    INSERT INTO pipeline_runs (
      project_id, unit_index, status, workspace_ref, beat_json,
      critic_json, governor_decision, governor_memo, revision_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?, ?)
  `).run(
    projectId,
    Number(data.unit_index) || 1,
    STATUSES.has(data.status) ? data.status : 'pending',
    data.workspace_ref || null,
    beatJson,
    ts,
    ts,
  );

  return getPipelineRun(projectId, result.lastInsertRowid);
}

export function getPipelineRun(projectId, id) {
  const row = getDb().prepare(
    'SELECT * FROM pipeline_runs WHERE project_id = ? AND id = ?',
  ).get(projectId, id);
  return rowToPipeline(row);
}

export function listPipelineRuns(projectId, { unitIndex, limit = 50 } = {}) {
  let sql = 'SELECT * FROM pipeline_runs WHERE project_id = ?';
  const params = [projectId];
  if (unitIndex != null) {
    sql += ' AND unit_index = ?';
    params.push(unitIndex);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  return getDb().prepare(sql).all(...params).map(rowToPipeline);
}

export function updatePipelineRun(projectId, id, patch) {
  const existing = getPipelineRun(projectId, id);
  if (!existing) return null;

  const ts = now();
  const status = STATUSES.has(patch.status) ? patch.status : existing.status;
  const decision = patch.governor_decision != null
    ? (DECISIONS.has(patch.governor_decision) ? patch.governor_decision : existing.governor_decision)
    : existing.governor_decision;

  const criticJson = patch.critic_json != null
    ? JSON.stringify(patch.critic_json)
    : (existing.critic_json ? JSON.stringify(existing.critic_json) : null);

  const beatJson = patch.beat_json != null
    ? (typeof patch.beat_json === 'string' ? patch.beat_json : JSON.stringify(patch.beat_json))
    : existing.beat_json;

  getDb().prepare(`
    UPDATE pipeline_runs SET
      status = ?,
      workspace_ref = ?,
      beat_json = ?,
      critic_json = ?,
      governor_decision = ?,
      governor_memo = ?,
      revision_count = ?,
      updated_at = ?
    WHERE project_id = ? AND id = ?
  `).run(
    status,
    patch.workspace_ref ?? existing.workspace_ref,
    beatJson,
    criticJson,
    decision,
    patch.governor_memo ?? existing.governor_memo,
    patch.revision_count ?? existing.revision_count,
    ts,
    projectId,
    id,
  );

  return getPipelineRun(projectId, id);
}

export function saveCriticReport(projectId, { unitIndex, workspaceRef, report, scoringMethod = 'rules' }) {
  const ts = now();
  const result = getDb().prepare(`
    INSERT INTO critic_reports (project_id, unit_index, workspace_ref, report_json, scoring_method, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    unitIndex ?? null,
    workspaceRef ?? null,
    JSON.stringify(report),
    scoringMethod,
    ts,
  );
  return {
    id: result.lastInsertRowid,
    project_id: projectId,
    unit_index: unitIndex ?? null,
    workspace_ref: workspaceRef ?? null,
    report,
    scoring_method: scoringMethod,
    created_at: ts,
  };
}

export function listCriticReports(projectId, { limit = 20 } = {}) {
  return getDb().prepare(`
    SELECT * FROM critic_reports
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(projectId, limit).map((row) => ({
    id: row.id,
    project_id: row.project_id,
    unit_index: row.unit_index,
    workspace_ref: row.workspace_ref,
    report: JSON.parse(row.report_json),
    scoring_method: row.scoring_method,
    created_at: row.created_at,
  }));
}

export function deleteProjectPipelineData(projectId) {
  getDb().prepare('DELETE FROM pipeline_runs WHERE project_id = ?').run(projectId);
  getDb().prepare('DELETE FROM critic_reports WHERE project_id = ?').run(projectId);
}
