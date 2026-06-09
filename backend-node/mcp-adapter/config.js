import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { loadToolsConfig, saveToolsConfig } from '../tools-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.resolve(process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data'));
const STUDIO_MCP_PATH = path.join(DATA_DIR, 'mcp.studio.json');
const RUNTIME_MCP_PATH = path.join(DATA_DIR, 'mcp.runtime.json');
const REGISTRY_CACHE_PATH = path.join(DATA_DIR, 'mcp-registry-cache.json');

function readRegistryCacheMeta() {
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

export const MCP_TEMPLATE = `{
  "mcpServers": {
    "example-filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"],
      "env": {}
    }
  }
}
`;

export const MCP_SOURCES = [
  { id: 'studio', label: '文匠 Studio', path: STUDIO_MCP_PATH, writable: true },
  { id: 'claude', label: 'Claude Code', path: path.join(os.homedir(), '.claude', 'mcp.json'), writable: false },
  { id: 'cursor', label: 'Cursor', path: path.join(os.homedir(), '.cursor', 'mcp.json'), writable: false },
  { id: 'project', label: '项目', path: path.join(ROOT, '.cursor', 'mcp.json'), writable: false },
];

function expandPath(p) {
  return path.resolve(String(p).replace(/^~/, os.homedir()));
}

function readMcpFile(filePath) {
  const resolved = expandPath(filePath);
  const entry = {
    path: resolved,
    exists: false,
    servers: {},
    error: null,
  };
  if (!fs.existsSync(resolved)) return entry;
  entry.exists = true;
  try {
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    const servers = raw.mcpServers || raw.servers || {};
    if (servers && typeof servers === 'object') {
      entry.servers = servers;
    }
  } catch (err) {
    entry.error = err.message;
  }
  return entry;
}

export function serverId(source, name) {
  return `${source}::${name}`;
}

export function parseServerId(id) {
  const i = String(id).indexOf('::');
  if (i < 0) return { source: 'studio', name: id };
  return { source: id.slice(0, i), name: id.slice(i + 2) };
}

function getMcpSettings() {
  const cfg = loadToolsConfig();
  return cfg.mcp || {};
}

function saveMcpSettings(patch) {
  const cfg = loadToolsConfig();
  cfg.mcp = { ...(cfg.mcp || {}), ...patch };
  saveToolsConfig(cfg);
  return cfg.mcp;
}

export function isServerEnabled(source, name, settings = getMcpSettings()) {
  const id = serverId(source, name);
  const map = settings.enabled_servers || {};
  if (Object.prototype.hasOwnProperty.call(map, id)) {
    return Boolean(map[id]);
  }
  return source === 'studio';
}

export function setServerEnabled(id, enabled) {
  const settings = getMcpSettings();
  const enabled_servers = { ...(settings.enabled_servers || {}) };
  enabled_servers[id] = Boolean(enabled);
  saveMcpSettings({ enabled_servers });
  writeRuntimeSnapshot();
  return { id, enabled: Boolean(enabled) };
}

export function sanitizeServerConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return {};
  const out = { ...cfg };
  if (out.env && typeof out.env === 'object') {
    out.env_keys = Object.keys(out.env);
    delete out.env;
  }
  if (out.headers && typeof out.headers === 'object') {
    out.header_keys = Object.keys(out.headers);
    delete out.headers;
  }
  return out;
}

export function listAllServers() {
  const settings = getMcpSettings();
  const items = [];
  for (const src of MCP_SOURCES) {
    const file = readMcpFile(src.path);
    for (const [name, cfg] of Object.entries(file.servers || {})) {
      if (!cfg || typeof cfg !== 'object') continue;
      const id = serverId(src.id, name);
      const transport = cfg.url ? 'http' : (cfg.command ? 'stdio' : 'unknown');
      items.push({
        id,
        source: src.id,
        source_label: src.label,
        name,
        transport,
        enabled: isServerEnabled(src.id, name, settings),
        config_path: file.path,
        writable: src.writable,
        config: sanitizeServerConfig(cfg),
        file_exists: file.exists,
        file_error: file.error,
      });
    }
  }
  return items;
}

