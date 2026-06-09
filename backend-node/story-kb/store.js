import fs from 'fs';
import path from 'path';
import { knowledgeDir, knowledgePath } from './paths.js';
import { emptyKnowledge, KB_FILE_MAP } from './defaults.js';
import { assertLegacyKbRootWrite } from '../migration/legacy-write-guard.js';
import { generateEntityId } from '../story-schemas/entity-id.js';
import { invalidateEntityIndex } from './entity-resolver.js';

const ENTITIES_FILE_MAP = {
  characters: 'characters.json',
  relationships: 'relationships.json',
  locations: 'locations.json',
  timeline: 'events.json',
};

function entitiesPath(projectId, filename) {
  return path.join(knowledgeDir(projectId), 'entities', filename);
}

export function isPhaseCEntities(projectId) {
  const fp = entitiesPath(projectId, 'characters.json');
  if (!fs.existsSync(fp)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return Boolean(raw.migration_version);
  } catch {
    return false;
  }
}

function now() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function ensureKnowledgeDir(projectId) {
  const dir = knowledgeDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadKbSlice(projectId, key, legacyFile, defaults) {
  const useEntities = isPhaseCEntities(projectId) && ENTITIES_FILE_MAP[key];
  if (useEntities) {
    const entFp = entitiesPath(projectId, ENTITIES_FILE_MAP[key]);
    if (fs.existsSync(entFp)) {
      const data = readJson(entFp, defaults[key]);
      if (key === 'timeline' && data.events && !data.items) {
        return { ...defaults.timeline, ...data, events: data.events };
      }
      return data;
    }
  }
  if (key === 'foreshadows' && isPhaseCEntities(projectId)) {
    const ufp = path.join(knowledgeDir(projectId), '..', 'understanding', 'foreshadows.json');
    if (fs.existsSync(ufp)) {
      return readJson(ufp, defaults.foreshadows);
    }
  }
  const fp = knowledgePath(projectId, legacyFile);
  if (!fs.existsSync(fp)) {
    const data = defaults[key];
    writeJson(fp, data);
    return data;
  }
  if (process.env.NODE_ENV !== 'production' && (key === 'characters' || key === 'foreshadows')) {
    console.warn(`[deprecated] loadKnowledgeBundle: legacy knowledge/${legacyFile} (project=${projectId})`);
  }
  return readJson(fp, defaults[key]);
}

export function loadKnowledgeBundle(projectId) {
  ensureKnowledgeDir(projectId);
  const defaults = emptyKnowledge();
  const bundle = {};
  for (const [key, file] of Object.entries(KB_FILE_MAP)) {
    bundle[key] = loadKbSlice(projectId, key, file, defaults);
  }
  return bundle;
}

function saveEntitiesCharacters(projectId, data) {
  const fp = entitiesPath(projectId, 'characters.json');
  const existing = readJson(fp, { items: [], migration_version: 'phase-c-v1' });
  const byLegacy = new Map((existing.items || []).map((it) => [it.legacy_id || it.name, it]));
  for (const item of data.items || []) {
    const legacyKey = item.legacy_id || item.name || item.id;
    if (byLegacy.has(legacyKey)) {
      const prev = byLegacy.get(legacyKey);
      byLegacy.set(legacyKey, { ...prev, ...item, id: prev.id, legacy_id: prev.legacy_id || legacyKey });
      continue;
    }
    const id = /^char_[a-z0-9]{8}$/.test(item.id) ? item.id : generateEntityId('character');
    byLegacy.set(legacyKey, {
      entity_type: 'character',
      legacy_id: legacyKey,
      status: item.status || 'provisional',
      ...item,
      id,
    });
  }
  const payload = {
    ...existing,
    migration_version: existing.migration_version || 'phase-c-v1',
    version: 2,
    updated_at: now(),
    items: [...byLegacy.values()],
  };
  writeJson(fp, payload);
  invalidateEntityIndex(projectId);
  return payload;
}

export function saveKnowledgeFile(projectId, key, data) {
  const file = KB_FILE_MAP[key];
  if (!file) throw new Error(`未知知识库文件: ${key}`);

  if (key === 'characters' && isPhaseCEntities(projectId)) {
    return saveEntitiesCharacters(projectId, data);
  }

  assertLegacyKbRootWrite(key);

  const payload = { ...data, updated_at: now() };
  writeJson(knowledgePath(projectId, file), payload);
  if (key === 'characters') invalidateEntityIndex(projectId);
  return payload;
}

export function patchKnowledge(projectId, patch = {}) {
  const bundle = loadKnowledgeBundle(projectId);
  for (const [key, value] of Object.entries(patch)) {
    if (KB_FILE_MAP[key] && value) {
      bundle[key] = saveKnowledgeFile(projectId, key, value);
    }
  }
  return bundle;
}
