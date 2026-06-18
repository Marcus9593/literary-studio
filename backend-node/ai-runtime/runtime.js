import * as claude from './providers/claude-provider.js';
import * as httpProvider from './providers/http-provider.js';
import { resolveActiveModelConfig } from './model-resolver.js';
import { DEFAULT_PROVIDER } from './types.js';

const providers = {
  claude,
  http: httpProvider,
};

const activeRunners = new Set();

// ── claude CLI 可用性检测（启动时检测一次，缓存结果）──
let claudeAvailable = null;

async function isClaudeAvailable() {
  if (claudeAvailable !== null) return claudeAvailable;
  try {
    const health = await claude.checkHealth();
    claudeAvailable = health.available === true;
    if (!claudeAvailable) {
      console.log('[runtime] claude CLI 不可用，将使用 HTTP 模型');
    }
  } catch {
    claudeAvailable = false;
    console.log('[runtime] claude CLI 检测失败，将使用 HTTP 模型');
  }
  return claudeAvailable;
}

function resolveProvider(preferClaude = true) {
  if (preferClaude && claudeAvailable) return providers.claude;
  return providers.http;
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
  const mode = claudeAvailable ? 'claude_cli' : 'http';
  const base = { mode };
  if (cfg) {
    return {
      ...base,
      model: cfg.model,
      name: cfg.name,
      protocol: cfg.protocol,
      credentials: 'studio_settings',
    };
  }
  return { ...base, credentials: claudeAvailable ? 'cli_default' : 'none' };
}

export async function* stream(request) {
  await isClaudeAvailable();
  const req = enrichStreamRequest(request);
  const provider = resolveProvider(req.provider !== 'http');
  for await (const evt of provider.stream(req)) {
    yield evt;
  }
}

export async function generate(request) {
  await isClaudeAvailable();
  const req = enrichStreamRequest(request);
  const provider = resolveProvider(req.provider !== 'http');
  return provider.generate(req);
}

export async function checkHealth(providerId) {
  const cfg = resolveActiveModelConfig();
  if (providerId === 'http' && cfg) {
    return httpProvider.checkHealth(cfg);
  }
  return claude.checkHealth();
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

export {
  resolveActiveModelConfig,
  usesHttpRuntime,
  hasConfiguredHttpModel,
  buildClaudeChildEnv,
  claudeEnvFromModelConfig,
  resolveClaudeCodeEndpoint,
  toClaudeCodeAnthropicBase,
  syncClaudeSettingsFromModel,
  syncClaudeSettingsFromActiveModel,
} from './model-resolver.js';
export { providers };
