import { getActiveModel } from '../storage.js';

export function inferProtocol(baseUrl) {
  return String(baseUrl || '').toLowerCase().includes('/anthropic') ? 'anthropic' : 'openai';
}

/**
 * Resolve the active model from settings for inference.
 * Returns null when no usable API model is configured → fall back to Claude CLI.
 */
export function resolveActiveModelConfig() {
  const active = getActiveModel();
  if (!active) return null;

  const apiKey = String(active.api_key || '').trim();
  const baseUrl = String(active.base_url || '').trim();
  const model = String(active.model || '').trim();
  if (!apiKey || !baseUrl || !model) return null;

  return {
    id: active.id,
    name: active.name || model,
    protocol: active.protocol || inferProtocol(baseUrl),
    base_url: baseUrl,
    model,
    api_key: apiKey,
  };
}

/**
 * Studio agents always run through Claude Code CLI.
 * HTTP provider is reserved for settings "test connection" only.
 */
export function usesHttpRuntime() {
  return false;
}

/**
 * Build child-process env so Claude Code uses the model configured in Studio settings.
 * Same convention as CC Switch (~/.claude/settings.json env block).
 */
export function buildClaudeChildEnv(modelConfig, baseEnv = process.env) {
  const env = { ...baseEnv };
  delete env.CLAUDECODE;
  if (!modelConfig) return env;

  const base = String(modelConfig.base_url || '').trim().replace(/\/$/, '');
  const key = String(modelConfig.api_key || '').trim();
  const model = String(modelConfig.model || '').trim();
  if (!base || !key || !model) return env;

  const protocol = modelConfig.protocol || inferProtocol(base);
  if (protocol === 'anthropic') {
    env.ANTHROPIC_BASE_URL = base;
    env.ANTHROPIC_AUTH_TOKEN = key;
    env.ANTHROPIC_API_KEY = key;
    env.ANTHROPIC_MODEL = model;
  } else {
    env.OPENAI_BASE_URL = base;
    env.OPENAI_API_KEY = key;
    env.OPENAI_MODEL = model;
  }
  return env;
}
