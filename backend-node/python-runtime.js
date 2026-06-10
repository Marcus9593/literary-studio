import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

let cachedPython = null;

function isExecutablePath(cmd) {
  return path.isAbsolute(cmd) || cmd.includes('/') || cmd.includes('\\');
}

function discoverWindowsPythonExe() {
  try {
    const r = spawnSync('py', ['-3', '-c', 'import sys; print(sys.executable)'], {
      encoding: 'utf-8',
      timeout: 8000,
    });
    if (r.status !== 0) return null;
    const exe = r.stdout.trim().split(/\r?\n/).pop()?.trim();
    if (exe && fs.existsSync(exe) && !/WindowsApps/i.test(exe)) return exe;
  } catch {
    // fall through
  }
  return null;
}

function resolvePythonPath(cmd) {
  if (isExecutablePath(cmd) && !/WindowsApps/i.test(cmd)) return cmd;
  if (process.platform === 'win32') {
    const discovered = discoverWindowsPythonExe();
    if (discovered) return discovered;
  }
  if (isExecutablePath(cmd)) return cmd;

  try {
    const r = spawnSync('where', [cmd], { encoding: 'utf-8', shell: true, timeout: 5000 });
    if (r.status !== 0) return cmd;
    const lines = r.stdout.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const exe = lines.find((l) => /\.exe$/i.test(l) && !/WindowsApps/i.test(l) && fs.existsSync(l));
    return exe || cmd;
  } catch {
    return cmd;
  }
}

function spawnPythonCmd(cmd, args, options = {}) {
  const useShell = options.shell ?? (!isExecutablePath(cmd) && process.platform === 'win32');
  return spawnSync(cmd, args, {
    encoding: 'utf-8',
    shell: useShell,
    ...options,
  });
}

function pythonRuns(cmd) {
  try {
    const probe = spawnPythonCmd(cmd, ['--version'], { timeout: 5000 });
    return probe.status === 0;
  } catch {
    return false;
  }
}

/** Resolve Python executable (Windows + Unix + venv). */
export function findPython() {
  if (cachedPython) return cachedPython;
  if (process.env.PYTHON) {
    cachedPython = resolvePythonPath(process.env.PYTHON);
    return cachedPython;
  }

  const candidates = [
    path.join(ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(ROOT, '.venv', 'bin', 'python3'),
    ...(process.platform === 'win32' ? [discoverWindowsPythonExe()].filter(Boolean) : []),
    'python3',
    'python',
  ];

  for (const cmd of candidates) {
    if (isExecutablePath(cmd) && !fs.existsSync(cmd)) continue;
    const resolved = resolvePythonPath(cmd);
    if (pythonRuns(resolved)) {
      cachedPython = resolved;
      return cachedPython;
    }
  }

  cachedPython = resolvePythonPath(process.platform === 'win32' ? 'python' : 'python3');
  return cachedPython;
}

const runtimeCache = new Map();

/** Whether Python can run convert_cli.py (zip extract uses stdlib only). */
export function isPythonRuntimeAvailable(cliPath) {
  const key = cliPath || '__none__';
  if (runtimeCache.has(key)) return runtimeCache.get(key);

  let ok = false;
  if (cliPath && fs.existsSync(cliPath)) {
    ok = pythonRuns(findPython());
  }
  runtimeCache.set(key, ok);
  return ok;
}

/** Whether mammoth + pymupdf are installed for docx/pdf conversion. */
export function isDocConvertLibsAvailable() {
  try {
    const probe = spawnPythonCmd(findPython(), [
      '-c',
      'import mammoth; import fitz; import markdownify',
    ], { timeout: 8000 });
    return probe.status === 0;
  } catch {
    return false;
  }
}

export function spawnPython(args, options = {}) {
  const py = findPython();
  const useShell = options.shell ?? (!isExecutablePath(py) && process.platform === 'win32');
  return spawnSync(py, args, {
    encoding: 'utf-8',
    shell: useShell,
    ...options,
  });
}
