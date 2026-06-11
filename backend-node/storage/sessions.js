import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  ARCHIVE_KEEP_MESSAGES,
  MAX_SESSION_MESSAGES,
  buildHeuristicMemorySummary,
  shouldRefreshMemory,
} from '../conversation-memory.js';
import { workspacePath } from './projects.js';
import { loadChatHistory } from './chat.js';
import { now, readJSON, writeJSON, sqlAdapter } from './core.js';

// ── Sessions ──

function sessionsDir(projectId) {
  return path.join(workspacePath(projectId), '.webnovel', 'sessions');
}

function sessionIndexPath(projectId) {
  return path.join(sessionsDir(projectId), 'index.json');
}

function sessionFilePath(projectId, sessionId) {
  return path.join(sessionsDir(projectId), `${sessionId}.json`);
}

function sessionArchivePath(projectId, sessionId) {
  return path.join(sessionsDir(projectId), `${sessionId}.archive.json`);
}

/** 全书级会话标记（非某一章正文） */
export const SESSION_SCOPE_PROJECT = '__project__';

function normalizeSession(session) {
  if (!session) return session;
  session.memory_summary = session.memory_summary || '';
  session.memory_updated_at = session.memory_updated_at || null;
  session.memory_message_count = session.memory_message_count || 0;
  session.claude_session_id = session.claude_session_id || null;
  session.context_notes = Array.isArray(session.context_notes) ? session.context_notes : [];
  if (session.bound_filename === undefined) session.bound_filename = null;
  return session;
}

function sessionIndexEntry(session) {
  return {
    id: session.id,
    title: session.title,
    created_at: session.created_at,
    updated_at: session.updated_at,
    message_count: session.messages?.length ?? session.message_count ?? 0,
    bound_filename: session.bound_filename || null,
  };
}

function isProjectScopeSession(entry) {
  return !entry?.bound_filename || entry.bound_filename === SESSION_SCOPE_PROJECT;
}

function archiveOverflowMessages(session, projectId, sessionId) {
  if (!session.messages || session.messages.length <= MAX_SESSION_MESSAGES) return session;

  const overflow = session.messages.length - ARCHIVE_KEEP_MESSAGES;
  const toArchive = session.messages.slice(0, overflow);
  session.messages = session.messages.slice(overflow);

  const archivePath = sessionArchivePath(projectId, sessionId);
  let archive = { messages: [] };
  try {
    if (fs.existsSync(archivePath)) {
      archive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
    }
  } catch {}
  archive.messages = [...(archive.messages || []), ...toArchive];
  writeJSON(archivePath, archive);
  if (sqlAdapter.useSqlite()) {
    sqlAdapter.writeArchiveData(projectId, sessionId, archive, writeJSON, sessionArchivePath);
  }
  return session;
}

export function updateSessionFields(projectId, sessionId, patch = {}) {
  const session = getSessionWithMessages(projectId, sessionId);
  Object.assign(session, patch);
  session.updated_at = now();
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);
  return session;
}

export function removeLastSessionMessage(projectId, sessionId, role = null) {
  const session = getSessionWithMessages(projectId, sessionId);
  if (!session.messages.length) return session;

  if (role) {
    const last = session.messages[session.messages.length - 1];
    if (last.role !== role) return session;
  }
  session.messages.pop();
  session.updated_at = now();
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  const index = readSessionIndex(projectId);
  if (index) {
    const entry = index.sessions.find((s) => s.id === sessionId);
    if (entry) {
      entry.message_count = session.messages.length;
      entry.updated_at = session.updated_at;
    }
    writeSessionIndex(projectId, index);
  }
  return session;
}

export function refreshSessionMemory(projectId, sessionId) {
  let session;
  try {
    session = getSessionWithMessages(projectId, sessionId);
  } catch {
    return null;
  }
  const count = session.messages?.length || 0;
  if (!shouldRefreshMemory(count, session.memory_message_count || 0)) return session;

  session.memory_summary = buildHeuristicMemorySummary(
    session.messages,
    session.memory_summary,
  );
  session.memory_updated_at = now();
  session.memory_message_count = count;
  session.updated_at = now();
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);
  return session;
}

