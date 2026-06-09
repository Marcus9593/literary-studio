#!/usr/bin/env node
/**
 * 2C-3 校验 — 独立脚本；失败 exit 1（含 referential integrity）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DATA,
  PHASE_C_VERSION,
  STABLE_ID,
  listProjectIds,
  isPhaseCMigrated,
  entitiesDir,
  versionsDir,
  projectDir,
  readJson,
  STOPWORDS,
} from './migration-lib.mjs';
import { reviewLatestPath } from '../measurement/paths.js';

const REJECTED_NAMES = [...STOPWORDS];

function parseArgs(argv) {
  const args = { project: null, all: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--project' && argv[i + 1]) args.project = argv[++i];
    else if (argv[i] === '--all') args.all = true;
  }
  return args;
}

function fail(errors, projectId) {
  console.error(`\n[FAIL] ${projectId}`);
  for (const e of errors) console.error(`  - ${e}`);
  return errors;
}

function collectEntityIds(projectId) {
  const ids = new Set();
  const entRoot = entitiesDir(projectId);
  if (!fs.existsSync(entRoot)) return ids;
  for (const f of fs.readdirSync(entRoot).filter((x) => x.endsWith('.json'))) {
    const data = readJson(path.join(entRoot, f));
    const rows = data?.items || data?.events || [];
    for (const it of rows) {
      if (it?.id) ids.add(it.id);
    }
  }
  return ids;
}

function validateReferentialIntegrity(projectId, entityIds) {
  const errors = [];
  const relFp = path.join(entitiesDir(projectId), 'relationships.json');
  if (!fs.existsSync(relFp)) return errors;

  const relData = readJson(relFp);
  for (const rel of relData?.items || []) {
    for (const [side, val] of [['from_id', rel.from_id], ['to_id', rel.to_id]]) {
      if (!val) {
        errors.push(`relationship orphan: ${side} missing (legacy ${rel.legacy_from || '?'})`);
        continue;
      }
      if (!entityIds.has(val)) {
        errors.push(`relationship orphan: ${side}=${val} not in entities/*`);
      }
    }
  }
  return errors;
}

function validateProject(projectId) {
  const errors = [];

  if (!isPhaseCMigrated(projectId)) {
    return fail([`project not migrated (${PHASE_C_VERSION})`], projectId);
  }

  const chars = readJson(path.join(entitiesDir(projectId), 'characters.json'));
  if (chars?.migration_version !== PHASE_C_VERSION) {
    errors.push('characters.json missing migration_version');
  }

  const mapping = readJson(path.join(projectDir(projectId), 'migration', 'id-mapping.json'));
  if (!mapping?.mapping || typeof mapping.mapping !== 'object') {
    errors.push('migration/id-mapping.json missing or invalid');
  } else {
    const ids = new Set(Object.values(mapping.mapping));
    if (ids.size !== Object.keys(mapping.mapping).length) {
      errors.push('id-mapping collision detected');
    }
    for (const id of ids) {
      if (!STABLE_ID.test(id)) errors.push(`invalid stable id: ${id}`);
    }
  }

  for (const name of REJECTED_NAMES) {
    for (const it of chars?.items || []) {
      if (it.name === name || it.legacy_id === name) {
        errors.push(`rejected entity leaked into entities: ${name}`);
      }
    }
  }

  for (const it of chars?.items || []) {
    if (it.id === it.name && !STABLE_ID.test(it.id)) {
      errors.push(`legacy id=name still present: ${it.name}`);
    }
    if (!STABLE_ID.test(it.id)) errors.push(`invalid character id: ${it.id}`);
  }

  const entityIds = collectEntityIds(projectId);
  errors.push(...validateReferentialIntegrity(projectId, entityIds));

  const manifest = readJson(path.join(versionsDir(projectId), 'manifest.json'));
  const studioData = readJson(path.join(DATA, 'studio.json'));

  const snapCount = studioData?.snapshots?.[projectId]?.length ?? 0;
  const versionCount = manifest?.items?.length ?? 0;
  if (snapCount > 0 && versionCount < snapCount) {
    errors.push(`versions count ${versionCount} < legacy snapshots ${snapCount}`);
  }

  for (const item of manifest?.items || []) {
    const vdir = path.join(versionsDir(projectId), item.id);
    if (!fs.existsSync(path.join(vdir, 'metadata.json'))) {
      errors.push(`version missing metadata: ${item.id}`);
    }
    const filesDir = path.join(vdir, 'files');
    if (!fs.existsSync(filesDir)) {
      errors.push(`version missing files/: ${item.id}`);
    }
  }

  const reviewFp = reviewLatestPath(projectId);
  const hadStudioReview = Boolean(studioData?.review_by_project?.[projectId]);
  if (hadStudioReview && !fs.existsSync(reviewFp)) {
    errors.push('measurement/review/latest.json missing after migration');
  }

  const hs = path.join(projectDir(projectId), 'verify', 'health_snapshot.json');
  if (fs.existsSync(hs)) {
    errors.push('health_snapshot.json should be dropped');
  }

  if (errors.length) return fail(errors, projectId);
  console.log(`[PASS] ${projectId}`);
  return [];
}

function main() {
  const args = parseArgs(process.argv);
  const ids = args.all ? listProjectIds() : args.project ? [args.project] : [];
  if (!ids.length) {
    console.error('Usage: migration-validate.mjs --project <id> | --all');
    process.exit(1);
  }

  let allErrors = [];
  for (const pid of ids) {
    allErrors = allErrors.concat(validateProject(pid));
  }

  if (allErrors.length) process.exit(1);
  console.log('\nAll projects passed.');
}

main();
