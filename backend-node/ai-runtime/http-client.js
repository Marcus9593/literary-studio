/** Shared HTTP helpers for model API calls (OpenAI-compatible + Anthropic). */

export function buildUrl(baseUrl, endpoint) {
  const base = String(baseUrl || '').trim();
  if (!base) throw new Error('Base URL 不能为空');
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/\/+$/, '')}${endpoint}`;
  }
  throw new Error('Base URL 格式无效');
}

export function authHeaderVariants(apiKey, protocol) {
  const variants = [];
  if (protocol === 'anthropic') {
    variants.push({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    });
  }
  variants.push({ 'Content-Type': 'application/json', 'api-key': apiKey });
  variants.push({ 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` });
  if (protocol === 'anthropic') {
    variants.push({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'api-key': apiKey,
    });
  }
  return variants;
}

export function isContentModerationText(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t.length <= 280 && /high risk|content_filter|moderation block|considered high risk/i.test(t)) {
    return true;
  }
  if (/rejected because it was considered/i.test(t)) return true;
  if (/^421\b/.test(t) || /内容.*(?:风控|审核|拦截)|敏感内容|安全策略/i.test(t)) return true;
  return false;
}

export function formatModerationError(data) {
  const code = String(data?.error?.code || data?.code || '').trim();
  const type = String(data?.error?.type || data?.type || '').trim();
  if (code === '421' || type === 'content_filter' || isContentModerationText(data?.error?.message)) {
    return [
      '模型平台内容安全策略拦截了本次请求（MiMo 等平台常见，长对话/文稿上下文更容易误拦）。',
      '建议：① 用更短、更中性的表述重试（如「写第3章大纲」而非附带长上下文）；',
      '② 写正文优先用工作台「写作方案」按钮；',
      '③ 在设置页切换协议（OpenAI / Anthropic）或改用 Claude Code CLI；',
      '④ 若确认无违规内容，可联系 MiMo 平台申诉误拦。',
    ].join('');
  }
  return '';
}

export function formatModelTestError(err, data) {
  const moderation = formatModerationError(data);
  if (moderation) return moderation;

  const msg = String(data?.error?.message || data?.message || err?.message || '').trim();
  if (isContentModerationText(msg)) return formatModerationError({ error: { message: msg } });

  if (/invalid api key|incorrect api key|unauthorized|401/i.test(msg)) {
    return 'API Key 无效或未授权，请核对密钥是否正确';
  }
  if (/failed to fetch|fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(msg)) {
    return '无法连接模型 API，请检查 Base URL 是否正确、本机网络是否可达';
  }
  if (String(err?.name || '') === 'AbortError') return '模型测试超时（15s），请稍后重试';
  return msg || '模型连接测试失败';
}

export async function postWithAuth(url, payload, apiKey, protocol, signal) {
  let last = { res: null, data: {} };
  for (const headers of authHeaderVariants(apiKey, protocol)) {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status !== 401) return { res, data };
    last = { res, data };
  }
  return last;
}

/** POST with first working auth header; returns raw Response for streaming. */
export async function postStreamWithAuth(url, payload, apiKey, protocol, signal) {
  let lastRes = null;
  for (const headers of authHeaderVariants(apiKey, protocol)) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal,
    });
    if (res.status !== 401) return res;
    lastRes = res;
  }
  return lastRes;
}

/** Parse SSE stream from a fetch Response body. */
export async function* parseSseStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() || '';

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') return;
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            yield JSON.parse(jsonStr);
          } catch {}
        } else if (trimmed.startsWith('event:')) {
          // paired with next data line — buffer handled by data branch
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
