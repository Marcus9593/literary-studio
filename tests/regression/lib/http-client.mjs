import { getConfig } from './config.mjs';

export function createApiClient(config = getConfig()) {
  const apiBase = `${config.baseUrl}/api`;

  async function request(path, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else {
      data = { _raw: await res.text() };
    }

    return { status: res.status, ok: res.ok, data };
  }

  async function login() {
    const { status, data } = await request('/auth/login', {
      method: 'POST',
      body: { username: config.adminUser, password: config.adminPassword },
    });
    if (status !== 200 || !data?.token) {
      throw new Error(`登录失败: ${status} ${JSON.stringify(data)}`);
    }
    return data.token;
  }

  return { request, login, config };
}
