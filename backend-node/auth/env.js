/** Shared production / deployment flags */

export function isProduction() {
  return process.env.STUDIO_PRODUCTION === '1'
    || process.env.NODE_ENV === 'production';
}

/** Dev: open unless STUDIO_ALLOW_REGISTER=0. Production: closed unless =1 */
export function isRegisterAllowed() {
  const flag = process.env.STUDIO_ALLOW_REGISTER;
  if (flag === '1') return true;
  if (flag === '0') return false;
  return !isProduction();
}

export function getCorsOrigins() {
  return String(process.env.STUDIO_CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
