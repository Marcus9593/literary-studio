/**
 * Entity Identity（公约 6）— 生成与解析；Phase C 前仅新代码路径使用
 * @see docs/v2.8-entity-identity.md
 */
import { randomBytes } from 'crypto';

/** Crockford-style base32-ish: a-z + 0-9 (8 chars) — 非 hex */
const BASE32_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

const PREFIX = {
  character: 'char',
  location: 'loc',
  organization: 'org',
  relationship: 'rel',
  event: 'evt',
};

/**
 * @param {'character'|'location'|'organization'|'relationship'|'event'} entityType
 */
export function generateEntityId(entityType) {
  const prefix = PREFIX[entityType];
  if (!prefix) throw new Error(`未知实体类型: ${entityType}`);
  let suffix = '';
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    suffix += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return `${prefix}_${suffix}`;
}

/** LEGACY: id === name */
export function isLegacyNameAsId(entity) {
  if (!entity?.id || !entity?.name) return false;
  return entity.id === entity.name && !/^(char|loc|org|rel|evt)_[a-z0-9]{8}$/.test(entity.id);
}

/**
 * 解析引用：merged/deleted 实体指向 canonical id
 * @param {object} entity
 * @param {Map<string, object>} [byId]
 */
export function resolveEntityId(entity, byId = new Map()) {
  if (!entity?.id) return null;
  if (entity.status === 'merged' && entity.merged_into) {
    const target = byId.get(entity.merged_into);
    return target ? resolveEntityId(target, byId) : entity.merged_into;
  }
  if (entity.status === 'deleted' || entity.status === 'rejected') return null;
  return entity.id;
}
