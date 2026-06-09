import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrateAwrEngine } from './migrate-awr.js';
import { migrateUsersToSqlite, repairPasswordHashesInDb } from './migrate-auth.js';
import { deleteProjectEngineData } from './repos/project-engine-cleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'studio.db');

let db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  meta_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, session_id)
);

CREATE TABLE IF NOT EXISTS session_index (
  project_id TEXT PRIMARY KEY,
  index_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_archive (
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  PRIMARY KEY (project_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);
`;

function attachTransactionPolyfill(database) {
  if (typeof database.transaction === 'function') return;
  database.transaction = (fn) => (...args) => {
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = fn(...args);
      database.exec('COMMIT');
      return result;
    } catch (err) {
      try { database.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  };
}

export function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  try {
    db.exec('PRAGMA journal_mode = WAL');
  } catch {
    /* WAL 不可用时忽略 */
  }
  attachTransactionPolyfill(db);
  db.exec(SCHEMA);
  migrateAwrEngine(db);
  migrateUsersToSqlite();
  repairPasswordHashesInDb();
  return db;
}

export function getDbPath() {
  return DB_PATH;
}

export function kvGet(key, fallback = null) {
  const row = getDb().prepare('SELECT value_json FROM kv WHERE key = ?').get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value_json);
  } catch {
    return fallback;
  }
}

export function kvSet(key, value) {
  const updated_at = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO kv (key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), updated_at);
}

export function saveSession(projectId, sessionId, session) {
  const updated_at = session.updated_at || new Date().toISOString();
  getDb().prepare(`
    INSERT INTO sessions (project_id, session_id, data_json, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id, session_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
  `).run(projectId, sessionId, JSON.stringify(session), updated_at);
}

export function loadSession(projectId, sessionId) {
  const row = getDb().prepare(
    'SELECT data_json FROM sessions WHERE project_id = ? AND session_id = ?',
  ).get(projectId, sessionId);
  if (!row) return null;
  try {
    return JSON.parse(row.data_json);
  } catch {
    return null;
  }
}

export function deleteSessionRow(projectId, sessionId) {
  getDb().prepare('DELETE FROM sessions WHERE project_id = ? AND session_id = ?').run(projectId, sessionId);
}

export function listSessionIds(projectId) {
  return getDb().prepare(
    'SELECT session_id FROM sessions WHERE project_id = ? ORDER BY updated_at DESC',
  ).all(projectId).map((r) => r.session_id);
}

export function saveSessionIndex(projectId, index) {
  const updated_at = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO session_index (project_id, index_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET index_json = excluded.index_json, updated_at = excluded.updated_at
  `).run(projectId, JSON.stringify(index), updated_at);
}

export function loadSessionIndex(projectId) {
  const row = getDb().prepare('SELECT index_json FROM session_index WHERE project_id = ?').get(projectId);
  if (!row) return null;
  try {
    return JSON.parse(row.index_json);
  } catch {
    return null;
  }
}

export function saveSessionArchive(projectId, sessionId, archive) {
  getDb().prepare(`
    INSERT INTO session_archive (project_id, session_id, data_json) VALUES (?, ?, ?)
    ON CONFLICT(project_id, session_id) DO UPDATE SET data_json = excluded.data_json
  `).run(projectId, sessionId, JSON.stringify(archive));
}

export function loadSessionArchive(projectId, sessionId) {
  const row = getDb().prepare(
    'SELECT data_json FROM session_archive WHERE project_id = ? AND session_id = ?',
  ).get(projectId, sessionId);
  if (!row) return { messages: [] };
  try {
    return JSON.parse(row.data_json);
  } catch {
    return { messages: [] };
  }
}

export function saveProjectMeta(meta) {
  getDb().prepare(`
    INSERT INTO projects (id, meta_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET meta_json = excluded.meta_json, updated_at = excluded.updated_at
  `).run(meta.id, JSON.stringify(meta), meta.updated_at || new Date().toISOString());
}

export function loadProjectMeta(projectId) {
  const row = getDb().prepare('SELECT meta_json FROM projects WHERE id = ?').get(projectId);
  if (!row) return null;
  try {
    return JSON.parse(row.meta_json);
  } catch {
    return null;
  }
}

export function listProjectMetas() {
  return getDb().prepare('SELECT meta_json FROM projects ORDER BY updated_at DESC').all()
    .map((r) => {
      try { return JSON.parse(r.meta_json); } catch { return null; }
    })
    .filter(Boolean);
}

export function deleteProjectRow(projectId) {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  getDb().prepare('DELETE FROM sessions WHERE project_id = ?').run(projectId);
  getDb().prepare('DELETE FROM session_index WHERE project_id = ?').run(projectId);
  getDb().prepare('DELETE FROM session_archive WHERE project_id = ?').run(projectId);
  deleteProjectEngineData(projectId);
}
