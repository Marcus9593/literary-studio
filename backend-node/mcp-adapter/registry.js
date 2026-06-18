import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addStudioMcpServer,
  listAllServers,
  readStudioMcpFile,
  serverId,
} from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.resolve(process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data'));
const REGISTRY_CACHE_PATH = path.join(DATA_DIR, 'mcp-registry-cache.json');

const REGISTRY_API = process.env.MCP_REGISTRY_API
  || 'https://registry.modelcontextprotocol.io/v0.1/servers';

const SEARCH_TIMEOUT_MS = Number(process.env.MCP_REGISTRY_TIMEOUT_MS || 25000);

function localNameFromRegistry(registryName) {
  const base = String(registryName || 'mcp-server').split('/').pop() || 'mcp-server';
  return base.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 48) || 'mcp-server';
}

function uniqueLocalName(baseName) {
  const studio = readStudioMcpFile();
  const existing = new Set(Object.keys(studio.content?.mcpServers || {}));
  let name = baseName;
  let i = 2;
  while (existing.has(name)) {
    name = `${baseName}-${i}`;
    i += 1;
  }
  return name;
}

function pickStdioPackage(packages = []) {
  return packages.find((p) => p.transport?.type === 'stdio')
    || packages.find((p) => p.runtimeHint === 'npx' && p.transport?.type !== 'sse')
    || packages[0];
}

function pickRemote(remotes = []) {
  return remotes.find((r) => r.type === 'streamable-http')
    || remotes.find((r) => r.type === 'sse')
    || remotes[0];
}

export function buildMcpConfigFromRegistryServer(server, options = {}) {
  const envOverrides = options.env || {};
  const argOverrides = options.args || {};

  const pkg = pickStdioPackage(server.packages || []);
  if (pkg) {
    const command = pkg.runtimeHint || 'npx';
    const args = [];

    for (const arg of pkg.runtimeArguments || []) {
      if (arg.value != null && arg.value !== '') args.push(String(arg.value));
    }
    if (command === 'npx' && !args.includes('-y')) {
      args.unshift('-y');
    }
    args.push(pkg.identifier);

    for (const arg of pkg.packageArguments || []) {
      const val = argOverrides[arg.name] ?? arg.default;
      if (val == null || val === '') {
        if (arg.isRequired) {
          throw new Error(`缺少必填参数：${arg.name}${arg.description ? `（${arg.description}）` : ''}`);
        }
        continue;
      }
      if (arg.type === 'named' && arg.name) {
        args.push(`--${arg.name}`, String(val));
      } else {
        args.push(String(val));
      }
    }

    const env = {};
    for (const ev of pkg.environmentVariables || []) {
      const v = envOverrides[ev.name];
      if (v != null && v !== '') {
        env[ev.name] = String(v);
      } else if (ev.default !== undefined && ev.default !== null && ev.default !== '') {
        env[ev.name] = String(ev.default);
      } else if (ev.isRequired) {
        throw new Error(`缺少必填环境变量：${ev.name}${ev.description ? `（${ev.description}）` : ''}`);
      }
    }

    const config = { command, args };
    if (Object.keys(env).length) config.env = env;
    return { config, transport: 'stdio', package_id: pkg.identifier };
  }

  const remote = pickRemote(server.remotes || []);
  if (remote?.url) {
    const headers = {};
    for (const h of remote.headers || []) {
      const v = envOverrides[h.name] ?? h.value;
      if (v != null && v !== '') headers[h.name] = String(v);
      else if (h.isRequired) {
        throw new Error(`缺少必填请求头：${h.name}${h.description ? `（${h.description}）` : ''}`);
      }
    }
    const config = { url: remote.url };
    if (Object.keys(headers).length) config.headers = headers;
    return { config, transport: 'http', remote_type: remote.type };
  }

  throw new Error('该 Registry 条目没有可安装的 npm（stdio）或 remote 配置');
}

export function normalizeRegistryItem(item) {
  const server = item?.server || item;
  if (!server?.name) return null;

  const pkg = pickStdioPackage(server.packages || []);
  const remote = pickRemote(server.remotes || []);
  const studio = readStudioMcpFile();
  const installedNames = Object.keys(studio.content?.mcpServers || {});
  const localGuess = localNameFromRegistry(server.name);
  const rawServers = studio.content?.mcpServers || {};
  const alreadyInstalled = installedNames.includes(localGuess)
    || Object.values(rawServers).some((cfg) => cfg?._studio_meta?.registry_name === server.name);

  return {
    registry_name: server.name,
    title: localGuess,
    description: server.description || '',
    version: server.version || pkg?.version || null,
    repository_url: server.repository?.url || null,
    transport: pkg ? 'stdio' : (remote ? 'http' : 'unknown'),
    install_type: pkg ? 'npm' : (remote ? 'remote' : 'unknown'),
    package_id: pkg?.identifier || null,
    remote_url: remote?.url || null,
    required_env: [
      ...(pkg?.environmentVariables || []),
      ...(remote?.headers || []).map((h) => ({
        name: h.name,
        description: h.description,
        isRequired: h.isRequired,
        isSecret: h.isSecret,
        default: h.value,
        kind: 'header',
      })),
    ].filter((e) => e.isRequired).map((e) => ({
      name: e.name,
      description: e.description || '',
      is_secret: Boolean(e.isSecret),
      kind: e.kind || 'env',
      placeholder: e.default || '',
    })),
    required_args: (pkg?.packageArguments || [])
      .filter((a) => a.isRequired)
      .map((a) => ({
        name: a.name,
        description: a.description || '',
        default: a.default != null ? String(a.default) : '',
      })),
    already_installed: alreadyInstalled,
    _raw: undefined,
  };
}

