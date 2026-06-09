/**
 * Phase C 共享常量与纯数据变换（非业务逻辑）
 * 供 dry-run / phase-c / validate 共用，避免规则漂移
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanSources, countNameMentions } from '../story-kb/scan-sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');
export const DATA = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
export const PHASE_C_VERSION = 'phase-c-v1';

export const STOPWORDS = new Set([
  '我知', '那个人', '巨大的', '个巨大的', '阳逸清没', '他说', '她说', '众人', '有人',
]);

export const ENTITY_FILES = {
  characters: 'character',
  locations: 'location',
  organizations: 'organization',
  relationships: 'relationship',
  timeline: 'event',
};

export const STABLE_ID = /^(char|loc|org|rel|evt)_[a-z0-9]{8}$/;

export function projectDir(projectId) {
  return path.join(DATA, 'projects', projectId);
}

export function migrationDir(projectId) {
  return path.join(projectDir(projectId), 'migration');
}

export function entitiesDir(projectId) {
  return path.join(projectDir(projectId), 'knowledge', 'entities');
}

export function versionsDir(projectId) {
  return path.join(projectDir(projectId), 'versions');
}

export function readJson(fp, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(fp, data) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

export function listProjectIds() {
  const dir = path.join(DATA, 'projects');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((pid) => fs.statSync(path.join(dir, pid)).isDirectory());
}

export function isPhaseCMigrated(projectId) {
  const entFp = path.join(entitiesDir(projectId), 'characters.json');
  const ent = readJson(entFp);
  if (ent?.migration_version === PHASE_C_VERSION) return true;
  const manifest = readJson(path.join(migrationDir(projectId), 'phase-c-manifest.json'));
  return manifest?.migration_version === PHASE_C_VERSION;
}

export function loadKnowledgeEntities(projectId) {
  const kdir = path.join(projectDir(projectId), 'knowledge');
  const entities = [];
  if (!fs.existsSync(kdir)) return entities;
  for (const [file, type] of Object.entries(ENTITY_FILES)) {
    const fp = path.join(kdir, `${file}.json`);
    if (!fs.existsSync(fp)) continue;
    const data = readJson(fp);
    if (!data) continue;
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
  }
  return entities;
}

export function buildRelationshipRefs(projectId) {
  const refs = new Set();
  const data = readJson(path.join(projectDir(projectId), 'knowledge', 'relationships.json'));
  if (!data) return refs;
  for (const rel of data.items || []) {
    for (const key of ['from', 'to', 'from_id', 'to_id', 'source', 'target']) {
      const v = rel[key];
      if (typeof v === 'string' && v.trim()) refs.add(v.trim());
    }
  }
  return refs;
}

function isTruncationFragment(name, { mentionCount, keptByR1R2 }) {
  if (STOPWORDS.has(name)) return false;
  if (keptByR1R2) return false;
  if (name.length <= 2 && mentionCount === 0) return true;
  if (/^个[\u4e00-\u9fa5]{1,4}$/.test(name)) return true;
  if (/[\u4e00-\u9fa5]{2,3}没$/.test(name) && name.length <= 5) return true;
  if (/^(我|你|他|她|它|这|那|众|有)[\u4e00-\u9fa5]{0,3}$/.test(name) && mentionCount < 3) return true;
  return false;
}

export function classifyEntity(entity, { relRefs, mentionCount }) {
  const { name, legacy_id: legacyId, source } = entity;
  const r1 = source === 'user';
  const r2 = relRefs.has(name) || relRefs.has(legacyId);
  const r3Active = mentionCount >= 3;
  const r3Provisional = mentionCount >= 1 && mentionCount <= 2;

  if (r1) return { status: 'active', rule: 'R1', reason: 'source_user' };
  if (r2) return { status: 'active', rule: 'R2', reason: 'relationship_ref' };
  if (STOPWORDS.has(name)) return { status: 'rejected', rule: 'R4', reason: 'stopword_fragment' };
  if (isTruncationFragment(name, { mentionCount, keptByR1R2: r1 || r2 })) {
    return { status: 'rejected', rule: 'R5', reason: 'truncation_fragment' };
  }
  if (r3Active) return { status: 'active', rule: 'R3', reason: `mentions_${mentionCount}` };
  if (r3Provisional) return { status: 'provisional', rule: 'R3', reason: `mentions_${mentionCount}` };
  if (source === 'inferred') return { status: 'provisional', rule: 'R6', reason: 'inferred_unknown' };
  return { status: 'provisional', rule: 'R6', reason: 'default_provisional' };
}

export async function scanChapters(projectId) {
  try {
    const scan = scanSources(projectId, { latestChapters: 1e6 });
    return scan.chapters || [];
  } catch {
    return [];
  }
}

export async function buildMigrationPlan(projectId) {
  const relRefs = buildRelationshipRefs(projectId);
  const chapters = await scanChapters(projectId);
  const entities = loadKnowledgeEntities(projectId);
  const idMappings = [];
  const rejected = [];

  for (const ent of entities) {
    if (ent.type === 'relationship') continue;
    const mentionCount = ent.type === 'character' ? countNameMentions(chapters, ent.name) : 0;
    const decision = classifyEntity(ent, { relRefs, mentionCount });
    if (decision.status === 'rejected') {
      rejected.push({ ...ent, ...decision, mention_count: mentionCount });
      continue;
    }
    idMappings.push({
      legacy_id: ent.legacy_id,
      name: ent.name,
      entity_type: ent.type,
      status: decision.status,
      rule: decision.rule,
      reason: decision.reason,
      mention_count: mentionCount,
      raw: ent.raw,
    });
  }
  return { idMappings, rejected, relRefs };
}
