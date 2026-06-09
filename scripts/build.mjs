#!/usr/bin/env node
/** Build frontend dist (all platforms) */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(ROOT, 'frontend');
const IS_WIN = process.platform === 'win32';

if (!fs.existsSync(path.join(frontend, 'package.json'))) {
  console.error('frontend/package.json not found');
  process.exit(1);
}

function runNpm(args) {
  const result = spawnSync('npm', args, {
    cwd: frontend,
    stdio: 'inherit',
    shell: IS_WIN,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runNpm(['install']);
runNpm(['run', 'build']);
console.log('Frontend build complete → frontend/dist/');
