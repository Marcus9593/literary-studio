#!/usr/bin/env node
/**
 * 2C-3 §1 备份 — 独立脚本，不与 phase-c 合并
 * @see docs/v2.8-phase-c-rollback.md
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { DATA, ROOT, listProjectIds, writeJson } from './migration-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { project: null, all: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--project' && argv[i + 1]) args.project = argv[++i];
    else if (argv[i] === '--all') args.all = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const ids = args.all ? listProjectIds() : args.project ? [args.project] : [];
  if (!ids.length) {
    console.error('Usage: migration-backup.mjs --project <id> | --all');
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupRoot = path.join(DATA, 'backup', `phase-c-${stamp}`);
  fs.mkdirSync(backupRoot, { recursive: true });

  const studioPath = path.join(DATA, 'studio.json');
  if (fs.existsSync(studioPath)) {
    fs.copyFileSync(studioPath, path.join(backupRoot, 'studio.json.bak'));
  }

  for (const id of ids) {
    const src = path.join(DATA, 'projects', id);
    const tgz = path.join(backupRoot, `projects-${id}.tar.gz`);
    execSync(`tar -czf "${tgz}" -C "${path.join(DATA, 'projects')}" "${id}"`, { stdio: 'inherit' });
  }

  const meta = {
    schema: 'phase_c_backup',
    created_at: new Date().toISOString(),
    backup_dir: backupRoot,
    projects: ids,
  };
  writeJson(path.join(backupRoot, 'backup-manifest.json'), meta);
  writeJson(path.join(DATA, 'migration', 'latest-backup.json'), meta);

  console.log(JSON.stringify(meta, null, 2));
  console.log(`\nBackup complete: ${backupRoot}`);
}

main();
