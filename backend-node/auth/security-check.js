import { isDefaultAdminPassword, isDefaultJwtSecret } from './constants.js';
import { getCorsOrigins, isProduction, isRegisterAllowed } from './env.js';

export function assertProductionSecurity() {
  const production = isProduction();

  if (!production) {
    if (isDefaultJwtSecret()) {
      console.warn('  [auth] 警告：正在使用默认 JWT Secret，仅限本地开发。');
      console.warn('  [auth] 生产环境请设置 STUDIO_JWT_SECRET。');
    }
    console.warn('  [auth] 内置管理员账号见 auth/constants.js；密码以 scrypt 哈希存入 studio.db。');
    return;
  }

  if (isDefaultJwtSecret()) {
    console.error('\n  [auth] 生产模式必须设置 STUDIO_JWT_SECRET（不可使用开发默认值）\n');
    process.exit(1);
  }

  if (isDefaultAdminPassword()) {
    console.warn('  [auth] 警告：生产环境仍使用内置默认管理员密码。');
    console.warn('  [auth] 请设置 STUDIO_ADMIN_PASSWORD 或在首次登录后立即改密。');
  }

  if (!getCorsOrigins().length) {
    console.warn('  [auth] 警告：未设置 STUDIO_CORS_ORIGIN，跨域请求将被拒绝（同域访问不受影响）。');
  }

  if (isRegisterAllowed()) {
    console.warn('  [auth] 警告：生产环境已开放注册（STUDIO_ALLOW_REGISTER=1）。');
  }
}
