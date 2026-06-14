/**
 * Entity Resolution Layer — 全系统统一实体解析（非 Store / 非 DB）
 * @see docs/archive/v2.8/v2.8-entity-identity.md
 */
import { buildEntityIndex, buildEntityIndexFromRecords } from './entity-index.js';
import { invalidateStoryIndex } from '../story-index/build.js';

const STABLE_ID = /^(char|loc|org|rel|evt)_[a-z0-9]{8}$/;

const indexCache = new Map();

export function invalidateEntityIndex(projectId) {
  indexCache.delete(projectId);
  // 同步失效 story-index 缓存，确保两套索引一致
  invalidateStoryIndex(projectId);
}

export function getEntityIndex(projectId) {
  if (!indexCache.has(projectId)) {
    indexCache.set(projectId, buildEntityIndex(projectId));
  }
  return indexCache.get(projectId);
}

function normalizeKey(s) {
  return String(s || '').trim();
}

function followMerged(id, index) {
  let currentId = id;
  let redirected = false;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const ent = index.idMap.get(currentId);
    if (!ent) {
      return { canonicalId: currentId, entity: null, redirected };
    }
    if (ent.status === 'merged' && ent.merged_into) {
      redirected = true;
      currentId = ent.merged_into;
      continue;
    }
    return { canonicalId: ent.id, entity: ent, redirected };
  }
  return { canonicalId: currentId, entity: index.idMap.get(currentId) || null, redirected };
}

function toResolved({ entity, canonicalId, redirected = false, resolvedFrom }) {
  if (!entity && !canonicalId) return null;

  if (!entity) {
    return {
      entity: null,
      canonicalId: canonicalId || null,
      canonicalName: null,
      aliases: [],
      status: 'unknown',
      source: null,
      redirected,
      resolvedFrom,
    };
  }

  return {
    entity,
    canonicalId,
    canonicalName: entity.name || null,
    aliases: entity.aliases || [],
    status: entity.status || 'active',
    source: entity.source || null,
    redirected,
    resolvedFrom,
  };
}

function lookupRawId(index, id, resolvedFrom = 'id') {
  const key = normalizeKey(id);
  if (!key) return null;
  const { canonicalId, entity, redirected } = followMerged(key, index);
  if (!entity) return null;
  return toResolved({ entity, canonicalId, redirected, resolvedFrom });
}

/** 绑定 Index 的 Resolver（测试 / 批处理） */
export function createResolverForIndex(index) {
  return {
    resolveById(id) {
      return lookupRawId(index, id, 'id');
    },
    resolveByName(name) {
      const key = normalizeKey(name);
      if (!key) return null;
      const entityId = index.nameMap.get(key) || index.legacyMap.get(key);
      if (!entityId && STABLE_ID.test(key)) return lookupRawId(index, key, 'id');
      if (!entityId) return null;
      return lookupRawId(index, entityId, 'name');
    },
    resolveByAlias(alias) {
      const key = normalizeKey(alias);
      if (!key) return null;
      const entityId = index.aliasMap.get(key) || index.legacyMap.get(key) || index.nameMap.get(key);
      if (!entityId) return null;
      return lookupRawId(index, entityId, 'alias');
    },
    resolveByLegacyId(legacyId) {
      const key = normalizeKey(legacyId);
      if (!key) return null;
      const entityId = index.legacyMap.get(key);
      if (!entityId) return null;
      return lookupRawId(index, entityId, 'legacy');
    },
    resolveEntity(query) {
      if (query == null) return null;
      if (typeof query === 'string') {
        const q = normalizeKey(query);
        if (!q) return null;
        if (STABLE_ID.test(q)) return lookupRawId(index, q, 'id');
        return (
          lookupRawId(index, q, 'id')
          || this.resolveByLegacyId(q)
          || this.resolveByName(q)
          || this.resolveByAlias(q)
        );
      }
      const tryHit = (hit) => hit?.entity && hit.status !== 'deleted' && hit.status !== 'rejected' ? hit : null;
      if (query.id) { const h = tryHit(this.resolveById(query.id)); if (h) return h; }
      if (query.legacy) { const h = tryHit(this.resolveByLegacyId(query.legacy)); if (h) return h; }
      if (query.name) { const h = tryHit(this.resolveByName(query.name)); if (h) return h; }
      if (query.alias) { const h = tryHit(this.resolveByAlias(query.alias)); if (h) return h; }
      return null;
    },
    listCharacters(opts) {
      return listCharactersFromIndex(index, this, opts);
    },
  };
}

function listCharactersFromIndex(index, resolver, { includeProvisional = true } = {}) {
  const out = [];
  const seen = new Set();
  for (const ent of index.idMap.values()) {
    if ((ent.entity_type || 'character') !== 'character') continue;
    if (ent.status === 'merged') continue;
    const resolved = resolver.resolveById(ent.id);
    if (!resolved?.canonicalId || seen.has(resolved.canonicalId)) continue;
    if (!includeProvisional && resolved.status === 'provisional') continue;
    if (resolved.status === 'deleted' || resolved.status === 'rejected') continue;
    seen.add(resolved.canonicalId);
    out.push(resolved);
  }
  return out;
}

function resolverFor(projectId) {
  return createResolverForIndex(getEntityIndex(projectId));
}

export function resolveById(projectId, id) {
  return resolverFor(projectId).resolveById(id);
}

export function resolveMergedEntity(projectId, id) {
  return resolveById(projectId, id);
}

export function resolveByName(projectId, name) {
  return resolverFor(projectId).resolveByName(name);
}

export function resolveByAlias(projectId, alias) {
  return resolverFor(projectId).resolveByAlias(alias);
}

export function resolveByLegacyId(projectId, legacyId) {
  return resolverFor(projectId).resolveByLegacyId(legacyId);
}

export function resolveEntity(projectId, query) {
  return resolverFor(projectId).resolveEntity(query);
}

export function listCharacters(projectId, opts) {
  return resolverFor(projectId).listCharacters(opts);
}

/**
 * D3.6 — 批量解析（单 Index 构建，避免 N 次重复加载）
 * @param {string} projectId
 * @param {string[]} idsOrQueries
 */
export function resolveMany(projectId, idsOrQueries) {
  const resolver = createResolverForIndex(getEntityIndex(projectId));
  const found = [];
  const missing = [];
  for (const q of idsOrQueries || []) {
    const hit = resolver.resolveEntity(q);
    if (hit?.canonicalId && hit.status !== 'deleted' && hit.status !== 'rejected') {
      found.push(hit);
    } else {
      missing.push(q);
    }
  }
  return { found, missing };
}

export { buildEntityIndexFromRecords };
