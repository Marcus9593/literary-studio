#!/usr/bin/env node
/**
 * 2C-3 Phase C 一次性迁移 — 独立脚本，幂等，不写业务逻辑
 * 前置：migration-backup.mjs
 * @see docs/archive/v2.8/v2.8-migration-design.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateEntityId } from '../story-schemas/entity-id.js';
import { reviewLatestPath } from '../measurement/paths.js';
import {
  DATA,
  PHASE_C_VERSION,
  listProjectIds,
  isPhaseCMigrated,
  migrationDir,
  entitiesDir,
  versionsDir,
  projectDir,
  readJson,
  writeJson,
  buildMigrationPlan,
} from './migration-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STABLE_ID = /^(char|loc|org|rel|evt)_[a-z0-9]{8}$/;

function parseArgs(argv) {
  const args = { project: null, all: false, backupDir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--project' && argv[i + 1]) args.project = argv[++i];
    else if (argv[i] === '--all') args.all = true;
    else if (argv[i] === '--backup-dir' && argv[i + 1]) args.backupDir = argv[++i];
  }
  return args;
}

function now() {
  return new Date().toISOString();
}

function migrateEntities(projectId, plan) {
  const at = now();
  const flatMapping = {};
  const byType = { character: [], location: [], organization: [], event: [] };

  for (const row of plan.idMappings) {
    const newId = generateEntityId(row.entity_type === 'character' ? 'character'
      : row.entity_type === 'location' ? 'location'
        : row.entity_type === 'organization' ? 'organization' : 'event');
    flatMapping[row.legacy_id] = newId;
    const item = {
      id: newId,
      entity_type: row.entity_type,
      name: row.name,
      aliases: row.raw?.aliases || [],
      legacy_id: row.legacy_id,
      source: row.raw?.source || 'inferred',
      status: row.status,
      migration: { at, rule: row.rule, from_file: `${row.entity_type}s.json` },
      ...(row.raw?.role ? { role: row.raw.role } : {}),
      ...(row.raw?.notes ? { notes: row.raw.notes } : {}),
    };
    const bucket = row.entity_type === 'character' ? 'character'
      : row.entity_type === 'location' ? 'location'
        : row.entity_type === 'organization' ? 'organization' : 'event';
    byType[bucket].push(item);
  }

  const entRoot = entitiesDir(projectId);
  fs.mkdirSync(entRoot, { recursive: true });

  if (byType.character.length) {
    writeJson(path.join(entRoot, 'characters.json'), {
      migration_version: PHASE_C_VERSION,
      version: 2,
      updated_at: at,
      items: byType.character,
    });
  } else {
    writeJson(path.join(entRoot, 'characters.json'), {
      migration_version: PHASE_C_VERSION,
      version: 2,
      updated_at: at,
      items: [],
    });
  }

  if (byType.location.length) {
    writeJson(path.join(entRoot, 'locations.json'), {
      migration_version: PHASE_C_VERSION,
      version: 2,
      updated_at: at,
      items: byType.location,
    });
  }
  if (byType.organization.length) {
    writeJson(path.join(entRoot, 'organizations.json'), {
      migration_version: PHASE_C_VERSION,
      version: 2,
      updated_at: at,
      items: byType.organization,
    });
  }
  if (byType.event.length) {
    writeJson(path.join(entRoot, 'events.json'), {
      migration_version: PHASE_C_VERSION,
      version: 2,
      updated_at: at,
      events: byType.event,
    });
  }

  const relSrc = readJson(path.join(projectDir(projectId), 'knowledge', 'relationships.json'), { items: [] });
  const relItems = (relSrc.items || []).map((rel) => {
    const fromKey = rel.from_id || rel.from;
    const toKey = rel.to_id || rel.to;
    const from_id = flatMapping[fromKey] || (STABLE_ID.test(fromKey) ? fromKey : null);
    const to_id = flatMapping[toKey] || (STABLE_ID.test(toKey) ? toKey : null);
    return {
      ...rel,
      from_id,
      to_id,
      legacy_from: fromKey,
      legacy_to: toKey,
      migration: { at, version: PHASE_C_VERSION },
    };
  });
  if (relItems.length) {
    writeJson(path.join(entRoot, 'relationships.json'), {
      migration_version: PHASE_C_VERSION,
      version: 2,
      updated_at: at,
      items: relItems,
    });
  }

  const migDir = migrationDir(projectId);
  fs.mkdirSync(migDir, { recursive: true });
  writeJson(path.join(migDir, 'id-mapping.json'), {
    schema: 'phase_c_id_mapping',
    project_id: projectId,
    migration_version: PHASE_C_VERSION,
    generated_at: at,
    mapping: flatMapping,
    rejected: plan.rejected.map((r) => ({
      legacy_id: r.legacy_id,
      name: r.name,
      rule: r.rule,
      reason: r.reason,
    })),
  });

  return { flatMapping, counts: { migrated: plan.idMappings.length, rejected: plan.rejected.length } };
}

function migrateVersions(projectId) {
  const studio = readJson(path.join(DATA, 'studio.json'));
  const snaps = studio?.snapshots?.[projectId] || [];
  const vroot = versionsDir(projectId);
  const manifestItems = [];

  for (const snap of snaps) {
    const vid = snap.id.startsWith('v_') ? snap.id : `v_${snap.id}`;
    const vdir = path.join(vroot, vid);
    const filesDir = path.join(vdir, 'files');
    fs.mkdirSync(filesDir, { recursive: true });

    for (const f of snap.files || []) {
      const rel = String(f.path || '').replace(/^\/+/, '');
      if (!rel) continue;
      const dest = path.join(filesDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, String(f.content ?? ''), 'utf8');
    }

    writeJson(path.join(vdir, 'metadata.json'), {
      id: vid,
      legacy_snapshot_id: snap.id,
      project_id: projectId,
      title: snap.title || '',
      notes: snap.notes || '',
      created_at: snap.created_at || now(),
      parent: null,
      file_count: (snap.files || []).length,
      migration_version: PHASE_C_VERSION,
    });
    manifestItems.push({
      id: vid,
      legacy_snapshot_id: snap.id,
      title: snap.title,
      created_at: snap.created_at,
    });
  }

  writeJson(path.join(vroot, 'manifest.json'), {
    migration_version: PHASE_C_VERSION,
    version: 1,
    updated_at: now(),
    head: manifestItems[0]?.id || null,
    items: manifestItems,
  });

  return { count: snaps.length };
}

function migrateMeasurement(projectId) {
  const studio = readJson(path.join(DATA, 'studio.json'));
  const review = studio?.review_by_project?.[projectId];
  if (review) {
    const dest = reviewLatestPath(projectId);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    writeJson(dest, {
      schema: 'measurement_review_latest',
      migration_version: PHASE_C_VERSION,
      project_id: projectId,
      checks: review.checks || [],
      hints: review.hints || [],
      manuscript_words: review.manuscript_words || 0,
      updated_at: review.updated_at || now(),
      _migrated_from: 'studio.review_by_project',
    });
  }

  const hs = path.join(projectDir(projectId), 'verify', 'health_snapshot.json');
  if (fs.existsSync(hs)) {
    const archive = path.join(projectDir(projectId), 'migration', 'archived-health_snapshot.json');
    fs.copyFileSync(hs, archive);
    fs.unlinkSync(hs);
  }

  return { review_migrated: Boolean(review), health_snapshot_dropped: fs.existsSync(path.join(projectDir(projectId), 'migration', 'archived-health_snapshot.json')) };
}

function migrateUnderstanding(projectId) {
  const kdir = path.join(projectDir(projectId), 'knowledge');
  const udir = path.join(projectDir(projectId), 'understanding');
  fs.mkdirSync(udir, { recursive: true });

  const fore = readJson(path.join(kdir, 'foreshadows.json'));
  if (fore && (fore.items || []).length) {
    writeJson(path.join(udir, 'foreshadows.json'), { ...fore, migration_version: PHASE_C_VERSION, updated_at: now() });
  }

  const summary = readJson(path.join(kdir, 'story_summary.json'));
  if (summary) {
    const notesDir = path.join(kdir, 'notes');
    fs.mkdirSync(notesDir, { recursive: true });
    writeJson(path.join(notesDir, 'imported_summary.json'), {
      migration_version: PHASE_C_VERSION,
      imported_at: now(),
      ...summary,
    });
  }
}

async function migrateProject(projectId, backupDir) {
  if (isPhaseCMigrated(projectId)) {
    console.log(`[skip] ${projectId}: already at ${PHASE_C_VERSION}`);
    return { skipped: true };
  }

  const plan = await buildMigrationPlan(projectId);
  const entities = migrateEntities(projectId, plan);
  const versions = migrateVersions(projectId);
  const measurement = migrateMeasurement(projectId);
  migrateUnderstanding(projectId);

  writeJson(path.join(migrationDir(projectId), 'phase-c-manifest.json'), {
    schema: 'phase_c_manifest',
    migration_version: PHASE_C_VERSION,
    project_id: projectId,
    migrated_at: now(),
    backup_dir: backupDir || readJson(path.join(DATA, 'migration', 'latest-backup.json'))?.backup_dir || null,
    entities,
    versions,
    measurement,
  });

  console.log(`[ok] ${projectId}: entities=${entities.counts.migrated} rejected=${entities.counts.rejected} versions=${versions.count}`);
  return { skipped: false, entities, versions };
}

async function main() {
  const args = parseArgs(process.argv);
  const ids = args.all ? listProjectIds() : args.project ? [args.project] : [];
  if (!ids.length) {
    console.error('Usage: migration-phase-c.mjs --project <id> | --all [--backup-dir path]');
    process.exit(1);
  }

  for (const pid of ids) {
    await migrateProject(pid, args.backupDir);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
