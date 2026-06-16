import { spawn } from 'child_process';
import fs from 'fs';
import { buildClaudeChildEnv } from '../model-resolver.js';
import { getRuntimeMcpConfigPath } from '../../mcp-adapter/config.js';

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

export const id = 'claude';

function runClaude(prompt, cwd, allowedTools = [], { sessionId, resume = false, modelConfig } = {}) {
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--permission-mode', 'acceptEdits',
  ];

  const model = String(modelConfig?.model || '').trim();
  if (model) {
    args.push('--model', model);
  }

  if (resume && sessionId) {
    args.push('--resume', sessionId);
  } else if (sessionId) {
    args.push('--session-id', sessionId);
  }

  if (allowedTools.length) {
    args.push('--allowedTools', allowedTools.join(','));
  }

  const mcpConfigPath = getRuntimeMcpConfigPath();
  if (mcpConfigPath) {
    args.push('--mcp-config', mcpConfigPath);
  }

  const iter = {
    _child: null,
    abort() {
      if (this._child && !this._child.killed) {
        this._child.kill('SIGTERM');
      }
    },
    [Symbol.asyncIterator]() {
      const childEnv = buildClaudeChildEnv(modelConfig);

      const child = spawn(CLAUDE_BIN, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: childEnv,
      });
      iter._child = child;

      child.stdin.write(prompt);
      child.stdin.end();

      let buffer = '';
      let resolveNext = null;
      let done = false;
      const queue = [];

      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const evt = JSON.parse(trimmed);
            if (resolveNext) {
              const r = resolveNext;
              resolveNext = null;
              r({ value: evt, done: false });
            } else {
              queue.push(evt);
            }
          } catch {}
        }
      });

      child.on('close', () => {
        if (buffer.trim()) {
          try {
            queue.push(JSON.parse(buffer.trim()));
          } catch {}
        }
        done = true;
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r({ value: undefined, done: true });
        }
      });

      child.on('error', (err) => {
        done = true;
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r({ value: { type: 'error', error: err.message }, done: false });
        }
      });

      return {
        next() {
          if (queue.length) {
            return Promise.resolve({ value: queue.shift(), done: false });
          }
          if (done) {
            return Promise.resolve({ value: undefined, done: true });
          }
          return new Promise((r) => { resolveNext = r; });
        },
      };
    },
  };
  return iter;
}

async function* normalizeStream(prompt, cwd, allowedTools, options = {}) {
  const runner = runClaude(prompt, cwd, allowedTools, {
    sessionId: options.sessionId,
    resume: options.resume,
    modelConfig: options.modelConfig,
  });
  options.onRunner?.(runner);

  let hasStreamed = false;
  let streamedViaDelta = false;

  for await (const evt of runner) {
    if (evt.type === 'system' && evt.subtype === 'init' && evt.session_id) {
      yield { type: 'session_meta', claude_session_id: evt.session_id };
    } else if (evt.type === 'stream_event' && evt.event?.type === 'content_block_delta') {
      const delta = evt.event.delta;
      if (delta?.type === 'text_delta' && delta.text) {
        hasStreamed = true;
        streamedViaDelta = true;
        yield { type: 'content', text: delta.text };
      }
    } else if (evt.type === 'assistant' && evt.message?.content && !streamedViaDelta) {
      for (const block of evt.message.content) {
        if (block.type === 'text' && block.text) {
          hasStreamed = true;
          yield { type: 'content', text: block.text };
        }
        if (block.type === 'tool_use') {
          yield {
            type: 'tool_call',
            toolCall: { name: block.name, input: block.input },
          };
        }
      }
    } else if (evt.type === 'result') {
      if (evt.is_error || evt.subtype === 'error_during_execution') {
        const msg = [].concat(evt.errors || []).filter(Boolean).join('; ')
          || evt.error
          || 'Claude 执行失败';
        const recoverable = /no conversation found|invalid session/i.test(msg);
        yield { type: 'error', error: msg, recoverable };
      } else if (evt.result && !hasStreamed) {
        yield { type: 'content', text: evt.result };
      }
    } else if (evt.type === 'error') {
      yield { type: 'error', error: evt.error || 'Claude error' };
    }
  }
  yield { type: 'done' };
}

export async function* stream(request) {
  yield* normalizeStream(
    request.prompt,
    request.cwd,
    request.allowedTools || [],
    request,
  );
}

export async function generate(request) {
  let text = '';
  for await (const evt of stream(request)) {
    if (evt.type === 'content') text += evt.text;
    if (evt.type === 'error') throw new Error(evt.error);
  }
  return text;
}

export async function checkHealth() {
  return new Promise((resolve) => {
    if (!CLAUDE_BIN || (CLAUDE_BIN !== 'claude' && !fs.existsSync(CLAUDE_BIN))) {
      resolve({ available: false, error: 'claude CLI 未找到', provider: id });
      return;
    }

    const childEnv = { ...process.env };
    delete childEnv.CLAUDECODE;

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { child.kill('SIGTERM'); } catch {}
        resolve({ available: false, error: 'claude CLI 检测超时', provider: id });
      }
    }, 3000);

    const child = spawn(CLAUDE_BIN, ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: childEnv,
    });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (code === 0 && stdout.trim()) {
        resolve({ available: true, version: stdout.trim(), cli: CLAUDE_BIN, provider: id });
      } else {
        resolve({ available: false, error: 'claude CLI 不可用', provider: id });
      }
    });
    child.on('error', () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({ available: false, error: 'claude CLI 未找到', provider: id });
    });
  });
}
