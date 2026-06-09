import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
const USAGE_PATH = path.join(DATA_DIR, 'ai-usage.json');

function now() {
  return new Date().toISOString();
}

function emptyStore() {
  return {
    schema: 'ai_usage',
    totals: { prompt_tokens: 0, completion_tokens: 0, requests: 0 },
    by_project: {},
    by_kind: {},
    recent: [],
    updated_at: null,
  };
}

function readStore() {
  try {
    return { ...emptyStore(), ...JSON.parse(fs.readFileSync(USAGE_PATH, 'utf-8')) };
  } catch {
    return emptyStore();
  }
}

function writeStore(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/** 中文为主时约 3.5 字符 / token */
export function estimateTokens(text) {
  const len = String(text || '').length;
  if (!len) return 0;
  return Math.max(1, Math.ceil(len / 3.5));
}

export function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  return messages.reduce((sum, m) => sum + estimateTokens(m?.content || ''), 0);
}

export function recordTokenUsage({
  projectId = null,
  kind = 'unknown',
  promptText = '',
  responseText = '',
} = {}) {
  const promptTokens = estimateTokens(promptText);
  const completionTokens = estimateTokens(responseText);
  if (!promptTokens && !completionTokens) return null;

  const store = readStore();
  store.totals.prompt_tokens += promptTokens;
  store.totals.completion_tokens += completionTokens;
  store.totals.requests += 1;

  const pid = projectId || '_global';
  if (!store.by_project[pid]) {
    store.by_project[pid] = { prompt_tokens: 0, completion_tokens: 0, requests: 0 };
  }
  store.by_project[pid].prompt_tokens += promptTokens;
  store.by_project[pid].completion_tokens += completionTokens;
  store.by_project[pid].requests += 1;

  if (!store.by_kind[kind]) {
    store.by_kind[kind] = { prompt_tokens: 0, completion_tokens: 0, requests: 0 };
  }
  store.by_kind[kind].prompt_tokens += promptTokens;
  store.by_kind[kind].completion_tokens += completionTokens;
  store.by_kind[kind].requests += 1;

  store.recent = [
    {
      at: now(),
      project_id: projectId,
      kind,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    },
    ...(store.recent || []).slice(0, 49),
  ];
  store.updated_at = now();
  writeStore(store);
  return { prompt_tokens: promptTokens, completion_tokens: completionTokens };
}

export function getUsageSummary(projectId = null) {
  const store = readStore();
  if (projectId) {
    const p = store.by_project[projectId] || { prompt_tokens: 0, completion_tokens: 0, requests: 0 };
    return {
      schema: 'ai_usage_project',
      project_id: projectId,
      ...p,
      total_tokens: p.prompt_tokens + p.completion_tokens,
      updated_at: store.updated_at,
    };
  }
  return {
    ...store,
    total_tokens: (store.totals?.prompt_tokens || 0) + (store.totals?.completion_tokens || 0),
  };
}
