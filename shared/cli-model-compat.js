/**
 * Claude Code CLI compatibility — aligned with CC Switch Claude provider presets.
 * @see shared/cc-switch-claude-presets.json (from farion1231/cc-switch)
 */

import presetCatalog from './cc-switch-claude-presets.json' with { type: 'json' };

const PRESETS = presetCatalog.presets || [];

/** Hosts that only expose OpenAI /chat/completions — not in CC Switch Claude presets. */
const OPENAI_ONLY_HOSTS = [
  { host: 'api.openai.com', label: 'OpenAI 官方' },
  { host: 'generativelanguage.googleapis.com', label: 'Google Gemini 原生 API' },
];

/** Auto-map OpenAI-style URL → Anthropic sibling (CC Switch convention). */
const AUTO_MAP_RULES = [
  {
    test: (url) => /deepseek\.com/i.test(url),
    map: (url) => {
      const b = String(url || '').trim().replace(/\/$/, '');
      if (/\/anthropic$/i.test(b)) return b;
      if (/\/v1$/i.test(b)) return b.replace(/\/v1$/i, '/anthropic');
      if (/^https?:\/\/api\.deepseek\.com$/i.test(b)) return `${b}/anthropic`;
      return `${b.replace(/\/v1\/?$/i, '')}/anthropic`;
    },
    preset: 'DeepSeek',
  },
  {
    test: (url) => /xiaomimimo\.com/i.test(url),
    map: (url) => String(url || '').trim().replace(/\/$/, '').replace(/\/v1\/?$/i, '/anthropic'),
    preset: 'Xiaomi MiMo',
  },
];

const SOLUTIONS = {
  useCcSwitchPreset: '在 CC Switch 的「Claude 供应商」中选择对应预设（如 DeepSeek、Kimi、Bailian），复制其 Base URL 与 API Key，或在文匠 AI 中心点击「从 CC Switch 导入」。',
  useAnthropicEndpoint: '将 Base URL 改为该厂商的 Anthropic 兼容地址（路径通常含 /anthropic），协议选「Anthropic 兼容」。',
  useDeepSeekAnthropic: 'DeepSeek 请使用 https://api.deepseek.com/anthropic（不是 /v1）。',
  useBailianAnthropic: '通义千问请使用 https://dashscope.aliyuncs.com/apps/anthropic 或 https://coding.dashscope.aliyuncs.com/apps/anthropic（不是 compatible-mode/v1）。',
  useKimiAnthropic: 'Kimi 请使用 https://api.moonshot.cn/anthropic 或 https://api.kimi.com/coding/ 。',
  useProxy: '若厂商无 Anthropic 端点，可经 CC Switch、LiteLLM 或 OpenRouter 等网关转发，再填入网关的 Anthropic Base URL。',
  claudeLogin:
    '备选：在本机终端运行 claude，输入 /login 完成 Claude 官方 OAuth 登录（适用于官方账号，无需第三方 API Key）。',
  fixProtocol: 'Claude Code 只认 ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN，OpenAI 协议配置无法用于 CLI 对话。',
};

function normalizeUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/$/, '').toLowerCase();
}

