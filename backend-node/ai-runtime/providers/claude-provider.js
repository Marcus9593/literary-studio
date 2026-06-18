import { spawn } from 'child_process';
import fs from 'fs';
import { buildClaudeChildEnv } from '../model-resolver.js';
import { getRuntimeMcpConfigPath } from '../../mcp-adapter/config.js';

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const CLI_TIMEOUT_MS = Number(process.env.CLAUDE_CLI_TIMEOUT_MS || 300000);
const PROMPT_ARG_MAX = 6000;

function shouldUsePromptArg(promptText) {
  if (!promptText || promptText.length > PROMPT_ARG_MAX) return false;
  // Windows argv 对中文等非 ASCII 编码不可靠，一律走 stdin
  if (process.platform === 'win32') return false;
  if (/[^\x00-\x7F]/.test(promptText)) return false;
  return true;
}

export const id = 'claude';

function runClaude(prompt, cwd, allowedTools = [], { sessionId, resume = false, modelConfig, timeoutMs = CLI_TIMEOUT_MS } = {}) {
  const promptText = String(prompt || '');
  const usePromptArg = shouldUsePromptArg(promptText);

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

  if (usePromptArg) {
    args.push(promptText);
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
        stdio: [usePromptArg ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        env: childEnv,
        windowsHide: true,
      });
      iter._child = child;

      if (!usePromptArg && promptText) {
        child.stdin.write(promptText, 'utf8', () => {
          try { child.stdin.end(); } catch {}
        });
      } else if (!usePromptArg) {
        try { child.stdin.end(); } catch {}
      }

      let buffer = '';
      let stderrBuf = '';
      let resolveNext = null;
      let done = false;
      const queue = [];
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        try { child.kill('SIGTERM'); } catch {}
      }, timeoutMs);

      const finish = (code) => {
        clearTimeout(timer);
        if (buffer.trim()) {
          try {
            queue.push(JSON.parse(buffer.trim()));
          } catch {}
        }
        const errLine = stderrBuf.split('\n').map((l) => l.trim()).find(Boolean);
        if (timedOut) {
          queue.push({ type: 'error', error: `Claude CLI 超时（${Math.round(timeoutMs / 1000)}s），请检查网络或 API 配置` });
        } else if (code !== 0 && errLine) {
          queue.push({ type: 'error', error: errLine.slice(0, 500) });
        } else if (code === 0 && errLine && /error|invalid|not logged|unauthorized|balance/i.test(errLine)) {
          queue.push({ type: 'error', error: errLine.slice(0, 500) });
        }
        done = true;
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r({ value: undefined, done: true });
        }
      };

      child.stderr.on('data', (chunk) => {
        stderrBuf += chunk.toString();
        if (stderrBuf.length > 16000) stderrBuf = stderrBuf.slice(-16000);
      });

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
          } catch {
            // ignore malformed partial lines
          }
        }
      });

      child.on('close', (code) => finish(code));

      child.on('error', (err) => {
        clearTimeout(timer);
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
    timeoutMs: options.timeoutMs,
  });
  options.onRunner?.(runner);

  let streamedText = '';
  let thinkingText = '';
  let lastResult = null;
  let sawToolUse = false;
  const rawTypes = [];

  for await (const evt of runner) {
    rawTypes.push(evt?.type);
    if (evt.type === 'system' && evt.subtype === 'init' && evt.session_id) {
      yield { type: 'session_meta', claude_session_id: evt.session_id };
    } else if (evt.type === 'stream_event' && evt.event?.type === 'content_block_delta') {
      const delta = evt.event.delta;
      if (delta?.type === 'text_delta' && delta.text) {
        streamedText += delta.text;
        yield { type: 'content', text: delta.text };
      } else if (delta?.type === 'thinking_delta' && delta.thinking) {
        thinkingText += delta.thinking;
      }
    } else if (evt.type === 'assistant' && evt.message?.content) {
      if (!streamedText.trim()) {
        for (const block of evt.message.content) {
          if (block.type === 'text' && block.text) {
            streamedText += block.text;
            yield { type: 'content', text: block.text };
          } else if (block.type === 'thinking' && block.thinking) {
            thinkingText += block.thinking;
          } else if (block.type === 'tool_use') {
            sawToolUse = true;
            yield {
              type: 'tool_call',
              toolCall: { name: block.name, input: block.input },
            };
          }
        }
      }
    } else if (evt.type === 'result') {
      lastResult = evt;
      if (evt.is_error || evt.subtype === 'error_during_execution') {
        const msg = [].concat(evt.errors || []).filter(Boolean).join('; ')
          || evt.result
          || evt.error
          || 'Claude 执行失败';
        const recoverable = /no conversation found|invalid session/i.test(msg);
        yield { type: 'error', error: msg, recoverable };
      } else if (evt.result && !streamedText.trim()) {
        streamedText = evt.result;
        yield { type: 'content', text: evt.result };
      }
    } else if (evt.type === 'error') {
      yield { type: 'error', error: evt.error || 'Claude error' };
    }
  }

  if (!streamedText.trim() && thinkingText.trim()) {
    streamedText = thinkingText;
    yield { type: 'content', text: thinkingText };
  }

  if (!streamedText.trim()) {
    const hint = lastResult?.result
      || (lastResult?.is_error ? 'Claude CLI 返回错误但未输出正文' : null)
      || (sawToolUse ? 'Claude CLI 已调用工具但未返回可见文本，请重试或换用 deepseek-chat' : null);
    const model = options.modelConfig?.model || 'unknown';
    console.warn(
      `[claude-provider] 空回复 model=${model} resume=${!!options.resume} `
      + `tools=${!!allowedTools?.length} sawToolUse=${sawToolUse} `
      + `result=${JSON.stringify(lastResult)?.slice(0, 400)} events=${rawTypes.slice(-8).join(',')}`,
    );
    if (hint && !lastResult?.is_error) {
      yield { type: 'content', text: hint };
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
      windowsHide: true,
    });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (code === 0 && stdout.trim()) {
        resolve({
          available: true,
          version: stdout.trim(),
          cli: CLAUDE_BIN,
          provider: id,
        });
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
