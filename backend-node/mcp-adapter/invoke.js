import { getServerById, listAllServers } from './config.js';
import { withMcpClient } from './transport.js';

export async function listServerTools(serverId) {
  const server = getServerById(serverId);
  if (!server) throw new Error(`未找到 MCP Server：${serverId}`);
  if (!server.enabled) throw new Error(`MCP Server 未启用：${serverId}`);

  return withMcpClient(server.config, async (client) => {
    const result = await client.listTools();
    return {
      server_id: serverId,
      server_name: server.name,
      tools: (result.tools || []).map((t) => ({
        name: t.name,
        description: t.description || '',
        input_schema: t.inputSchema || null,
      })),
    };
  });
}

export async function callServerTool(serverId, toolName, args = {}) {
  const server = getServerById(serverId);
  if (!server) throw new Error(`未找到 MCP Server：${serverId}`);
  if (!server.enabled) throw new Error(`MCP Server 未启用：${serverId}`);
  if (!toolName) throw new Error('缺少 tool 名称');

  return withMcpClient(server.config, async (client) => {
    const result = await client.callTool({
      name: toolName,
      arguments: args || {},
    });
    return {
      schema: 'mcp_call_result',
      ok: !result.isError,
      server_id: serverId,
      tool: toolName,
      content: result.content || [],
      structuredContent: result.structuredContent ?? null,
      isError: Boolean(result.isError),
    };
  });
}

export async function checkServerHealth(serverId) {
  const server = getServerById(serverId);
  if (!server) {
    return { server_id: serverId, ok: false, error: '未找到 Server' };
  }
  if (!server.enabled) {
    return { server_id: serverId, ok: false, error: 'Server 未启用', skipped: true };
  }
  try {
    const tools = await listServerTools(serverId);
    return {
      server_id: serverId,
      ok: true,
      transport: server.transport,
      tool_count: tools.tools.length,
      tools: tools.tools.map((t) => t.name),
    };
  } catch (err) {
    return {
      server_id: serverId,
      ok: false,
      transport: server.transport,
      error: err.message,
    };
  }
}

export async function checkAllEnabledHealth() {
  const enabled = listAllServers().filter((s) => s.enabled);
  // 并行检查所有服务器，单个超时 30s，整体不超最慢的那个
  const results = await Promise.allSettled(
    enabled.map((s) => checkServerHealth(s.id))
  );
  const settled = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { server_id: enabled[i].id, ok: false, error: r.reason?.message || '检查超时' }
  );
  return {
    checked: settled.length,
    ok_count: settled.filter((r) => r.ok).length,
    results: settled,
  };
}
