import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveAnthropicBaseUrl } from '../../shared/cli-model-compat.js';
import { getActiveModel } from '../storage.js';
import { readJSON, writeJSON } from '../storage/core.js';

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
 * Map OpenAI-style provider roots to sibling Anthropic Messages endpoints.
 * Same convention as CC Switch (e.g. DeepSeek → api.deepseek.com/anthropic).
 */
export function toClaudeCodeAnthropicBase(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!base) return null;
  if (/\/anthropic$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return base.replace(/\/v1$/i, '/anthropic');
  if (/^https?:\/\/api\.deepseek\.com$/i.test(base)) return `${base}/anthropic`;
  return null;
}

/**
 * Claude Code CLI only accepts ANTHROPIC_* (or OAuth) for its auth gate.
 * Providers with dual endpoints: rewrite OpenAI-labeled Studio config for CLI spawn.
 */
export function resolveClaudeCodeEndpoint(modelConfig) {
  const base = String(modelConfig?.base_url || '').trim().replace(/\/$/, '');
  const protocol = modelConfig?.protocol || inferProtocol(base);

  if (protocol === 'anthropic') {
    return { protocol: 'anthropic', base_url: resolveAnthropicBaseUrl(base) };
  }

  if (/xiaomimimo\.com/i.test(base)) {
    return {
      protocol: 'anthropic',
      base_url: resolveAnthropicBaseUrl(base),
    };
  }

  const anthropicBase = toClaudeCodeAnthropicBase(base);
  if (anthropicBase && /deepseek\.com/i.test(base)) {
    return { protocol: 'anthropic', base_url: anthropicBase };
  }

  return { protocol, base_url: base };
}

/** CC Switch–compatible env block for Claude Code (CLI spawn + settings.json). */
export function claudeEnvFromModelConfig(modelConfig) {
  if (!modelConfig) return {};

  const key = String(modelConfig.api_key || '').trim();
  const model = String(modelConfig.model || '').trim();
  const { protocol, base_url: base } = resolveClaudeCodeEndpoint(modelConfig);
  if (!base || !key || !model) return {};

  if (protocol === 'anthropic') {
    return {
      ANTHROPIC_BASE_URL: base,
      ANTHROPIC_AUTH_TOKEN: key,
      ANTHROPIC_API_KEY: key,
      ANTHROPIC_MODEL: model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: model,
    };
  }

  return {
    OPENAI_BASE_URL: base,
    OPENAI_API_KEY: key,
    OPENAI_MODEL: model,
  };
}

/**
 * Write active Studio model into ~/.claude/settings.json env (CC Switch convention).
 * Merges LLM env keys only; preserves permissions and other settings fields.
 */
export function syncClaudeSettingsFromModel(modelConfig) {
  const envBlock = claudeEnvFromModelConfig(modelConfig);
  if (!Object.keys(envBlock).length) return { synced: false, reason: 'incomplete_model' };

  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const settings = fs.existsSync(settingsPath)
    ? (readJSON(settingsPath, {}) || {})
    : {};
  if (!settings || typeof settings !== 'object') {
    throw new Error('~/.claude/settings.json 格式无效');
  }

  settings.env = settings.env || {};
  for (const key of Object.keys(settings.env)) {
    if (/^(ANTHROPIC_|OPENAI_|CLAUDE_CODE_)/.test(key)) delete settings.env[key];
  }
  Object.assign(settings.env, envBlock);

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  writeJSON(settingsPath, settings);
  return { synced: true, settings_path: settingsPath, cli_protocol: resolveClaudeCodeEndpoint(modelConfig).protocol };
}

export function syncClaudeSettingsFromActiveModel() {
  const active = getActiveModel();
  if (!active) return { synced: false, reason: 'no_active_model' };
  return syncClaudeSettingsFromModel(active);
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
  Object.assign(env, claudeEnvFromModelConfig(modelConfig));
  return env;
}
