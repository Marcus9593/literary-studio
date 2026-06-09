import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureSuperAdmin, migrateLegacyAdminRoles } from './user-store.js';
import { SUPER_ADMIN_ID } from './constants.js';
import { runStartupDataRepairs } from '../data-repair.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = process.env.LITERARY_STUDIO_DATA
  || path.resolve(__dirname, '../../data');
const PROJECTS_DIR = path.join(DATA_ROOT, 'projects');

/** 启动时初始化用户表，并将无归属项目划归超级管理员 */
export function bootstrapAuth() {
  ensureSuperAdmin();
  migrateLegacyAdminRoles();
  migrateLegacyProjects();
  runStartupDataRepairs();
}

function migrateLegacyProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return;
  let migrated = 0;
  for (const name of fs.readdirSync(PROJECTS_DIR)) {
    const metaPath = path.join(PROJECTS_DIR, name, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      let changed = false;
      if (!meta.owner_id) {
        meta.owner_id = SUPER_ADMIN_ID;
        changed = true;
      }
      if (!Array.isArray(meta.shares)) {
        meta.shares = [];
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
        migrated += 1;
      }
    } catch {
      /* skip invalid */
    }
  }
  if (migrated > 0) {
    console.log(`  [auth] 已将 ${migrated} 个历史项目归属至超级管理员`);
  }
}