function extractHost(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return '';
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function hostMatchesPreset(host, presetHosts) {
  const h = host.toLowerCase();
  return (presetHosts || []).some((p) => {
    const ph = String(p || '').toLowerCase();
    return h === ph || h.endsWith(`.${ph}`) || ph.endsWith(`.${h}`);
  });
}

function findPresetByHost(host) {
  return PRESETS.find((p) => hostMatchesPreset(host, p.hosts)) || null;
}

function findOpenAiOnlyHost(host) {
  return OPENAI_ONLY_HOSTS.find((e) => host === e.host || host.endsWith(`.${e.host}`)) || null;
}

function findAutoMapRule(baseUrl) {
  return AUTO_MAP_RULES.find((r) => r.test(baseUrl)) || null;
}

/** Map OpenAI-style provider roots to sibling Anthropic Messages endpoints. */
export function toClaudeCodeAnthropicBase(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!base) return null;
  if (/\/anthropic$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return base.replace(/\/v1$/i, '/anthropic');
  if (/^https?:\/\/api\.deepseek\.com$/i.test(base)) return `${base}/anthropic`;
  return null;
}

/**
 * @param {{ name?: string, protocol?: string, base_url?: string, model?: string }} model
 * @returns {{
 *   cli_ready: boolean,
 *   status: 'compatible' | 'compatible_mapped' | 'incompatible' | 'unknown',
 *   severity: 'ok' | 'warn' | 'error',
 *   matched_preset: string | null,
 *   title: string,
 *   summary: string,
 *   solutions: string[],
 *   suggested_base_url?: string,
 * }}
 */
export function assessClaudeCliCompatibility(model = {}) {
  const baseUrl = String(model.base_url || '').trim();
  const protocol = String(model.protocol || '').trim().toLowerCase();
  const host = extractHost(baseUrl);
  const urlNorm = normalizeUrl(baseUrl);

  if (!baseUrl) {
    return {
      cli_ready: false,
      status: 'unknown',
      severity: 'warn',
      matched_preset: null,
      title: '未配置 Base URL',
      summary: 'Claude Code 需要可用的 API Base URL 或本机 OAuth 登录。',
      solutions: [SOLUTIONS.claudeLogin, SOLUTIONS.useCcSwitchPreset],
    };
  }

  const openAiOnly = findOpenAiOnlyHost(host);
  if (openAiOnly && !urlNorm.includes('/anthropic')) {
    return {
      cli_ready: false,
      status: 'incompatible',
      severity: 'error',
      matched_preset: null,
      title: `${openAiOnly.label} 无 Anthropic 端点`,
      summary: `${openAiOnly.label} 仅提供 OpenAI 格式 API，Claude Code CLI 无法直接使用。`,
      solutions: [SOLUTIONS.useProxy, SOLUTIONS.claudeLogin, SOLUTIONS.fixProtocol],
    };
  }

  if (/compatible-mode\/v1/i.test(urlNorm) || (host.includes('dashscope') && !urlNorm.includes('/anthropic'))) {
    return {
      cli_ready: false,
      status: 'incompatible',
      severity: 'error',
      matched_preset: 'Bailian',
      title: '通义千问 OpenAI 兼容地址不适用于 Claude Code',
      summary: 'compatible-mode/v1 仅适用于 HTTP 测试，Claude CLI 需要 Bailian 的 Anthropic 端点。',
      solutions: [SOLUTIONS.useBailianAnthropic, SOLUTIONS.useCcSwitchPreset],
      suggested_base_url: 'https://dashscope.aliyuncs.com/apps/anthropic',
    };
  }

  if (protocol === 'openai' && host === 'api.openai.com') {
    return {
      cli_ready: false,
      status: 'incompatible',
      severity: 'error',
      matched_preset: null,
      title: 'OpenAI 官方 API 不适用于 Claude Code CLI',
      summary: 'OpenAI /v1/chat/completions 与 Claude Code 鉴权机制不兼容。',
      solutions: [SOLUTIONS.claudeLogin, SOLUTIONS.useProxy, SOLUTIONS.fixProtocol],
    };
  }

  const preset = findPresetByHost(host);
  if (preset) {
    const needsPathFix = urlNorm.includes('deepseek.com')
      && !urlNorm.includes('/anthropic')
      && protocol === 'openai';
    if (needsPathFix) {
      const rule = findAutoMapRule(baseUrl);
      return {
        cli_ready: true,
        status: 'compatible_mapped',
        severity: 'warn',
        matched_preset: preset.name,
        title: `已识别 CC Switch 供应商：${preset.name}`,
        summary: '当前为 OpenAI 路径，Claude CLI 将自动映射为 Anthropic 端点；建议在 AI 中心改为 Anthropic 协议以避免歧义。',
        solutions: [SOLUTIONS.useDeepSeekAnthropic, SOLUTIONS.useAnthropicEndpoint],
        suggested_base_url: rule?.map?.(baseUrl) || preset.base_url,
      };
    }

    if (urlNorm.includes('/anthropic') || protocol === 'anthropic' || preset.oauth) {
      return {
        cli_ready: true,
        status: 'compatible',
        severity: 'ok',
        matched_preset: preset.name,
        title: `与 CC Switch「${preset.name}」兼容`,
        summary: '该地址在 CC Switch Claude 供应商预设列表中，Claude Code CLI 可正常注入凭据。',
        solutions: [],
        suggested_base_url: preset.base_url || baseUrl,
      };
    }

    return {
      cli_ready: true,
      status: 'compatible',
      severity: 'ok',
      matched_preset: preset.name,
      title: `与 CC Switch「${preset.name}」兼容`,
      summary: '域名匹配 CC Switch Claude 供应商预设。',
      solutions: [],
      suggested_base_url: preset.base_url || baseUrl,
    };
  }

  const autoMap = findAutoMapRule(baseUrl);
  if (autoMap && protocol === 'openai') {
    return {
      cli_ready: true,
      status: 'compatible_mapped',
      severity: 'warn',
      matched_preset: autoMap.preset,
      title: `可自动映射为 ${autoMap.preset} Anthropic 端点`,
      summary: '文匠会在 CLI 启动时改写 Base URL；建议手动改为 Anthropic 兼容配置。',
      solutions: [SOLUTIONS.useAnthropicEndpoint, SOLUTIONS.useCcSwitchPreset],
      suggested_base_url: autoMap.map(baseUrl),
    };
  }

  if (protocol === 'anthropic' || urlNorm.includes('/anthropic')) {
    return {
      cli_ready: true,
      status: 'unknown',
      severity: 'warn',
      matched_preset: null,
      title: '自定义 Anthropic 端点',
      summary: '未在 CC Switch 预设列表中匹配到域名，但协议为 Anthropic，通常可用于 Claude CLI。',
      solutions: ['请确认该网关支持 Anthropic Messages API（/v1/messages）。', SOLUTIONS.useCcSwitchPreset],
    };
  }

  if (protocol === 'openai') {
    return {
      cli_ready: false,
      status: 'incompatible',
      severity: 'error',
      matched_preset: null,
      title: 'OpenAI 协议配置无法驱动 Claude Code',
      summary: 'Claude Code 不读取 OPENAI_* 环境变量；连接测试可通过，但项目聊天会 Not logged in。',
      solutions: [SOLUTIONS.fixProtocol, SOLUTIONS.useAnthropicEndpoint, SOLUTIONS.useCcSwitchPreset, SOLUTIONS.useProxy],
    };
  }

  return {
    cli_ready: false,
    status: 'unknown',
    severity: 'warn',
    matched_preset: null,
    title: '无法确认 Claude Code 兼容性',
    summary: '建议使用 CC Switch 预设供应商或 Anthropic 兼容 Base URL。',
    solutions: [SOLUTIONS.useCcSwitchPreset, SOLUTIONS.useAnthropicEndpoint, SOLUTIONS.useProxy],
  };
}

/**
 * Normalize Base URL for Anthropic / Claude Code (CC Switch convention).
 */
export function resolveAnthropicBaseUrl(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!base) return base;
  if (/xiaomimimo\.com/i.test(base)) {
    return base.replace(/\/v1\/?$/i, '/anthropic');
  }
  const anthropicBase = toClaudeCodeAnthropicBase(base);
  if (anthropicBase && /deepseek\.com/i.test(base)) return anthropicBase;
  if (/\/anthropic/i.test(base)) return base;
  const preset = findPresetByHost(extractHost(base));
  if (preset?.base_url && !String(preset.base_url).includes('${')) {
    if (hostMatchesPreset(extractHost(base), preset.hosts)) {
      return preset.base_url;
    }
  }
  return base;
}

