#!/usr/bin/env node
/**
 * 2C-2 Migration Dry Run — 只读，不写 data/
 * @see docs/v2.8-migration-design.md
 *
 * Usage:
 *   node backend-node/scripts/migration-dry-run.mjs --project <id> [--out reports/]
 *   node backend-node/scripts/migration-dry-run.mjs --all [--out reports/]
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { scanSources, countNameMentions } from '../story-kb/scan-sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');

const STOPWORDS = new Set([
  '我知', '那个人', '巨大的', '个巨大的', '阳逸清没', '他说', '她说', '众人', '有人',
]);

const ENTITY_FILES = {
  characters: 'character',
  locations: 'location',
  organizations: 'organization',
  relationships: 'relationship',
  timeline: 'event',
};

const BASE32 = '0123456789abcdefghijklmnopqrstuvwxyz';

function parseArgs(argv) {
  const args = { project: null, all: false, out: path.join(ROOT, 'reports') };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--project' && argv[i + 1]) args.project = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) args.out = path.resolve(argv[++i]);
    else if (argv[i] === '--all') args.all = true;
  }
  return args;
}

/** Dry-run 稳定 id（Phase C 用 generateEntityId 真随机） */
function deterministicDryRunId(entityType, legacyId) {
  const prefix = { character: 'char', location: 'loc', organization: 'org', relationship: 'rel', event: 'evt' }[entityType] || 'char';
  const h = crypto.createHash('sha256').update(`${entityType}:${legacyId}`).digest();
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += BASE32[h[i] % BASE32.length];
  return `${prefix}_${suffix}`;
}

function loadKnowledgeEntities(projectId) {
  const kdir = path.join(DATA, 'projects', projectId, 'knowledge');
  const entities = [];
  if (!fs.existsSync(kdir)) return entities;
  for (const [file, type] of Object.entries(ENTITY_FILES)) {
    const fp = path.join(kdir, `${file}.json`);
    if (!fs.existsSync(fp)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const items = data.items || data.events || [];
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        entities.push({
          type,
          legacy_id: it.id || it.name || '',
          name: (it.name || it.id || '').trim(),
          source: it.source || data.source || 'unknown',
          raw: it,
        });
      }
    } catch {
      /* skip corrupt */
    }
  }
  return entities;
}

function buildRelationshipRefs(projectId) {
  const refs = new Set();
  const fp = path.join(DATA, 'projects', projectId, 'knowledge', 'relationships.json');
  if (!fs.existsSync(fp)) return refs;
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const rel of data.items || []) {
      for (const key of ['from', 'to', 'from_id', 'to_id', 'source', 'target']) {
        const v = rel[key];
        if (typeof v === 'string' && v.trim()) refs.add(v.trim());
      }
    }
  } catch {}
  return refs;
}

function isReferencedByRelationship(name, legacyId, relRefs) {
  return relRefs.has(name) || relRefs.has(legacyId);
}

function isTruncationFragment(name, { mentionCount, keptByR1R2 }) {
  if (STOPWORDS.has(name)) return false; // R4 handles
  if (keptByR1R2) return false;
  if (name.length <= 2 && mentionCount === 0) return true;
  if (/^个[\u4e00-\u9fa5]{1,4}$/.test(name)) return true;
  if (/[\u4e00-\u9fa5]{2,3}没$/.test(name) && name.length <= 5) return true;
  if (/^(我|你|他|她|它|这|那|众|有)[\u4e00-\u9fa5]{0,3}$/.test(name) && mentionCount < 3) return true;
  return false;
}

function classifyEntity(entity, { relRefs, mentionCount }) {
  const { name, legacy_id: legacyId, source, type } = entity;

  const r1 = source === 'user';
  const r2 = isReferencedByRelationship(name, legacyId, relRefs);
  const r3Active = mentionCount >= 3;
  const r3Provisional = mentionCount >= 1 && mentionCount <= 2;

  if (r1) {
    return { status: 'active', rule: 'R1', reason: 'source_user' };
  }
  if (r2) {
    return { status: 'active', rule: 'R2', reason: 'relationship_ref' };
  }

  // R4/R5 先于 R3：停用词/碎片在正文中常被子串误计（如「我知」⊂「我知道」）
  if (STOPWORDS.has(name)) {
    return { status: 'rejected', rule: 'R4', reason: 'stopword_fragment' };
  }
  if (isTruncationFragment(name, { mentionCount, keptByR1R2: r1 || r2 })) {
    return { status: 'rejected', rule: 'R5', reason: 'truncation_fragment' };
  }

  if (r3Active) {
    return { status: 'active', rule: 'R3', reason: `mentions_${mentionCount}` };
  }
  if (r3Provisional) {
    return { status: 'provisional', rule: 'R3', reason: `mentions_${mentionCount}` };
  }

  if (source === 'inferred') {
    return { status: 'provisional', rule: 'R6', reason: 'inferred_unknown' };
  }

  return { status: 'provisional', rule: 'R6', reason: 'default_provisional' };
}
function analyzeSnapshots(projectId) {
  const studioPath = path.join(DATA, 'studio.json');
  if (!fs.existsSync(studioPath)) {
    return { count: 0, bytes_before: 0, bytes_after_estimate: 0, dedup_hypothetical_savings_pct: 0, policy: 'full_content_per_version' };
  }
  const studio = JSON.parse(fs.readFileSync(studioPath, 'utf8'));
  const snaps = studio.snapshots?.[projectId] || [];
  let bytesBefore = 0;
  const uniqueByHash = new Map();

  for (const snap of snaps) {
    for (const f of snap.files || []) {
      const content = f.content || '';
      const bytes = Buffer.byteLength(content, 'utf8');
      bytesBefore += bytes;
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      if (!uniqueByHash.has(hash)) uniqueByHash.set(hash, bytes);
    }
  }

  let uniqueBytes = 0;
  for (const bytes of uniqueByHash.values()) uniqueBytes += bytes;

  const savingsPct = bytesBefore > 0
    ? Math.round((1 - uniqueBytes / bytesBefore) * 1000) / 10
    : 0;

  const metadataOverhead = snaps.length * 512;

  return {
    count: snaps.length,
    bytes_before: bytesBefore,
    bytes_after_estimate: bytesBefore + metadataOverhead,
    dedup_hypothetical_savings_pct: savingsPct,
    policy: 'full_content_per_version',
  };
}

