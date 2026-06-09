import { getDb } from '../db.js';
import { isPasswordHash, storePassword } from '../../../auth/password.js';

function now() {
  return new Date().toISOString();
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    password_hash: row.password_hash,
    disabled: Boolean(row.disabled),
    builtin: Boolean(row.builtin),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listUsersFromDb() {
  return getDb().prepare(
    'SELECT * FROM users ORDER BY builtin DESC, created_at ASC',
  ).all().map(rowToUser);
}

export function findUserByIdFromDb(id) {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  return rowToUser(row);
}

export function findUserByUsernameFromDb(username) {
  const name = String(username || '').trim();
  if (!name) return null;
  const row = getDb().prepare(
    'SELECT * FROM users WHERE LOWER(username) = LOWER(?)',
  ).get(name);
  return rowToUser(row);
}

function assertPasswordHash(value) {
  if (!isPasswordHash(value)) {
    throw new Error('password_hash 必须为 scrypt 加密哈希，禁止明文写入数据库');
  }
}

export function insertUser(user) {
  assertPasswordHash(user.password_hash);
  const ts = user.created_at || now();
  getDb().prepare(`
    INSERT INTO users (
      id, username, display_name, role, password_hash,
      disabled, builtin, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.username,
    user.display_name || user.username,
    user.role,
    user.password_hash,
    user.disabled ? 1 : 0,
    user.builtin ? 1 : 0,
    ts,
    user.updated_at || ts,
  );
  return findUserByIdFromDb(user.id);
}

export function updateUserRow(userId, patch) {
  const existing = findUserByIdFromDb(userId);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch,
    updated_at: now(),
  };
  assertPasswordHash(updated.password_hash);
  getDb().prepare(`
    UPDATE users SET
      username = ?,
      display_name = ?,
      role = ?,
      password_hash = ?,
      disabled = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    updated.username,
    updated.display_name,
    updated.role,
    updated.password_hash,
    updated.disabled ? 1 : 0,
    updated.updated_at,
    userId,
  );
  return findUserByIdFromDb(userId);
}

export function deleteUserRow(userId) {
  const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
  return result.changes > 0;
}

export function countUsers() {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM users').get();
  return row?.n || 0;
}