/** CC Switch 供应商 icon id（按 Base URL 域名匹配预设） */
export function resolveProviderIconForModel(model = {}) {
  const preset = findPresetByHost(extractHost(model.base_url || ''));
  return preset?.icon || null;
}

/** Persisted model profile: prefer Anthropic; rewrite URL when applicable. */
export function normalizeModelForStorage(model = {}) {
  let protocol = String(model.protocol || '').trim().toLowerCase();
  let base_url = String(model.base_url || '').trim();
  if (base_url.toLowerCase().includes('/anthropic')) protocol = 'anthropic';
  if (!protocol) protocol = 'anthropic';
  if (protocol === 'anthropic' && base_url) {
    base_url = resolveAnthropicBaseUrl(base_url);
  }
  return { ...model, protocol, base_url };
}

/** Shown when user explicitly picks OpenAI protocol in AI 中心. */
export const OPENAI_PROTOCOL_CLI_WARNING = {
  cli_ready: false,
  severity: 'error',
  title: 'OpenAI 协议无法用于 Claude Code 项目对话',
  summary:
    '「测试连接」可能成功，但聊天与写稿会报 Not logged in；Claude Code 只认 Anthropic 凭据。',
  solutions: [
    SOLUTIONS.fixProtocol,
    SOLUTIONS.useAnthropicEndpoint,
    SOLUTIONS.useCcSwitchPreset,
    SOLUTIONS.claudeLogin,
    SOLUTIONS.useProxy,
  ],
};

