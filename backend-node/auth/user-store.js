import crypto from 'crypto';
import { getDb } from '../storage/sqlite/db.js';
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  ROLES,
  SUPER_ADMIN_ID,
} from './constants.js';
import { storePassword, isPasswordHash, verifyPassword } from './password.js';
import {
  listUsersFromDb,
  findUserByIdFromDb,
  findUserByUsernameFromDb,
  insertUser,
  updateUserRow,
  deleteUserRow,
} from '../storage/sqlite/repos/user-repo.js';

function now() {
  return new Date().toISOString();
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
    disabled: Boolean(user.disabled),
  };
}

function ensureDb() {
  getDb();
}

export function migrateLegacyAdminRoles() {
  ensureDb();
  for (const user of listUsersFromDb()) {
    if (user.role === 'admin') {
      updateUserRow(user.id, { role: ROLES.USER });
    }
  }
}

export function ensureSuperAdmin() {
  ensureDb();
  let admin = findUserByIdFromDb(SUPER_ADMIN_ID);
  if (!admin) {
    admin = insertUser({
      id: SUPER_ADMIN_ID,
      username: DEFAULT_ADMIN_USERNAME,
      display_name: '超级管理员',
      role: ROLES.SUPER_ADMIN,
      password_hash: storePassword(DEFAULT_ADMIN_PASSWORD),
      created_at: now(),
      updated_at: now(),
      disabled: false,
      builtin: true,
    });
    console.log(`  [auth] 已创建内置超级管理员 ${DEFAULT_ADMIN_USERNAME}（密码 scrypt 哈希已写入 studio.db）`);
  } else if (admin.builtin && !isPasswordHash(admin.password_hash)) {
    updateUserRow(SUPER_ADMIN_ID, {
      password_hash: storePassword(DEFAULT_ADMIN_PASSWORD),
    });
    console.log('  [auth] 已修复内置超级管理员密码哈希格式');
  }
  return admin;
}

export function listUsers() {
  ensureDb();
  return listUsersFromDb().map(publicUser);
}

export function findUserById(id) {
  ensureDb();
  return findUserByIdFromDb(id);
}

export function findUserByUsername(username) {
  ensureDb();
  return findUserByUsernameFromDb(username);
}

export function authenticate(username, password) {
  const user = findUserByUsername(username);
  if (!user || user.disabled) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return publicUser(user);
}

function assertValidCredentials(username, password) {
  const name = String(username || '').trim();
  if (!name) throw new Error('用户名不能为空');
  if (name.length < 2) throw new Error('用户名至少 2 个字符');
  if (!password || String(password).length < 6) throw new Error('密码至少 6 位');
  if (name.toLowerCase() === DEFAULT_ADMIN_USERNAME.toLowerCase()) {
    throw new Error('该用户名为系统保留');
  }
  return name;
}

export function registerUser({ username, password, display_name }) {
  ensureDb();
  const name = assertValidCredentials(username, password);
  if (findUserByUsername(name)) throw new Error('用户名已存在');

  const user = insertUser({
    id: crypto.randomUUID().slice(0, 12),
    username: name,
    display_name: String(display_name || name).trim() || name,
    role: ROLES.USER,
    password_hash: storePassword(password),
    created_at: now(),
    updated_at: now(),
    disabled: false,
    builtin: false,
  });

  return publicUser(user);
}

export function createUser({ username, password, display_name }) {
  return registerUser({ username, password, display_name });
}

export function updateUser(userId, patch = {}) {
  ensureDb();
  const user = findUserByIdFromDb(userId);
  if (!user) throw new Error('用户不存在');
  if (user.id === SUPER_ADMIN_ID && patch.role && patch.role !== ROLES.SUPER_ADMIN) {
    throw new Error('无法修改超级管理员角色');
  }

  const next = { ...user };
  if (patch.display_name !== undefined) {
    next.display_name = String(patch.display_name || user.username).trim() || user.username;
  }
  if (patch.password) {
    if (String(patch.password).length < 6) throw new Error('密码至少 6 位');
    next.password_hash = storePassword(patch.password);
  }
  if (patch.disabled !== undefined && user.id !== SUPER_ADMIN_ID) {
    next.disabled = Boolean(patch.disabled);
  }
  if (patch.role !== undefined && user.id !== SUPER_ADMIN_ID) {
    throw new Error('仅支持普通用户与超级管理员两种角色');
  }

  const updated = updateUserRow(userId, next);
  return publicUser(updated);
}

export function deleteUser(userId) {
  ensureDb();
  if (userId === SUPER_ADMIN_ID) throw new Error('无法删除超级管理员');
  if (!deleteUserRow(userId)) throw new Error('用户不存在');
  return { status: 'deleted' };
}

export function getUserInternal(userId) {
  ensureDb();
  return findUserByIdFromDb(userId);
}
