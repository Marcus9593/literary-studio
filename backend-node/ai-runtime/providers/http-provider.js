import {
  buildUrl,
  formatModelTestError,
  formatModerationError,
  isContentModerationText,
  isDeepSeekAnthropicUrl,
  postStreamWithAuth,
  postWithAuth,
  parseSseStream,
} from '../http-client.js';
import { stripModelToolArtifacts } from '../output-sanitize.js';

export const id = 'http';

const DEFAULT_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 8192);

function resolveMessages(request) {
  if (Array.isArray(request.messages) && request.messages.length) {
    return request.messages;
  }
  const prompt = String(request.prompt || '').trim();
  if (!prompt) throw new Error('缺少 prompt 或 messages');
  return [{ role: 'user', content: prompt }];
}

async function readErrorBody(res) {
  try {
    return await res.json();
  } catch {
    try {
      const text = await res.text();
      return text ? { message: text } : {};
    } catch {
      return {};
    }
  }
}

function throwForHttpError(res, data) {
  const moderation = formatModerationError(data);
  if (res.status === 421 || res.status === 403 || moderation) {
    throw new Error(moderation || formatModelTestError(null, data));
  }
  throw new Error(formatModelTestError(null, data, res));
}

async function* streamOpenAI(cfg, request, signal) {
  const url = buildUrl(cfg.base_url, '/chat/completions');
  const messages = resolveMessages(request);
  const res = await postStreamWithAuth(
    url,
    {
      model: cfg.model,
      messages,
      stream: true,
      max_tokens: DEFAULT_MAX_TOKENS,
    },
    cfg.api_key,
    'openai',
    signal,
  );

  if (!res.ok) {
    const data = await readErrorBody(res);
    throwForHttpError(res, data);
  }
  if (!res.body) throw new Error('模型 API 未返回流式响应');

  let accumulated = '';
  for await (const chunk of parseSseStream(res.body)) {
    const text = chunk?.choices?.[0]?.delta?.content;
    if (text) {
      accumulated += text;
      if (isContentModerationText(accumulated)) {
        throw new Error(formatModerationError({ error: { message: accumulated } }));
      }
      const clean = stripModelToolArtifacts(text);
      if (clean) yield { type: 'content', text: clean };
    }
    const err = chunk?.error?.message;
    if (err) throw new Error(formatModelTestError(null, { error: { message: err } }));
  }
}

async function* streamAnthropic(cfg, request, signal) {
  const url = buildUrl(cfg.base_url, '/v1/messages');
  const raw = resolveMessages(request);
  const systemParts = raw.filter((m) => m.role === 'system').map((m) => m.content);
  const messages = raw.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const payload = {
    model: cfg.model,
    max_tokens: DEFAULT_MAX_TOKENS,
    stream: true,
    ...(systemParts.length ? { system: systemParts.join('\n\n') } : {}),
    messages: messages.length ? messages : [{ role: 'user', content: '你好' }],
  };
  if (isDeepSeekAnthropicUrl(cfg.base_url)) {
    payload.thinking = { type: 'disabled' };
  }

  const res = await postStreamWithAuth(
    url,
    payload,
    cfg.api_key,
    'anthropic',
    signal,
  );

  if (!res.ok) {
    const data = await readErrorBody(res);
    throwForHttpError(res, data);
  }
  if (!res.body) throw new Error('模型 API 未返回流式响应');

  let accumulated = '';
  for await (const chunk of parseSseStream(res.body)) {
    if (chunk?.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      const text = chunk.delta.text;
      if (text) {
        accumulated += text;
        if (isContentModerationText(accumulated)) {
          throw new Error(formatModerationError({ error: { message: accumulated } }));
        }
        const clean = stripModelToolArtifacts(text);
        if (clean) yield { type: 'content', text: clean };
      }
    }
    if (chunk?.type === 'error') {
      throw new Error(formatModelTestError(null, { error: chunk.error }));
    }
  }
}

export async function* stream(request) {
  const cfg = request.modelConfig;
  if (!cfg?.api_key || !cfg?.base_url || !cfg?.model) {
    yield { type: 'error', error: '模型配置不完整，请在设置页配置并激活模型' };
    yield { type: 'done' };
    return;
  }

  const controller = new AbortController();
  const runner = { abort: () => controller.abort() };
  request.onRunner?.(runner);

  try {
    const protocol = cfg.protocol || 'openai';
    const gen = protocol === 'anthropic'
      ? streamAnthropic(cfg, request, controller.signal)
      : streamOpenAI(cfg, request, controller.signal);

    for await (const evt of gen) {
      yield evt;
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      yield { type: 'done' };
      return;
    }
    yield { type: 'error', error: formatModelTestError(err), moderation: !!formatModerationError({ error: { message: err.message } }) };
  }
  yield { type: 'done' };
}

export async function generate(request) {
  let text = '';
  for await (const evt of stream(request)) {
    if (evt.type === 'content') text += evt.text;
    if (evt.type === 'error') throw new Error(evt.error);
  }
  return text;
}

export async function checkHealth(modelConfig) {
  const cfg = modelConfig || null;
  if (!cfg) {
    return { available: false, error: '未配置 API 模型', provider: id };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const protocol = cfg.protocol || 'openai';
    if (protocol === 'anthropic') {
      const { res, data } = await postWithAuth(
        buildUrl(cfg.base_url, '/v1/messages'),
        { model: cfg.model, max_tokens: 16, messages: [{ role: 'user', content: 'OK' }] },
        cfg.api_key,
        protocol,
        controller.signal,
      );
      if (!res.ok) throwForHttpError(res, data);
    } else {
      const { res, data } = await postWithAuth(
        buildUrl(cfg.base_url, '/chat/completions'),
        {
          model: cfg.model,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'OK' }],
        },
        cfg.api_key,
        protocol,
        controller.signal,
      );
      if (!res.ok) throwForHttpError(res, data);
    }
    return {
      available: true,
      provider: id,
      model: cfg.model,
      name: cfg.name,
      protocol,
    };
  } catch (e) {
    return { available: false, error: formatModelTestError(e), provider: id };
  } finally {
    clearTimeout(timeout);
  }
}
