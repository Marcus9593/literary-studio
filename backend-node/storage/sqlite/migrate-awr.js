import { SCHEMA_AWR, SCHEMA_AWR_V2 } from './schema-awr.js';

export const MIGRATION_KEY = 'migration_awr_engine_v1';
export const MIGRATION_KEY_V2 = 'migration_awr_engine_v2';

/** @param {import('node:sqlite').DatabaseSync} database */
export function migrateAwrEngine(database) {
  const row = database.prepare('SELECT value_json FROM kv WHERE key = ?').get(MIGRATION_KEY);
  if (!row) {
    database.exec(SCHEMA_AWR);
    const ts = new Date().toISOString();
    database.prepare(`
      INSERT INTO kv (key, value_json, updated_at) VALUES (?, ?, ?)
    `).run(MIGRATION_KEY, JSON.stringify({ at: ts, version: 1 }), ts);
  }

  const rowV2 = database.prepare('SELECT value_json FROM kv WHERE key = ?').get(MIGRATION_KEY_V2);
  if (!rowV2) {
    database.exec(SCHEMA_AWR_V2);
    const ts = new Date().toISOString();
    database.prepare(`
      INSERT INTO kv (key, value_json, updated_at) VALUES (?, ?, ?)
    `).run(MIGRATION_KEY_V2, JSON.stringify({ at: ts, version: 2 }), ts);
    return { migrated: true, version: 2 };
  }

  return { migrated: false, already: true };
}
