#!/usr/bin/env node
/**
 * D3 验收 — entity-resolver
 * Run: node backend-node/story-kb/entity-resolver.spec.mjs
 */
import assert from 'node:assert/strict';
import { buildEntityIndexFromRecords } from './entity-index.js';
import { createResolverForIndex, resolveByLegacyId } from './entity-resolver.js';

const records = [
  {
    id: 'char_active01',
    entity_type: 'character',
    name: '欧阳逸清',
    legacy_id: '欧阳逸清',
    aliases: ['逸清'],
    status: 'active',
    source: 'inferred',
  },
  {
    id: 'char_provis01',
    entity_type: 'character',
    name: '小白',
    status: 'provisional',
    source: 'inferred',
  },
  {
    id: 'char_oldmerge',
    entity_type: 'character',
    name: '顾长歌旧',
    status: 'merged',
    merged_into: 'char_active01',
  },
  {
    id: 'char_deleted1',
    entity_type: 'character',
    name: '已删角色',
    status: 'deleted',
    source: 'user',
  },
];

const index = buildEntityIndexFromRecords(records);
const r = createResolverForIndex(index);

const active = r.resolveById('char_active01');
assert.equal(active.canonicalId, 'char_active01');
assert.equal(active.status, 'active');
console.log('  ✓ active');

const provisional = r.resolveById('char_provis01');
assert.equal(provisional.status, 'provisional');
console.log('  ✓ provisional');

const merged = r.resolveById('char_oldmerge');
assert.equal(merged.canonicalId, 'char_active01');
assert.equal(merged.redirected, true);
console.log('  ✓ merged → canonical');

const deleted = r.resolveById('char_deleted1');
assert.equal(deleted.status, 'deleted');
console.log('  ✓ deleted');

const legacy = r.resolveByLegacyId('欧阳逸清');
assert.equal(legacy.canonicalId, 'char_active01');
console.log('  ✓ legacy_id');

const alias = r.resolveByAlias('逸清');
assert.equal(alias.canonicalId, 'char_active01');
console.log('  ✓ alias');

const viaEntity = r.resolveEntity('欧阳逸清');
assert.equal(viaEntity.canonicalId, 'char_active01');
console.log('  ✓ resolveEntity(string)');

const hit = resolveByLegacyId('583e5628-24b', '欧阳逸清');
if (hit) {
  assert.match(hit.canonicalId, /^char_[a-z0-9]{8}$/);
  console.log('  ✓ integration 欧阳逸清 →', hit.canonicalId);
} else {
  console.log('  · integration skipped (no project data)');
}

console.log('\nentity-resolver.spec.mjs: all passed');
