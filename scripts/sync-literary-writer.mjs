#!/usr/bin/env node
/**
 * 从外部目录同步 literary-writer skill 到工程内 skills/literary-writer
 *
 * Usage:
 *   node scripts/sync-literary-writer.mjs
 *   node scripts/sync-literary-writer.mjs "E:\归档\literary-writer"
 *   LITERARY_WRITER_SOURCE=/path/to/skill node scripts/sync-literary-writer.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'skills', 'literary-writer');
const IS_WIN = process.platform === 'win32';

const DEFAULT_SOURCE = IS_WIN
  ? 'E:\\归档\\literary-writer'
  : path.join(process.env.HOME || '', '归档', 'literary-writer');

const source = path.resolve(process.argv[2] || process.env.LITERARY_WRITER_SOURCE || DEFAULT_SOURCE);

if (!fs.existsSync(path.join(source, 'SKILL.md'))) {
  console.error(`[ERROR] 源目录无效（缺少 SKILL.md）: ${source}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(TARGET), { recursive: true });

if (IS_WIN) {
  const result = spawnSync(
    'robocopy',
    [source, TARGET, '/E', '/XD', '.git', '__pycache__', '.pytest_cache', '.venv', 'node_modules', '/XF', '*.pyc', '/NFL', '/NDL'],
    { stdio: 'inherit', shell: true },
  );
  const code = result.status ?? 1;
  if (code >= 8) process.exit(1);
} else {
  const result = spawnSync('rsync', ['-a', '--delete', '--exclude', '.git', source + '/', TARGET + '/'], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    // fallback: cp -r
    if (fs.existsSync(TARGET)) fs.rmSync(TARGET, { recursive: true, force: true });
    fs.cpSync(source, TARGET, { recursive: true });
  }
}

const versionPath = path.join(TARGET, '.claude-plugin', 'plugin.json');
let version = '';
try {
  version = JSON.parse(fs.readFileSync(versionPath, 'utf-8')).version || '';
} catch { /* noop */ }

console.log(`\nSynced literary-writer${version ? ` v${version}` : ''}`);
console.log(`  from: ${source}`);
console.log(`  to:   ${TARGET}\n`);