export function getServerById(id) {
  const { source, name } = parseServerId(id);
  const src = MCP_SOURCES.find((s) => s.id === source);
  if (!src) return null;
  const file = readMcpFile(src.path);
  const raw = file.servers?.[name];
  if (!raw) return null;
  return {
    id,
    source,
    name,
    transport: raw.url ? 'http' : (raw.command ? 'stdio' : 'unknown'),
    enabled: isServerEnabled(source, name),
    config: raw,
    config_path: file.path,
  };
}

export function writeRuntimeSnapshot() {
  const enabled = listAllServers().filter((s) => s.enabled);
  const mcpServers = {};
  for (const s of enabled) {
    const full = getServerById(s.id);
    if (!full?.config) continue;
    let key = full.name;
    if (mcpServers[key]) {
      key = `${full.source}-${full.name}`;
    }
    mcpServers[key] = full.config;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = { mcpServers };
  fs.writeFileSync(RUNTIME_MCP_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  return {
    path: RUNTIME_MCP_PATH,
    server_count: Object.keys(mcpServers).length,
    mcpServers: Object.keys(mcpServers),
  };
}

export function getRuntimeMcpConfigPath() {
  const enabled = listAllServers().filter((s) => s.enabled);
  if (!enabled.length) return null;
  try {
    if (!fs.existsSync(RUNTIME_MCP_PATH)) {
      writeRuntimeSnapshot();
    } else {
      const raw = JSON.parse(fs.readFileSync(RUNTIME_MCP_PATH, 'utf-8'));
      const keys = Object.keys(raw.mcpServers || {});
      if (keys.length !== enabled.length) writeRuntimeSnapshot();
    }
    return RUNTIME_MCP_PATH;
  } catch {
    return null;
  }
}

export function getMcpOverview() {
  const servers = listAllServers();
  const enabled = servers.filter((s) => s.enabled);
  const runtime = writeRuntimeSnapshot();
  return {
    sources: MCP_SOURCES.map((s) => {
      const file = readMcpFile(s.path);
      return {
        id: s.id,
        label: s.label,
        path: file.path,
        exists: file.exists,
        writable: s.writable,
        error: file.error,
        server_count: Object.keys(file.servers || {}).length,
      };
    }),
    servers,
    enabled_count: enabled.length,
    total_count: servers.length,
    runtime_path: runtime.path,
    runtime_server_count: runtime.server_count,
    studio_path: STUDIO_MCP_PATH,
    template: MCP_TEMPLATE,
    cli_injection: Boolean(runtime.server_count),
    registry_cache: readRegistryCacheMeta(),
  };
}

export function readStudioMcpFile() {
  const file = readMcpFile(STUDIO_MCP_PATH);
  return {
    path: file.path,
    exists: file.exists,
    content: file.exists ? JSON.parse(fs.readFileSync(file.path, 'utf-8')) : { mcpServers: {} },
    error: file.error,
  };
}

export function saveStudioMcpFile(content) {
  if (!content || typeof content !== 'object') {
    throw new Error('content 必须是 JSON 对象');
  }
  const servers = content.mcpServers || content.servers;
  if (!servers || typeof servers !== 'object') {
    throw new Error('需要 mcpServers 对象');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = { mcpServers: servers };
  fs.writeFileSync(STUDIO_MCP_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  writeRuntimeSnapshot();
  return { ok: true, path: STUDIO_MCP_PATH };
}

export function addStudioMcpServer(name, serverConfig, { enabled = true } = {}) {
  const key = String(name || '').trim();
  if (!key) throw new Error('需要 server 名称');
  if (!serverConfig || typeof serverConfig !== 'object') {
    throw new Error('需要 server 配置对象');
  }
  const studio = readStudioMcpFile();
  const content = studio.content || { mcpServers: {} };
  content.mcpServers[key] = serverConfig;
  saveStudioMcpFile(content);
  const id = serverId('studio', key);
  if (enabled) {
    setServerEnabled(id, true);
  }
  return { name: key, id, enabled: Boolean(enabled) };
}
