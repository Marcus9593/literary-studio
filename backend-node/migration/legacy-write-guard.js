/**
 * Phase C 后冻结 studio.json 旧路径写入（snapshots / assets / review_by_project）
 * 由 migration-enable-legacy-guard.mjs 启用；Cleanup 前必须执行
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
const GUARD_PATH = path.join(DATA_DIR, 'migration', 'legacy-write-guard.json');

export const LEGACY_STUDIO_WRITE_ERROR =
  'Legacy studio.json writer disabled after Phase C. Use versions/ or measurement/. See docs/archive/v2.8/v2.8-phase-c-rollback.md';

export function isLegacyWriteGuardEnabled() {
  if (process.env.LEGACY_WRITE_GUARD === '1') return true;
  const raw = (() => {
    try {
      return JSON.parse(fs.readFileSync(GUARD_PATH, 'utf8'));
    } catch {
      return null;
    }
  })();
  return Boolean(raw?.enabled);
}

export function enableLegacyWriteGuard() {
  fs.mkdirSync(path.dirname(GUARD_PATH), { recursive: true });
  const payload = { enabled: true, since: new Date().toISOString() };
  fs.writeFileSync(GUARD_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

export function assertLegacyStudioWriteAllowed() {
  if (isLegacyWriteGuardEnabled()) {
    throw new Error(LEGACY_STUDIO_WRITE_ERROR);
  }
}

export const LEGACY_KB_ROOT_WRITE_ERROR =
  'Legacy knowledge/{file}.json writer disabled after Phase C. Use knowledge/entities/ or understanding/.';

export function assertLegacyKbRootWrite(key) {
  const blocked = new Set(['characters', 'foreshadows']);
  if (isLegacyWriteGuardEnabled() && blocked.has(key)) {
    throw new Error(`${LEGACY_KB_ROOT_WRITE_ERROR} (key=${key})`);
  }
}

export const HEALTH_SNAPSHOT_WRITE_ERROR =
  'health_snapshot writer removed (V2.8). Use verify_log + measurement metrics rollup.';

export function assertHealthSnapshotWriteAllowed() {
  if (isLegacyWriteGuardEnabled()) {
    throw new Error(HEALTH_SNAPSHOT_WRITE_ERROR);
  }
}
