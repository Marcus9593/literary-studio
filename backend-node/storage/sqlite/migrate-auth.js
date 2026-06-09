import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, kvGet, kvSet } from './db.js';
import { countUsers, insertUser, listUsersFromDb, updateUserRow } from './repos/user-repo.js';
import { isPasswordHash, storePassword } from '../../auth/password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.LITERARY_STUDIO_DATA
  || path.resolve(__dirname, '../../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MIGRATION_KEY = 'auth_users_sqlite_v1';

export function migrateUsersToSqlite() {
  getDb();
  if (kvGet(MIGRATION_KEY)) {
    return { migrated: false, already: true };
  }

  if (countUsers() > 0) {
    kvSet(MIGRATION_KEY, { at: new Date().toISOString(), source: 'existing_db' });
    return { migrated: false, already: true };
  }

  if (!fs.existsSync(USERS_FILE)) {
    kvSet(MIGRATION_KEY, { at: new Date().toISOString(), source: 'empty' });
    return { migrated: false, empty: true };
  }

  let store;
  try {
    store = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    kvSet(MIGRATION_KEY, { at: new Date().toISOString(), source: 'invalid_json' });
    return { migrated: false, error: 'invalid users.json' };
  }

  const users = store.users || [];
  for (const u of users) {
    if (!u.id || !u.username) continue;
    let passwordHash = u.password_hash;
    if (!isPasswordHash(passwordHash)) {
      if (!passwordHash && u.password) {
        passwordHash = storePassword(u.password);
      } else if (passwordHash && passwordHash.length < 80) {
        passwordHash = storePassword(passwordHash);
      } else {
        continue;
      }
    }
    insertUser({
      id: u.id,
      username: u.username,
      display_name: u.display_name || u.username,
      role: u.role || 'user',
      password_hash: passwordHash,
      disabled: Boolean(u.disabled),
      builtin: Boolean(u.builtin),
      created_at: u.created_at,
      updated_at: u.updated_at,
    });
  }

  const backup = `${USERS_FILE}.bak`;
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(USERS_FILE, backup);
  }

  kvSet(MIGRATION_KEY, {
    at: new Date().toISOString(),
    source: 'users.json',
    count: users.length,
  });

  console.log(`  [auth] 已从 users.json 迁移 ${users.length} 个用户至 studio.db`);
  return { migrated: true, count: users.length };
}

/** 启动时把库内非 scrypt 格式的 password_hash 转为 scrypt 哈希 */
export function repairPasswordHashesInDb() {
  getDb();
  let fixed = 0;
  for (const user of listUsersFromDb()) {
    if (isPasswordHash(user.password_hash)) continue;
    const plain = String(user.password_hash || '').trim();
    if (!plain || plain.length > 128) continue;
    updateUserRow(user.id, { password_hash: storePassword(plain) });
    fixed += 1;
  }
  if (fixed > 0) {
    console.log(`  [auth] 已将 ${fixed} 个用户的明文密码转为 scrypt 哈希`);
  }
  return { fixed };
}
