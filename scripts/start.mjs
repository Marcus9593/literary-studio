#!/usr/bin/env node
/**
 * Cross-platform startup: Windows / macOS / Linux
 * Usage: node scripts/start.mjs
 */
import { spawn, spawnSync, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setTimeout as delay } from 'timers/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IS_WIN = process.platform === 'win32';
const BUNDLED_LITERARY_WRITER = path.join(ROOT, 'skills', 'literary-writer');

function log(msg) {
  console.log(msg);
}

function warn(msg) {
  console.warn(msg);
}

function checkNodeVersion() {
  const major = parseInt(String(process.version).replace(/^v(\d+).*/, '$1'), 10);
  if (major < 22) {
    console.error(`[ERROR] Node.js 22+ required. Current: ${process.version}`);
    console.error('Download: https://nodejs.org/');
    process.exit(1);
  }
}

function ensureNodeOptions() {
  if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--disable-warning=ExperimentalWarning';
  }
}

function discoverLiteraryWriterRoot() {
  if (process.env.LITERARY_WRITER_ROOT) return;
  if (fs.existsSync(path.join(BUNDLED_LITERARY_WRITER, 'scripts', 'webnovel.py'))) {
    process.env.LITERARY_WRITER_ROOT = BUNDLED_LITERARY_WRITER;
    return;
  }
  const home = os.homedir();
  const candidates = [
    path.join(home, '.claude', 'skills', 'literary-writer'),
    path.join(home, '.cursor', 'skills', 'literary-writer'),
    path.join(ROOT, '..', 'skills', 'literary-writer'),
  ];
  for (const lw of candidates) {
    if (fs.existsSync(path.join(lw, 'scripts', 'webnovel.py'))) {
      process.env.LITERARY_WRITER_ROOT = lw;
      return;
    }
  }
  process.env.LITERARY_WRITER_ROOT = BUNDLED_LITERARY_WRITER;
}

function runNpm(cwd, args) {
  const result = spawnSync('npm', args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: IS_WIN,
  });
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed in ${cwd} (exit ${result.status})`);
  }
}

function walkNewerThan(dir, thresholdMs) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (walkNewerThan(full, thresholdMs)) return true;
    } else if (stat.mtimeMs > thresholdMs) {
      return true;
    }
  }
  return false;
}

function needsFrontendBuild() {
  const distIndex = path.join(ROOT, 'frontend', 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) return true;
  const srcDir = path.join(ROOT, 'frontend', 'src');
  if (!fs.existsSync(srcDir)) return false;
  return walkNewerThan(srcDir, fs.statSync(distIndex).mtimeMs);
}

function listPortPids(port) {
  if (IS_WIN) {
    const pids = new Set();
    try {
      const out = execSync('netstat -ano', { encoding: 'utf8', shell: true });
      const suffix = `:${port}`;
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes(suffix) || !/LISTENING/i.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (Number.isFinite(pid) && pid > 4) pids.add(pid);
      }
    } catch {
      /* no listeners */
    }
    return [...pids];
  }

  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((v) => parseInt(v, 10))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
}

function killPid(pid, force = false) {
  try {
    if (IS_WIN) {
      const flag = force ? '/F' : '';
      execSync(`taskkill /PID ${pid} ${flag}`.trim(), { stdio: 'ignore', shell: true });
      return true;
    }
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

async function freePort(port) {
  let pids = listPortPids(port);
  if (!pids.length) return;

  log(`Port ${port} in use (PID ${pids.join(', ')}), stopping...`);
  for (const pid of pids) killPid(pid, false);

  for (let i = 0; i < 5; i += 1) {
    await delay(400);
    pids = listPortPids(port);
    if (!pids.length) return;
  }

  log(`Force stopping PID ${pids.join(', ')}...`);
  for (const pid of pids) killPid(pid, true);
  await delay(300);
}

async function main() {
  process.chdir(ROOT);
  checkNodeVersion();
  ensureNodeOptions();
  discoverLiteraryWriterRoot();

  if (!fs.existsSync(path.join(process.env.LITERARY_WRITER_ROOT, 'scripts', 'webnovel.py'))) {
    warn(`WARN: literary-writer scripts incomplete: ${process.env.LITERARY_WRITER_ROOT}`);
  }

  const backendNode = path.join(ROOT, 'backend-node');
  if (!fs.existsSync(path.join(backendNode, 'node_modules'))) {
    log('Installing backend dependencies...');
    runNpm(backendNode, ['install']);
  }

  if (needsFrontendBuild()) {
    log('Building frontend...');
    const frontend = path.join(ROOT, 'frontend');
    const distIndex = path.join(frontend, 'dist', 'index.html');
    try {
      runNpm(frontend, ['install']);
      runNpm(frontend, ['run', 'build']);
    } catch (err) {
      if (fs.existsSync(distIndex)) {
        warn(`WARN: frontend build failed; using existing dist/ (${err.message})`);
      } else {
        throw err;
      }
    }
  }

  const port = parseInt(process.env.PORT || '8765', 10);
  await freePort(port);

  log('');
  log(`文匠 Studio → http://127.0.0.1:${port}`);
  log('Starting backend (restart after code changes)...');
  log('');

  const server = path.join(backendNode, 'server.js');
  const child = spawn(process.execPath, [server], {
    cwd: backendNode,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
