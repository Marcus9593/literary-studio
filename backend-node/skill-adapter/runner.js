import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { findPython } from '../export/python-runtime.js';

const DEFAULT_TIMEOUT_MS = 120_000;

function resolvePythonBin() {
  const fromEnv = process.env.PYTHON || process.env.PYTHON_BIN
  if (fromEnv) {
    const resolved = path.resolve(fromEnv)
    if (resolved.includes('.asar')) {
      throw new Error(`PYTHON 路径不能位于 app.asar 内（spawn 会 ENOENT）: ${resolved}`)
    }
    return resolved
  }
  return findPython()
}

function spawnOptionsFor(command, options = {}) {
  const normalized = path.normalize(command)
  const isExe = path.isAbsolute(normalized) || normalized.includes('/') || normalized.includes('\\')
  const useShell = options.shell ?? (process.platform === 'win32' && isExe && normalized.includes(' '))
  return { shell: useShell, ...options }
}

function resolveNodeBin() {
  return process.env.NODE || process.execPath || 'node';
}

/** @returns {'python'|'bash'|'node'|'executable'} */
export function detectRunner(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.py') return 'python';
  if (ext === '.sh') return 'bash';
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'node';
  try {
    if (fs.statSync(filePath).mode & 0o111) return 'executable';
  } catch {}
  return 'bash';
}

/**
 * @param {{ command: string, args?: string[], cwd?: string, env?: Record<string,string>, timeoutMs?: number, stdin?: string }} opts
 */
export function runProcess({
  command,
  args = [],
  cwd,
  env = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  stdin,
}) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, ...env };
    const spawnOpts = spawnOptionsFor(command, {});
    const child = spawn(command, args, {
      cwd: cwd || process.cwd(),
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...spawnOpts,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2000);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        killed,
        command: [command, ...args].join(' '),
      });
    });
  });
}

/**
 * @param {string} scriptPath
 * @param {string[]} argv
 */
export async function runScript(scriptPath, argv = [], options = {}) {
  const abs = path.resolve(scriptPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`脚本不存在: ${abs}`);
  }

  const runner = options.runner || detectRunner(abs);
  const cwd = options.cwd || path.dirname(abs);
  const env = { ...options.env };

  if (runner === 'python') {
    const scriptsDir = path.dirname(abs);
    const prev = env.PYTHONPATH || '';
    env.PYTHONPATH = prev ? `${scriptsDir}${path.delimiter}${prev}` : scriptsDir;
    return runProcess({
      command: resolvePythonBin(),
      args: [abs, ...argv],
      cwd,
      env,
      timeoutMs: options.timeoutMs,
      stdin: options.stdin,
    });
  }

  if (runner === 'node') {
    return runProcess({
      command: resolveNodeBin(),
      args: [abs, ...argv],
      cwd,
      env,
      timeoutMs: options.timeoutMs,
      stdin: options.stdin,
    });
  }

  if (runner === 'executable') {
    return runProcess({
      command: abs,
      args: argv,
      cwd,
      env,
      timeoutMs: options.timeoutMs,
      stdin: options.stdin,
    });
  }

  return runProcess({
    command: 'bash',
    args: [abs, ...argv],
    cwd,
    env,
    timeoutMs: options.timeoutMs,
    stdin: options.stdin,
  });
}

export function tryParseJson(stdout) {
  const t = String(stdout || '').trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {}
    }
    const aStart = t.indexOf('[');
    const aEnd = t.lastIndexOf(']');
    if (aStart >= 0 && aEnd > aStart) {
      try {
        return JSON.parse(t.slice(aStart, aEnd + 1));
      } catch {}
    }
  }
  return null;
}
