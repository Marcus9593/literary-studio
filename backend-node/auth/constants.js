/** 内置超级管理员 ID（不可删除） */
export const SUPER_ADMIN_ID = '__super_admin__';

/**
 * 内置超级管理员账号（写在代码中，首次启动写入 studio.db）。
 * 数据库内仅存 scrypt 单向哈希，不保存明文密码。
 */
export const BUILTIN_ADMIN = Object.freeze({
  username: 'admin',
  password: 'admin123',
});

/** 可通过环境变量覆盖内置账号（可选） */
export const DEFAULT_ADMIN_USERNAME = process.env.STUDIO_ADMIN_USER || BUILTIN_ADMIN.username;

/** 可通过环境变量覆盖内置密码（可选）；入库前一律 scrypt 哈希 */
export const DEFAULT_ADMIN_PASSWORD = process.env.STUDIO_ADMIN_PASSWORD || BUILTIN_ADMIN.password;

export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DEV_JWT_SECRET = 'literary-studio-dev-secret-change-in-production';

export const JWT_SECRET = process.env.STUDIO_JWT_SECRET || DEV_JWT_SECRET;

export function isDefaultJwtSecret() {
  return !process.env.STUDIO_JWT_SECRET
    || JWT_SECRET === DEV_JWT_SECRET;
}

export function isDefaultAdminPassword() {
  return DEFAULT_ADMIN_PASSWORD === BUILTIN_ADMIN.password
    && !process.env.STUDIO_ADMIN_PASSWORD;
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  USER: 'user',
};

export const SHARE_ROLES = {
  READ: 'read',
  WRITE: 'write',
};
