/**
 * Entity Index — 为 Resolver 构建 O(1) 查找表（非 Store / 非 Service）
 */
import fs from 'fs';
import path from 'path';
import { knowledgeDir } from './paths.js';
import { loadKnowledgeBundle, isPhaseCEntities } from './store.js';

const STABLE_ID = /^(char|loc|org|rel|evt)_[a-z0-9]{8}$/;

function entitiesDir(projectId) {
  return path.join(knowledgeDir(projectId), 'entities');
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeKey(s) {
  return String(s || '').trim();
}

function addToMap(map, key, entityId, { allowOverwrite = false } = {}) {
  const k = normalizeKey(key);
  if (!k) return;
  if (!allowOverwrite && map.has(k)) return;
  map.set(k, entityId);
}

/**
 * @param {string} projectId
 * @returns {{ idMap: Map<string, object>, nameMap: Map<string, string>, aliasMap: Map<string, string>, legacyMap: Map<string, string>, byCanonicalId: Map<string, object> }}
 */
export function buildEntityIndex(projectId) {
  const raw = loadEntityRecords(projectId);
  return buildEntityIndexFromRecords(raw);
}

/** @param {object[]} records */
export function buildEntityIndexFromRecords(records) {
  const idMap = new Map();
  const nameMap = new Map();
  const aliasMap = new Map();
  const legacyMap = new Map();
  const byCanonicalId = new Map();

  for (const ent of records) {
    if (!ent?.id) continue;
    idMap.set(ent.id, ent);
  }

  for (const ent of records) {
    if (!ent?.id) continue;
    const id = ent.id;
    if (ent.name) addToMap(nameMap, ent.name, id);
    if (ent.legacy_id) addToMap(legacyMap, ent.legacy_id, id);
    if (!STABLE_ID.test(id) && ent.id === ent.name) {
      addToMap(legacyMap, ent.id, id);
    }
    for (const alias of ent.aliases || []) {
      addToMap(aliasMap, alias, id);
    }
  }

  for (const ent of records) {
    if (!ent?.id) continue;
    let canonicalId = ent.id;
    let cursor = ent;
    const visited = new Set();
    while (cursor.status === 'merged' && cursor.merged_into && !visited.has(canonicalId)) {
      visited.add(canonicalId);
      const target = idMap.get(cursor.merged_into);
      if (!target) {
        canonicalId = cursor.merged_into;
        break;
      }
      canonicalId = target.id;
      cursor = target;
    }
    const canonical = idMap.get(canonicalId) || cursor;
    byCanonicalId.set(canonical.id, canonical);
  }

  return { idMap, nameMap, aliasMap, legacyMap, byCanonicalId };
}

function loadEntityRecords(projectId) {
  const records = [];
  const pushItems = (items, entityType) => {
    for (const it of items || []) {
      records.push({
        entity_type: it.entity_type || entityType,
        ...it,
      });
    }
  };

  if (isPhaseCEntities(projectId)) {
    const dir = entitiesDir(projectId);
    const files = [
      ['characters.json', 'character', 'items'],
      ['locations.json', 'location', 'items'],
      ['organizations.json', 'organization', 'items'],
      ['events.json', 'event', 'events'],
    ];
    for (const [file, type, key] of files) {
      const fp = path.join(dir, file);
      if (!fs.existsSync(fp)) continue;
      const data = readJson(fp);
      if (data) pushItems(data[key] || data.items, type);
    }
    return records;
  }

  const bundle = loadKnowledgeBundle(projectId);
  pushItems(bundle.characters?.items, 'character');
  pushItems(bundle.locations?.items, 'location');
  pushItems(bundle.timeline?.events, 'event');
  return records;
}