async function fetchRegistry(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Registry API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function readRegistryCache() {
  if (!fs.existsSync(REGISTRY_CACHE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_CACHE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export async function searchRegistry(query = '', { limit = 20, cursor = '' } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(Math.min(Math.max(limit, 1), 50)));
  const q = String(query || '').trim();
  if (q) params.set('search', q);
  if (cursor) params.set('cursor', cursor);

  const url = `${REGISTRY_API}?${params.toString()}`;

  try {
    const data = await fetchRegistry(url);
    const items = (data.servers || [])
      .map(normalizeRegistryItem)
      .filter(Boolean);

    const result = {
      items,
      total: data.metadata?.count ?? items.length,
      query: q,
      limit: Number(params.get('limit')),
      next_cursor: data.metadata?.nextCursor || null,
      source: 'mcp-registry',
      registry_api: REGISTRY_API,
    };

    // 写入缓存
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(REGISTRY_CACHE_PATH, JSON.stringify({
        updated_at: new Date().toISOString(),
        query: q,
        ...result,
      }, null, 2), 'utf-8');
    } catch {}

    return result;
  } catch (err) {
    // 离线回退：读取本地缓存
    const cache = readRegistryCache();
    if (cache?.items?.length) {
      // 对缓存结果做本地过滤
      const filtered = q
        ? cache.items.filter((item) =>
            item.title?.toLowerCase().includes(q.toLowerCase()) ||
            item.description?.toLowerCase().includes(q.toLowerCase()) ||
            item.registry_name?.toLowerCase().includes(q.toLowerCase())
          )
        : cache.items;
      return {
        items: filtered.slice(0, limit),
        total: filtered.length,
        query: q,
        limit,
        next_cursor: null,
        source: 'cache',
        stale: true,
        cached_at: cache.updated_at,
        error: err.message,
      };
    }
    throw err;
  }
}

export function getRegistryCacheMeta() {
  if (!fs.existsSync(REGISTRY_CACHE_PATH)) {
    return { available: false, updated_at: null, total: 0 };
  }
  try {
    const data = JSON.parse(fs.readFileSync(REGISTRY_CACHE_PATH, 'utf-8'));
    return {
      available: true,
      updated_at: data.updated_at,
      total: data.total,
      query: data.query,
    };
  } catch {
    return { available: false, updated_at: null, total: 0 };
  }
}

export async function getRegistryServerDetail(registryName) {
  const result = await searchRegistry(registryName, { limit: 5 });
  const exact = result.items.find((i) => i.registry_name === registryName);
  if (exact) return exact;
  const data = await fetchRegistry(
    `${REGISTRY_API}?${new URLSearchParams({ search: registryName, limit: '10' })}`,
  );
  const match = (data.servers || []).find((s) => s.server?.name === registryName);
  if (!match) throw new Error(`Registry 中未找到：${registryName}`);
  return normalizeRegistryItem(match);
}

export async function installFromRegistry({
  registry_name: registryName,
  local_name: localName,
  env = {},
  args = {},
  enabled = true,
} = {}) {
  if (!registryName) throw new Error('需要 registry_name');

  const data = await fetchRegistry(
    `${REGISTRY_API}?${new URLSearchParams({ search: registryName, limit: '20' })}`,
  );
  const entry = (data.servers || []).find((s) => s.server?.name === registryName);
  if (!entry?.server) {
    throw new Error(`Registry 中未找到：${registryName}`);
  }

  const { config, transport, package_id, remote_type } = buildMcpConfigFromRegistryServer(
    entry.server,
    { env, args },
  );

  const name = uniqueLocalName(localName || localNameFromRegistry(registryName));
  config._studio_meta = {
    registry_name: registryName,
    installed_at: new Date().toISOString(),
    transport,
    package_id: package_id || null,
    remote_type: remote_type || null,
  };

  const result = addStudioMcpServer(name, config, { enabled });
  return {
    ok: true,
    registry_name: registryName,
    local_name: name,
    server_id: result.id,
    transport,
    config: {
      ...config,
      env: undefined,
      _studio_meta: config._studio_meta,
      env_keys: config.env ? Object.keys(config.env) : [],
    },
  };
}
