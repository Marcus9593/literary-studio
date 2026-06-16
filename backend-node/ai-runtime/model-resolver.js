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
 * Studio chat/write agents prefer Claude Code CLI when available.
 * Returns false so orchestrator keeps CLI routing; not used for direct HTTP calls.
 */
export function usesHttpRuntime() {
  return false;
}

/** Whether AI 中心 has a complete HTTP model profile (semantic critic, health checks). */
export function hasConfiguredHttpModel(modelConfig = resolveActiveModelConfig()) {
  if (!modelConfig) return false;
  return Boolean(
    String(modelConfig.api_key || '').trim()
    && String(modelConfig.base_url || '').trim()
    && String(modelConfig.model || '').trim(),
  );
}

/**
 * Claude Code CLI only accepts ANTHROPIC_* (or OAuth) for its auth gate.
 * Some providers (e.g. MiMo) expose both /v1 and /anthropic — map OpenAI-style URLs for CLI.
 */
export function resolveClaudeCodeEndpoint(modelConfig) {
  const base = String(modelConfig?.base_url || '').trim().replace(/\/$/, '');
  let protocol = modelConfig?.protocol || inferProtocol(base);

  if (protocol === 'openai' && /xiaomimimo\.com/i.test(base)) {
    return {
      protocol: 'anthropic',
      base_url: base.replace(/\/v1\/?$/i, '/anthropic'),
    };
  }

  return { protocol, base_url: base };
}

/**
 * Build child-process env so Claude Code uses the model configured in Studio settings.
 * Same convention as CC Switch (~/.claude/settings.json env block).
 */
function stripThirdPartyLlmEnv(env) {
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC_|OPENAI_|CLAUDE_CODE_)/.test(key)) delete env[key];
  }
}

export function buildClaudeChildEnv(modelConfig, baseEnv = process.env) {
  const env = { ...baseEnv };
  delete env.CLAUDECODE;
  stripThirdPartyLlmEnv(env);
  if (!modelConfig) return env;

  const key = String(modelConfig.api_key || '').trim();
  const model = String(modelConfig.model || '').trim();
  const { protocol, base_url: base } = resolveClaudeCodeEndpoint(modelConfig);
  if (!base || !key || !model) return env;

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