function analyzeMeasurement(projectId) {
  const pdir = path.join(DATA, 'projects', projectId);
  const studioPath = path.join(DATA, 'studio.json');
  let reviewMigrate = false;
  if (fs.existsSync(studioPath)) {
    const studio = JSON.parse(fs.readFileSync(studioPath, 'utf8'));
    reviewMigrate = Boolean(studio.review_by_project?.[projectId]);
  }
  return {
    review_migrate: reviewMigrate,
    verify_log_migrate: fs.existsSync(path.join(pdir, 'verify', 'verify_log.json')),
    health_snapshot_drop: fs.existsSync(path.join(pdir, 'verify', 'health_snapshot.json')),
  };
}

async function dryRunProject(projectId, outDir) {
  const entities = loadKnowledgeEntities(projectId);
  const relRefs = buildRelationshipRefs(projectId);

  let chapters = [];
  const warnings = [];
  try {
    const scan = scanSources(projectId, { latestChapters: 1e6 });
    chapters = scan.chapters || [];
  } catch (e) {
    warnings.push(`workspace_scan_failed: ${e.message}`);
  }

  const idMappings = [];
  const rejectedEntities = [];
  let active = 0;
  let provisional = 0;
  let rejected = 0;
  const assignedIds = new Set();

  for (const ent of entities) {
    if (ent.type === 'relationship') continue; // edges migrated separately

    const mentionCount = ent.type === 'character'
      ? countNameMentions(chapters, ent.name)
      : 0;

    const { status, rule, reason } = classifyEntity(ent, { relRefs, mentionCount });

    if (status === 'rejected') {
      rejected++;
      rejectedEntities.push({
        legacy_id: ent.legacy_id,
        name: ent.name,
        type: ent.type,
        rule,
        reason,
        mention_count: mentionCount,
      });
      continue;
    }

    if (status === 'active') active++;
    else provisional++;

    let newId = deterministicDryRunId(ent.type, ent.legacy_id);
    if (assignedIds.has(newId)) {
      warnings.push(`id_collision: ${newId} for ${ent.legacy_id}`);
      newId = deterministicDryRunId(ent.type, `${ent.legacy_id}:dup`);
    }
    assignedIds.add(newId);

    idMappings.push({
      legacy_id: ent.legacy_id,
      new_id: newId,
      status,
      rule,
      reason,
      mention_count: mentionCount,
      entity_type: ent.type,
    });
  }

  const report = {
    schema: 'migration_dry_run',
    project_id: projectId,
    generated_at: new Date().toISOString(),
    dry_run: true,
    note: 'new_id values are deterministic for dry-run only; Phase C uses generateEntityId()',
    entities: { active, provisional, rejected, id_mappings: idMappings },
    snapshots: analyzeSnapshots(projectId),
    measurement: analyzeMeasurement(projectId),
    warnings,
  };

  const rejectReport = {
    schema: 'migration_reject_report',
    project_id: projectId,
    generated_at: report.generated_at,
    rejected_entities: rejectedEntities,
  };

  const projOut = path.join(outDir, projectId);
  fs.mkdirSync(projOut, { recursive: true });
  fs.writeFileSync(path.join(projOut, 'migration_report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(projOut, 'reject_report.json'), JSON.stringify(rejectReport, null, 2));

  return { report, rejectReport };
}

function listProjectIds() {
  const dir = path.join(DATA, 'projects');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((pid) => {
    const p = path.join(dir, pid);
    return fs.statSync(p).isDirectory();
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const ids = args.all
    ? listProjectIds()
    : args.project
      ? [args.project]
      : [];

  if (!ids.length) {
    console.error('Usage: migration-dry-run.mjs --project <id> | --all [--out dir]');
    process.exit(1);
  }

  fs.mkdirSync(args.out, { recursive: true });

  for (const pid of ids) {
    const { report, rejectReport } = await dryRunProject(pid, args.out);
    console.log(`\n=== ${pid} ===`);
    console.log(`entities: active=${report.entities.active} provisional=${report.entities.provisional} rejected=${report.entities.rejected}`);
    console.log(`snapshots: ${report.snapshots.count} before=${report.snapshots.bytes_before}B dedup_savings=${report.snapshots.dedup_hypothetical_savings_pct}%`);
    if (rejectReport.rejected_entities.length) {
      console.log('rejected:', rejectReport.rejected_entities.map((r) => `${r.name}(${r.rule})`).join(', '));
    }
    if (report.warnings.length) console.log('warnings:', report.warnings.join('; '));
    console.log(`written: ${path.join(args.out, pid)}/migration_report.json`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
