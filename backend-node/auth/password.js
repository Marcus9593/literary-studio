import crypto from 'crypto';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** 是否为 scrypt 加密哈希（入库格式） */
export function isPasswordHash(stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  return parts.length === 3 && parts[0] === 'scrypt' && parts[1].length >= 32 && parts[2].length >= 64;
}

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, 64, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** 明文密码 → scrypt 哈希（写入 SQLite 前调用） */
export function storePassword(plain) {
  return hashPassword(plain);
}

export function verifyPassword(plain, stored) {
  if (!isPasswordHash(stored)) return false;
  const parts = stored.split('$');
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(plain), salt, 64, SCRYPT_PARAMS);
  return crypto.timingSafeEqual(expected, actual);
}
