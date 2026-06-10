import fs from 'fs';
import {
  sqliteEnabled,
  kvGet,
  kvSet,
  KV_KEYS,
  saveSession,
  loadSession,
  saveSessionIndex,
  loadSessionIndex,
  saveSessionArchive,
  loadSessionArchive,
  saveProjectMeta,
} from './migrate.js';

export function useSqlite() {
  return sqliteEnabled();
}

export function readKv(key, filePath, fallback, readJSON) {
  if (!useSqlite()) return readJSON(filePath, fallback);
  // kvGet default fallback is null; passing `undefined` still triggers that default in JS.
  const v = kvGet(key);
  if (v != null) return v;
  const fromFile = readJSON(filePath, fallback);
  if (fromFile != null && fromFile !== fallback) kvSet(key, fromFile);
  return fromFile ?? fallback;
}

export function writeKv(key, filePath, data, writeJSON) {
  writeJSON(filePath, data);
  if (useSqlite()) kvSet(key, data);
}

export function readSessionData(projectId, sessionId, readJSON, sessionFilePath) {
  if (useSqlite()) {
    const s = loadSession(projectId, sessionId);
    if (s) return s;
  }
  return readJSON(sessionFilePath(projectId, sessionId), null);
}

export function writeSessionData(projectId, session, writeJSON, sessionFilePath) {
  writeJSON(sessionFilePath(projectId, session.id), session);
  if (useSqlite()) saveSession(projectId, session.id, session);
}

export function readIndexData(projectId, readJSON, sessionIndexPath) {
  if (useSqlite()) {
    const idx = loadSessionIndex(projectId);
    if (idx) return idx;
  }
  return readJSON(sessionIndexPath(projectId), null);
}

export function writeIndexData(projectId, index, writeJSON, sessionIndexPath) {
  writeJSON(sessionIndexPath(projectId), index);
  if (useSqlite()) saveSessionIndex(projectId, index);
}

export function readArchiveData(projectId, sessionId, readJSON, archivePath) {
  if (useSqlite()) {
    const a = loadSessionArchive(projectId, sessionId);
    if (a?.messages) return a;
  }
  return readJSON(archivePath(projectId, sessionId), { messages: [] });
}

export function writeArchiveData(projectId, sessionId, archive, writeJSON, archivePath) {
  writeJSON(archivePath(projectId, sessionId), archive);
  if (useSqlite()) saveSessionArchive(projectId, sessionId, archive);
}

export function syncProjectMeta(meta) {
  if (useSqlite() && meta?.id) saveProjectMeta(meta);
}

export { KV_KEYS };