/** Not logged in 备选方案：本机 Claude Code OAuth 登录步骤（AI 中心弹窗等复用） */
export const CLAUDE_CLI_OAUTH_GUIDE = {
  title: '遇到 Not logged in？',
  subtitle: '除配置 Anthropic API 外，也可在本机终端登录 Claude 官方账号',
  steps: [
    {
      title: '打开系统终端',
      desc: 'Windows 打开 PowerShell 或 CMD；macOS 打开「终端」。',
    },
    {
      title: '启动 Claude Code',
      desc:
        '输入 claude 并回车。文匠 Windows/macOS 安装包已内置 Claude CLI；若提示找不到命令，请从 Anthropic 官网安装 Claude Code。',
    },
    {
      title: '执行 /login',
      desc: '在 Claude 交互界面输入 /login，按提示在浏览器中完成 OAuth 授权。',
    },
    {
      title: '重启文匠并重试',
      desc:
        '登录成功后关闭并重新打开文匠 Studio。若 AI 中心未配置第三方 API，项目对话将使用本机 Claude 登录态。',
    },
  ],
  note:
    'OAuth 登录仅适用于 Claude 官方账号。使用 DeepSeek、Kimi、通义等第三方网关时，仍须在 AI 中心配置 Anthropic 兼容协议与 API Key。',
};

export function listCcSwitchClaudePresets() {
  return PRESETS.map((p) => ({
    name: p.name,
    hosts: p.hosts,
    base_url: p.base_url,
    default_model: p.default_model ?? null,
    website_url: p.website_url ?? null,
    api_key_url: p.api_key_url ?? null,
    apiFormat: p.apiFormat,
    oauth: Boolean(p.oauth),
    category: p.category ?? null,
    cli_ready: Boolean(p.cli_ready),
  }));
}

/** AI 中心「快速模板」：仅含 Claude CLI 可用的 Anthropic 预设（与 CC Switch 同步） */
export function listCliPresetTemplates() {
  return PRESETS.filter((p) => p.cli_ready && p.base_url)
    .map((p) => {
      const base_url = normalizeModelForStorage({
        protocol: 'anthropic',
        base_url: p.base_url,
      }).base_url
      return {
        id: p.name,
        label: p.name,
        name: p.name,
        protocol: 'anthropic',
        base_url,
        model: p.default_model || '',
        website_url: p.api_key_url || p.website_url || null,
        category: p.category || 'other',
        icon: p.icon || null,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}

export function getCcSwitchPresetCatalogMeta() {
  return {
    version: presetCatalog.version,
    source: presetCatalog.source,
    source_file: presetCatalog.source_file ?? null,
    synced_at: presetCatalog.synced_at ?? null,
    preset_count: presetCatalog.preset_count ?? PRESETS.length,
    cli_ready_count: presetCatalog.cli_ready_count
      ?? PRESETS.filter((p) => p.cli_ready).length,
  };
}

export { PRESETS as CC_SWITCH_CLAUDE_PRESETS, SOLUTIONS as CLI_COMPAT_SOLUTIONS };
