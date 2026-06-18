#!/usr/bin/env node
/**
 * Reproduce Claude CLI stream-json parsing for DeepSeek debugging.
 * Usage: STUDIO_DEEPSEEK_KEY=... node scripts/debug-claude-cli.mjs [--model deepseek-chat]
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const model = process.argv.includes('--model')
  ? process.argv[process.argv.indexOf('--model') + 1]
  : 'deepseek-chat';
const apiKey = process.env.STUDIO_DEEPSEEK_KEY || process.env.ANTHROPIC_API_KEY || '';
if (!apiKey) {
  console.error('Set STUDIO_DEEPSEEK_KEY');
  process.exit(1);
}

const CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(ROOT, 'electron/vendor/claude/claude.exe');

const prompt = `你是文匠 Studio 创作助手。

用户消息：我叫陈涛，上辈子被女友和他的情妇陷害后，我重生了，这一次，我绝不会输

请用两三句话回应作者的创作方向，不要调用任何工具，直接文字回复。`;

const env = {
  ...process.env,
  ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
  ANTHROPIC_AUTH_TOKEN: apiKey,
  ANTHROPIC_API_KEY: apiKey,
  ANTHROPIC_MODEL: model,
};
delete env.CLAUDECODE;

const args = [
  '-p',
  '--output-format', 'stream-json',
  '--verbose',
  '--include-partial-messages',
  '--permission-mode', 'acceptEdits',
  '--model', model,
  '--allowedTools', 'Read,Edit,Write,Bash,Glob,Grep',
];

function parseWithCurrentProvider(events) {
  let hasStreamed = false;
  let streamedViaDelta = false;
  const out = [];
  for (const evt of events) {
    if (evt.type === 'stream_event' && evt.event?.type === 'content_block_delta') {
      const delta = evt.event.delta;
      if (delta?.type === 'text_delta' && delta.text) {
        hasStreamed = true;
        streamedViaDelta = true;
        out.push({ kind: 'content', text: delta.text });
      }
    } else if (evt.type === 'assistant' && evt.message?.content && !streamedViaDelta) {
      for (const block of evt.message.content) {
        if (block.type === 'text' && block.text) {
          hasStreamed = true;
          out.push({ kind: 'content', text: block.text });
        }
        if (block.type === 'tool_use') {
          out.push({ kind: 'tool_call', name: block.name });
        }
      }
    } else if (evt.type === 'result') {
      if (evt.is_error || evt.subtype === 'error_during_execution') {
        out.push({ kind: 'error', error: evt.error || evt.subtype });
      } else if (evt.result && !hasStreamed) {
        out.push({ kind: 'content', text: evt.result });
      }
    }
  }
  const text = out.filter((x) => x.kind === 'content').map((x) => x.text).join('');
  return { text, out, hasStreamed };
}

function parseWithFixedProvider(events) {
  let hasStreamed = false;
  let streamedViaDelta = false;
  const out = [];
  for (const evt of events) {
    if (evt.type === 'stream_event' && evt.event?.type === 'content_block_delta') {
      const delta = evt.event.delta;
      if (delta?.type === 'text_delta' && delta.text) {
        hasStreamed = true;
        streamedViaDelta = true;
        out.push({ kind: 'content', text: delta.text });
      } else if (delta?.type === 'thinking_delta' && delta.thinking) {
        out.push({ kind: 'thinking', text: delta.thinking });
      }
    } else if (evt.type === 'assistant' && evt.message?.content) {
      for (const block of evt.message.content) {
        if (block.type === 'text' && block.text && !streamedViaDelta) {
          hasStreamed = true;
          out.push({ kind: 'content', text: block.text });
        }
        if (block.type === 'thinking' && block.thinking && !hasStreamed) {
          out.push({ kind: 'thinking_block', text: block.thinking });
        }
        if (block.type === 'tool_use') {
          out.push({ kind: 'tool_call', name: block.name });
        }
      }
    } else if (evt.type === 'result') {
      if (evt.is_error || evt.subtype === 'error_during_execution') {
        out.push({ kind: 'error', error: evt.error || evt.subtype });
      } else if (evt.result && !hasStreamed) {
        out.push({ kind: 'content', text: evt.result });
        hasStreamed = true;
      }
    }
  }
  let text = out.filter((x) => x.kind === 'content').map((x) => x.text).join('');
  if (!text.trim()) {
    text = out.filter((x) => x.kind === 'thinking' || x.kind === 'thinking_block')
      .map((x) => x.text).join('');
  }
  return { text, out, hasStreamed };
}

const child = spawn(CLAUDE_BIN, args, {
  cwd: ROOT,
  stdio: ['pipe', 'pipe', 'pipe'],
  env,
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => { stdout += d.toString(); });
child.stderr.on('data', (d) => { stderr += d.toString(); });
child.stdin.write(prompt, 'utf8');
child.stdin.end();

await new Promise((r) => child.on('close', r));

console.log('model:', model);
console.log('exit:', child.exitCode);
if (stderr.trim()) console.log('stderr:', stderr.trim().slice(0, 800));

const lines = stdout.trim().split('\n').filter(Boolean);
const events = lines.map((l) => {
  try { return JSON.parse(l); } catch { return null; }
}).filter(Boolean);

console.log('event lines:', lines.length);
const result = events.find((e) => e.type === 'result');
console.log('result.subtype:', result?.subtype, 'result.len:', (result?.result || '').length);

const current = parseWithCurrentProvider(events);
const fixed = parseWithFixedProvider(events);

console.log('\n--- current parser ---');
console.log('hasStreamed:', current.hasStreamed, 'text.len:', current.text.length);
console.log('text:', current.text.slice(0, 300));
console.log('events:', current.out.map((x) => x.kind).join(', '));

console.log('\n--- fixed parser ---');
console.log('hasStreamed:', fixed.hasStreamed, 'text.len:', fixed.text.length);
console.log('text:', fixed.text.slice(0, 300));

// Optional: full orchestrator path
if (process.argv.includes('--orchestrator')) {
  process.env.LITERARY_STUDIO_DATA = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
  process.env.CLAUDE_BIN = CLAUDE_BIN;
  const { streamChat } = await import(path.join(ROOT, 'backend-node/ai-runtime/orchestrator.js'));
  const storage = await import(path.join(ROOT, 'backend-node/storage/settings.js'));
  const { syncClaudeSettingsFromModel } = await import(path.join(ROOT, 'backend-node/ai-runtime/model-resolver.js'));
  const modelBody = {
    name: 'DeepSeek', model, base_url: 'https://api.deepseek.com/anthropic',
    api_key: apiKey, protocol: 'anthropic',
  };
  let mid = storage.listModelsPublic?.()?.find((m) => `${m.name}${m.model}`.toLowerCase().includes('deepseek'))?.id;
  if (mid) storage.updateModel(mid, modelBody);
  else mid = storage.createModel(modelBody).id;
  storage.setActiveModel(mid);
  syncClaudeSettingsFromModel({ ...modelBody, id: mid });

  const projectsMod = await import(path.join(ROOT, 'backend-node/storage.js'));
  let pid = projectsMod.listProjects()[0]?.id;
  if (!pid) pid = projectsMod.createProject({ title: '重生之我叫陈涛', genre: '都市重生' }).id;
  const session = projectsMod.createSession(pid, '默认会话');
  let orchText = '';
  const orchErrors = [];
  const orchMetas = [];
  for await (const evt of streamChat(pid, '我叫陈涛，上辈子被女友和他的情妇陷害后，我重生了，这一次，我绝不会输', session, {})) {
    if (evt.type === 'content') orchText += evt.text;
    if (evt.type === 'error') orchErrors.push(evt.error);
    if (evt.type === 'inference_meta') orchMetas.push(evt);
  }
  console.log('\n--- orchestrator streamChat ---');
  console.log('contentLen:', orchText.length, 'errors:', orchErrors, 'metas:', orchMetas);
  console.log('preview:', orchText.slice(0, 250));
}
