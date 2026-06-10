/** Shared env for HTTP regression suites (against running Studio instance). */

export function getConfig() {
  return {
    baseUrl: (process.env.BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, ''),
    adminUser: process.env.STUDIO_ADMIN_USER || process.env.ADMIN_USER || 'admin',
    adminPassword: process.env.STUDIO_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123',
    mimo: {
      baseUrl: process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
      apiKey: process.env.MIMO_API_KEY || '',
      model: process.env.MIMO_MODEL || 'mimo-v2.5-pro',
    },
  };
}

export function maskSecret(value) {
  const t = String(value || '');
  return t.length > 8 ? `${t.slice(0, 4)}…${t.slice(-4)}` : '****';
}