export function getSessionArchive(projectId, sessionId) {
  return sqlAdapter.readArchiveData(projectId, sessionId, readJSON, sessionArchivePath);
}

function readSessionIndex(projectId) {
  return sqlAdapter.readIndexData(projectId, readJSON, sessionIndexPath);
}

function writeSessionIndex(projectId, index) {
  sqlAdapter.writeIndexData(projectId, index, writeJSON, sessionIndexPath);
}

function migrateLegacyChat(projectId) {
  const legacy = loadChatHistory(projectId);
  const id = randomUUID().slice(0, 12);
  const ts = now();
  const firstMsg = legacy.find(m => m.role === 'user');
  const title = firstMsg ? firstMsg.content.slice(0, 20) : '默认会话';

  const session = {
    id,
    title,
    messages: legacy,
    created_at: ts,
    updated_at: ts,
    memory_summary: '',
    memory_updated_at: null,
    memory_message_count: legacy.length,
    claude_session_id: null,
    context_notes: [],
  };
  const dir = sessionsDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  writeJSON(sessionFilePath(projectId, id), session);
  if (sqlAdapter.useSqlite()) sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  const index = {
    active_session_id: id,
    sessions: [{ id, title, created_at: ts, updated_at: ts, message_count: legacy.length }],
  };
  writeSessionIndex(projectId, index);

  // Rename legacy file
  const legacyPath = chatPath(projectId);
  try { fs.renameSync(legacyPath, legacyPath + '.bak'); } catch {}
  return index;
}

export function listSessions(projectId) {
  let index = readSessionIndex(projectId);
  if (!index) {
    index = migrateLegacyChat(projectId);
  }
  return index;
}

export function createSession(projectId, title, options = {}) {
  let index = readSessionIndex(projectId);
  if (!index) index = { active_session_id: '', sessions: [] };

  const id = randomUUID().slice(0, 12);
  const ts = now();
  const sessionTitle = title || '新会话';
  const boundFilename = options.bound_filename ?? null;
  const session = {
    id,
    title: sessionTitle,
    messages: [],
    created_at: ts,
    updated_at: ts,
    memory_summary: '',
    memory_updated_at: null,
    memory_message_count: 0,
    claude_session_id: null,
    context_notes: [],
    bound_filename: boundFilename,
  };

  fs.mkdirSync(sessionsDir(projectId), { recursive: true });
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  index.sessions.unshift(sessionIndexEntry(session));
  index.active_session_id = id;
  writeSessionIndex(projectId, index);
  return normalizeSession(session);
}

export function deleteSessionsForManuscript(projectId, filename) {
  const safe = path.basename(String(filename || ''));
  if (!safe) return;
  const index = readSessionIndex(projectId);
  if (!index?.sessions?.length) return;
  const toRemove = index.sessions.filter((s) => s.bound_filename === safe);
  for (const entry of toRemove) {
    try { fs.unlinkSync(sessionFilePath(projectId, entry.id)); } catch {}
    try { fs.unlinkSync(sessionArchivePath(projectId, entry.id)); } catch {}
  }
  index.sessions = index.sessions.filter((s) => s.bound_filename !== safe);
  if (toRemove.some((s) => s.id === index.active_session_id)) {
    index.active_session_id = index.sessions[0]?.id || '';
  }
  writeSessionIndex(projectId, index);
}

export function focusChapterSession(projectId, filename, chapterTitle = '') {
  const safe = path.basename(String(filename || ''));
  if (!safe) throw new Error('缺少文稿文件名');
  const index = listSessions(projectId);
  let entry = index.sessions.find((s) => s.bound_filename === safe);
  if (entry) {
    setActiveSession(projectId, entry.id);
    return { session: getSessionWithMessages(projectId, entry.id), ...listSessions(projectId) };
  }
  const title = chapterTitle
    ? `本章 · ${String(chapterTitle).slice(0, 24)}`
    : `本章 · ${safe.replace(/\.md$/i, '')}`;
  const session = createSession(projectId, title, { bound_filename: safe });
  return { session, ...listSessions(projectId) };
}

