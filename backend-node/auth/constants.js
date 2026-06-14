/** 内置超级管理员 ID（不可删除） */
export const SUPER_ADMIN_ID = '__super_admin__';

/**
 * 内置超级管理员账号（写在代码中，首次启动写入 studio.db）。
 * 数据库内仅存 scrypt 单向哈希，不保存明文密码。
 *
 * ⚠️ 安全提示：生产环境必须通过环境变量覆盖默认密码！
 *    设置 STUDIO_ADMIN_PASSWORD 环境变量为强密码。
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

/**
 * JWT 签名密钥。
 *
 * ⚠️ 安全提示：生产环境必须设置 STUDIO_JWT_SECRET 环境变量！
 *    使用随机生成的强密钥，例如：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *    不设置此变量将导致任何人可伪造 token，绕过所有权限检查。
 */
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

/**
 * 检查安全配置并在控制台输出警告。
 * 应在服务启动时调用。
 */
export function checkSecurityConfig() {
  const warnings = [];
  if (isDefaultJwtSecret()) {
    warnings.push('⚠️  JWT 密钥使用默认值！生产环境请设置 STUDIO_JWT_SECRET 环境变量。');
  }
  if (isDefaultAdminPassword()) {
    warnings.push('⚠️  管理员使用默认密码！生产环境请设置 STUDIO_ADMIN_PASSWORD 环境变量。');
  }
  if (warnings.length > 0) {
    console.warn('\n' + '='.repeat(60));
    console.warn('安全配置警告:');
    warnings.forEach((w) => console.warn(`  ${w}`));
    console.warn('='.repeat(60) + '\n');
  }
  return warnings;
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  USER: 'user',
};

export const SHARE_ROLES = {
  READ: 'read',
  WRITE: 'write',
};
