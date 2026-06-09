import * as claude from './providers/claude-provider.js';
import * as httpProvider from './providers/http-provider.js';
import { resolveActiveModelConfig } from './model-resolver.js';
import { DEFAULT_PROVIDER } from './types.js';

const providers = {
  claude,
  http: httpProvider,
};

const activeRunners = new Set();

function resolveClaudeProvider() {
  return providers.claude;
}

/**
 * Attach active model config from settings when not explicitly passed.
 */
export function enrichStreamRequest(request = {}) {
  const modelConfig = request.modelConfig || resolveActiveModelConfig();
  return {
    ...request,
    modelConfig,
    provider: request.provider || DEFAULT_PROVIDER,
  };
}

export function getProviderIds() {
  return ['claude', 'http'];
}

export function getActiveInferenceMode() {
  const cfg = resolveActiveModelConfig();
  const base = { mode: 'claude_cli' };
  if (cfg) {
    return {
      ...base,
      model: cfg.model,
      name: cfg.name,
      protocol: cfg.protocol,
      credentials: 'studio_settings',
    };
  }
  return { ...base, credentials: 'cli_default' };
}

export async function* stream(request) {
  const req = enrichStreamRequest(request);
  for await (const evt of resolveClaudeProvider().stream(req)) {
    yield evt;
  }
}

export async function generate(request) {
  const req = enrichStreamRequest(request);
  return resolveClaudeProvider().generate(req);
}

export async function checkHealth(providerId) {
  const cfg = resolveActiveModelConfig();
  if (providerId === 'http' && cfg) {
    return httpProvider.checkHealth(cfg);
  }
  return providers.claude.checkHealth();
}

export function cancelAll() {
  for (const runner of activeRunners) {
    try { runner.abort(); } catch {}
  }
  activeRunners.clear();
}

export function trackRunner(runner) {
  if (!runner) return;
  activeRunners.add(runner);
  const origAbort = runner.abort?.bind(runner);
  runner.abort = () => {
    activeRunners.delete(runner);
    origAbort?.();
  };
}

export { resolveActiveModelConfig, usesHttpRuntime, buildClaudeChildEnv } from './model-resolver.js';
export { providers };
