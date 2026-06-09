import { getDb } from '../db.js';

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToDna(row) {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    character_id: row.character_id,
    avg_sentence: row.avg_sentence,
    question_ratio: row.question_ratio,
    vocabulary: parseJson(row.vocabulary_json, []),
    forbidden_words: parseJson(row.forbidden_words_json, []),
    catchphrases: parseJson(row.catchphrases_json, []),
    sample_dialogue: row.sample_dialogue || '',
    tone: row.tone || '',
    formality: row.formality || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listVoiceDnas(projectId) {
  const rows = getDb().prepare(
    'SELECT * FROM voice_dnas WHERE project_id = ? ORDER BY updated_at DESC',
  ).all(projectId);
  return rows.map(rowToDna);
}

export function getVoiceDna(projectId, characterId) {
  const row = getDb().prepare(
    'SELECT * FROM voice_dnas WHERE project_id = ? AND character_id = ?',
  ).get(projectId, characterId);
  return rowToDna(row);
}

export function upsertVoiceDna(projectId, characterId, data) {
  const ts = new Date().toISOString();
  const existing = getVoiceDna(projectId, characterId);

  if (existing) {
    getDb().prepare(`
      UPDATE voice_dnas SET
        avg_sentence = ?,
        question_ratio = ?,
        vocabulary_json = ?,
        forbidden_words_json = ?,
        catchphrases_json = ?,
        sample_dialogue = ?,
        tone = ?,
        formality = ?,
        updated_at = ?
      WHERE project_id = ? AND character_id = ?
    `).run(
      data.avg_sentence ?? existing.avg_sentence,
      data.question_ratio ?? existing.question_ratio,
      JSON.stringify(data.vocabulary ?? existing.vocabulary),
      JSON.stringify(data.forbidden_words ?? existing.forbidden_words),
      JSON.stringify(data.catchphrases ?? existing.catchphrases),
      data.sample_dialogue ?? existing.sample_dialogue,
      data.tone ?? existing.tone,
      data.formality ?? existing.formality,
      ts,
      projectId,
      characterId,
    );
    return getVoiceDna(projectId, characterId);
  }

  const result = getDb().prepare(`
    INSERT INTO voice_dnas (
      project_id, character_id, avg_sentence, question_ratio,
      vocabulary_json, forbidden_words_json, catchphrases_json,
      sample_dialogue, tone, formality, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    characterId,
    data.avg_sentence ?? 0,
    data.question_ratio ?? 0,
    JSON.stringify(data.vocabulary || []),
    JSON.stringify(data.forbidden_words || []),
    JSON.stringify(data.catchphrases || []),
    data.sample_dialogue || '',
    data.tone || '',
    data.formality || '',
    ts,
    ts,
  );

  return getVoiceDna(projectId, characterId) || { id: result.lastInsertRowid, ...data };
}

export function deleteVoiceDna(projectId, characterId) {
  const r = getDb().prepare(
    'DELETE FROM voice_dnas WHERE project_id = ? AND character_id = ?',
  ).run(projectId, characterId);
  return r.changes > 0;
}

export function deleteProjectVoiceDnaData(projectId) {
  getDb().prepare('DELETE FROM voice_dnas WHERE project_id = ?').run(projectId);
}
