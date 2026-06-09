import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const DEFAULT_TIMEOUT_MS = Number(process.env.MCP_CALL_TIMEOUT_MS || 30000);

export function createTransport(serverConfig) {
  if (serverConfig.url) {
    const url = new URL(serverConfig.url);
    const headers = serverConfig.headers || {};
    return new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: { ...headers },
      },
    });
  }
  if (serverConfig.command) {
    return new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args || [],
      env: serverConfig.env,
      stderr: 'pipe',
    });
  }
  throw new Error('不支持的 MCP Server 配置：需要 command 或 url');
}

export async function withMcpClient(serverConfig, fn, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const client = new Client(
    { name: 'literary-studio', version: '2.0.0' },
    { capabilities: {} },
  );
  const transport = createTransport(serverConfig);
  let timer;
  try {
    const connectPromise = client.connect(transport);
    if (timeoutMs > 0) {
      await Promise.race([
        connectPromise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`MCP 连接超时（${timeoutMs}ms）`)), timeoutMs);
        }),
      ]);
    } else {
      await connectPromise;
    }
    return await fn(client);
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await transport.close();
    } catch {}
  }
}