export function focusProjectSession(projectId) {
  let index = listSessions(projectId);
  let entry = index.sessions.find((s) => isProjectScopeSession(s));
  if (!entry) {
    createSession(projectId, '全书讨论', { bound_filename: SESSION_SCOPE_PROJECT });
    index = listSessions(projectId);
    entry = index.sessions.find((s) => s.bound_filename === SESSION_SCOPE_PROJECT)
      || index.sessions.find((s) => isProjectScopeSession(s));
  }
  if (entry) setActiveSession(projectId, entry.id);
  index = listSessions(projectId);
  const sid = index.active_session_id;
  return {
    session: sid ? getSessionWithMessages(projectId, sid) : null,
    ...index,
  };
}

export function getSessionWithMessages(projectId, sessionId) {
  const session = sqlAdapter.readSessionData(projectId, sessionId, readJSON, sessionFilePath);
  if (!session) throw new Error(`会话不存在: ${sessionId}`);
  return normalizeSession(session);
}

export function getActiveSessionId(projectId) {
  const index = listSessions(projectId);
  return index.active_session_id || index.sessions[0]?.id || '';
}

export function setActiveSession(projectId, sessionId) {
  const index = listSessions(projectId);
  if (!index.sessions.find(s => s.id === sessionId)) throw new Error(`会话不存在: ${sessionId}`);
  index.active_session_id = sessionId;
  writeSessionIndex(projectId, index);
  return index;
}

export function appendSessionMessage(projectId, sessionId, role, content, extra = {}) {
  const session = getSessionWithMessages(projectId, sessionId);
  const ts = now();
  session.messages.push({ id: randomUUID().slice(0, 12), role, content, at: ts, ...extra });
  archiveOverflowMessages(session, projectId, sessionId);
  session.updated_at = ts;

  const index = readSessionIndex(projectId);
  if (index) {
    const entry = index.sessions.find(s => s.id === sessionId);
    if (entry) {
      entry.updated_at = ts;
      entry.message_count = session.messages.length;
      if (entry.title === '新会话' && role === 'user') {
        entry.title = content.slice(0, 20);
        session.title = entry.title;
      }
    }
    index.sessions.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    writeSessionIndex(projectId, index);
  }

  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);
  return session;
}

export function deleteSession(projectId, sessionId) {
  const p = sessionFilePath(projectId, sessionId);
  try { fs.unlinkSync(p); } catch {}

  const index = readSessionIndex(projectId);
  if (index) {
    index.sessions = index.sessions.filter(s => s.id !== sessionId);
    if (index.active_session_id === sessionId) {
      index.active_session_id = index.sessions[0]?.id || '';
    }
    writeSessionIndex(projectId, index);
  }
  return index;
}

export function renameSession(projectId, sessionId, title) {
  const session = getSessionWithMessages(projectId, sessionId);
  session.title = title;
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  const index = readSessionIndex(projectId);
  if (index) {
    const entry = index.sessions.find(s => s.id === sessionId);
    if (entry) entry.title = title;
    writeSessionIndex(projectId, index);
  }
  return session;
}

export function clearSessionMessages(projectId, sessionId) {
  const session = getSessionWithMessages(projectId, sessionId);
  session.messages = [];
  session.memory_summary = '';
  session.memory_updated_at = null;
  session.memory_message_count = 0;
  session.claude_session_id = null;
  session.claude_bound_model_id = null;
  session.context_notes = [];
  session.updated_at = now();
  sqlAdapter.writeSessionData(projectId, session, writeJSON, sessionFilePath);

  const archivePath = sessionArchivePath(projectId, sessionId);
  try { fs.unlinkSync(archivePath); } catch {}
  if (sqlAdapter.useSqlite()) {
    sqlAdapter.writeArchiveData(projectId, sessionId, { messages: [] }, writeJSON, sessionArchivePath);
  }

  const index = readSessionIndex(projectId);
  if (index) {
    const entry = index.sessions.find(s => s.id === sessionId);
    if (entry) { entry.message_count = 0; entry.updated_at = session.updated_at; }
    writeSessionIndex(projectId, index);
  }
  return session;
}