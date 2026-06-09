#!/usr/bin/env node
/**
 * Phase C 前现实审计 — 输出 JSON 到 stdout
 * Usage: node backend-node/scripts/legacy-inventory-audit.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');

const STABLE_ID = /^(char|loc|org|rel|evt)_[a-z0-9]{8}$/;

function auditEntity(item, type, stats) {
  if (!item || typeof item !== 'object') return;
  stats.entities.total++;
  const src = item.source || 'unknown';
  stats.entities.bySource[src] = (stats.entities.bySource[src] || 0) + 1;
  if (item.id && item.name && item.id === item.name) stats.entities.legacyIdEqualsName++;
  else if (item.id && STABLE_ID.test(item.id)) stats.entities.stableId++;
  const name = (item.name || item.id || '').trim();
  if (name.length <= 4 || /^个|我知|那个人|巨大的/.test(name)) {
    stats.entities.noiseSamples.push({ type, id: item.id, name, source: src });
  }
}

const stats = {
  audited_at: new Date().toISOString(),
  data_dir: DATA,
  projects: 0,
  studio: { exists: false },
  knowledge: { files: {}, entities: { total: 0, legacyIdEqualsName: 0, stableId: 0, bySource: {}, noiseSamples: [] } },
  verify: { withLog: 0, logItems: 0, withHealthSnapshot: 0 },
};

const studioPath = path.join(DATA, 'studio.json');
if (fs.existsSync(studioPath)) {
  const studio = JSON.parse(fs.readFileSync(studioPath, 'utf8'));
  stats.studio = {
    exists: true,
    snapshot_projects: Object.keys(studio.snapshots || {}).filter((k) => (studio.snapshots[k] || []).length).length,
    snapshot_count: Object.values(studio.snapshots || {}).reduce((n, a) => n + (a?.length || 0), 0),
    asset_projects: Object.keys(studio.assets || {}).filter((k) => (studio.assets[k] || []).length).length,
    review_projects: Object.keys(studio.review_by_project || {}).length,
    studio_json_bytes: fs.statSync(studioPath).size,
  };
}

const projectsDir = path.join(DATA, 'projects');
if (fs.existsSync(projectsDir)) {
  for (const pid of fs.readdirSync(projectsDir)) {
    const pdir = path.join(projectsDir, pid);
    if (!fs.statSync(pdir).isDirectory()) continue;
    stats.projects++;
    const kdir = path.join(pdir, 'knowledge');
    if (fs.existsSync(kdir)) {
      for (const f of fs.readdirSync(kdir).filter((x) => x.endsWith('.json'))) {
        stats.knowledge.files[f] = (stats.knowledge.files[f] || 0) + 1;
        try {
          const data = JSON.parse(fs.readFileSync(path.join(kdir, f), 'utf8'));
          for (const it of data.items || data.events || []) {
            auditEntity(it, f.replace('.json', ''), stats.knowledge);
          }
        } catch {}
      }
    }
    if (fs.existsSync(path.join(pdir, 'verify', 'verify_log.json'))) {
      stats.verify.withLog++;
      const log = JSON.parse(fs.readFileSync(path.join(pdir, 'verify', 'verify_log.json'), 'utf8'));
      stats.verify.logItems += (log.items || []).length;
    }
    if (fs.existsSync(path.join(pdir, 'verify', 'health_snapshot.json'))) {
      stats.verify.withHealthSnapshot++;
    }
  }
}

console.log(JSON.stringify(stats, null, 2));
