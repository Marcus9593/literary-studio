import { getDb } from '../db.js';

function now() {
  return new Date().toISOString();
}

function rowToFact(row) {
  if (!row) return null;
  let characters = [];
  try {
    characters = JSON.parse(row.characters_json || '[]');
  } catch {
    characters = [];
  }
  return {
    id: row.id,
    project_id: row.project_id,
    unit_index: row.unit_index,
    category: row.category,
    fact: row.fact,
    characters,
    confidence: row.confidence,
    source_scene: row.source_scene,
    created_at: row.created_at,
  };
}

export function listMemoryFacts(projectId, { unitIndex, category, limit = 200 } = {}) {
  let sql = 'SELECT * FROM memory_facts WHERE project_id = ? AND deleted_at IS NULL';
  const params = [projectId];
  if (unitIndex != null) {
    sql += ' AND unit_index = ?';
    params.push(unitIndex);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY unit_index ASC, id ASC LIMIT ?';
  params.push(limit);
  return getDb().prepare(sql).all(...params).map(rowToFact);
}

export function addMemoryFact(projectId, data) {
  const ts = now();
  const characters = Array.isArray(data.characters) ? data.characters : [];
  const result = getDb().prepare(`
    INSERT INTO memory_facts (
      project_id, unit_index, category, fact, characters_json, confidence, source_scene, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    Number(data.unit_index) || 1,
    data.category || 'plot',
    data.fact || '',
    JSON.stringify(characters),
    Number(data.confidence) || 1.0,
    data.source_scene || null,
    ts,
  );
  const row = getDb().prepare('SELECT * FROM memory_facts WHERE id = ?').get(result.lastInsertRowid);
  return rowToFact(row);
}

export function addMemoryFactsBatch(projectId, facts) {
  const insert = getDb().prepare(`
    INSERT INTO memory_facts (
      project_id, unit_index, category, fact, characters_json, confidence, source_scene, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ts = now();
  const created = [];
  const runBatch = getDb().transaction((items) => {
    for (const data of items) {
      const characters = Array.isArray(data.characters) ? data.characters : [];
      const result = insert.run(
        projectId,
        Number(data.unit_index) || 1,
        data.category || 'plot',
        data.fact || '',
        JSON.stringify(characters),
        Number(data.confidence) || 1.0,
        data.source_scene || null,
        ts,
      );
      const row = getDb().prepare('SELECT * FROM memory_facts WHERE id = ?').get(result.lastInsertRowid);
      created.push(rowToFact(row));
    }
  });
  runBatch(facts || []);
  return created;
}

export function getNarrativeSummary(projectId, unitIndex) {
  const row = getDb().prepare(
    'SELECT * FROM narrative_summaries WHERE project_id = ? AND unit_index = ?',
  ).get(projectId, unitIndex);
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    unit_index: row.unit_index,
    summary: row.summary,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function upsertNarrativeSummary(projectId, unitIndex, summary) {
  const existing = getNarrativeSummary(projectId, unitIndex);
  const ts = now();
  if (existing) {
    getDb().prepare(`
      UPDATE narrative_summaries SET summary = ?, updated_at = ?
      WHERE project_id = ? AND unit_index = ?
    `).run(summary, ts, projectId, unitIndex);
  } else {
    getDb().prepare(`
      INSERT INTO narrative_summaries (project_id, unit_index, summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(projectId, unitIndex, summary, ts, ts);
  }
  return getNarrativeSummary(projectId, unitIndex);
}

export function listNarrativeSummaries(projectId) {
  return getDb().prepare(`
    SELECT * FROM narrative_summaries
    WHERE project_id = ?
    ORDER BY unit_index ASC
  `).all(projectId).map((row) => ({
    id: row.id,
    project_id: row.project_id,
    unit_index: row.unit_index,
    summary: row.summary,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export function buildMemoryContext(projectId, upToUnitIndex) {
  const summaries = listNarrativeSummaries(projectId)
    .filter((s) => s.unit_index <= upToUnitIndex);
  const facts = listMemoryFacts(projectId, { unitIndex: upToUnitIndex, limit: 100 });

  const lines = [];
  if (summaries.length) {
    lines.push('NARRATIVE SUMMARIES:');
    for (const s of summaries) {
      lines.push(`- Unit ${s.unit_index}: ${s.summary}`);
    }
    lines.push('');
  }
  if (facts.length) {
    lines.push('VERIFIED FACTS:');
    for (const f of facts) {
      lines.push(`- [${f.category}] ${f.fact}`);
    }
  }
  return lines.join('\n') || 'No narrative memory established yet.';
}

export function deleteProjectMemoryData(projectId) {
  getDb().prepare('DELETE FROM memory_facts WHERE project_id = ?').run(projectId);
  getDb().prepare('DELETE FROM narrative_summaries WHERE project_id = ?').run(projectId);
}
