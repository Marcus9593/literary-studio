import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getDb,
  kvGet,
  kvSet,
  saveSession,
  loadSession,
  saveSessionIndex,
  loadSessionIndex,
  saveSessionArchive,
  loadSessionArchive,
  saveProjectMeta,
  loadProjectMeta,
  listProjectMetas,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');

const KV_KEYS = {
  settings: 'settings',
  tools: 'tools',
  studio: 'studio',
  jobs: 'jobs',
  migrated: 'migration_v2_done',
};

function readJSONFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function importSessionsFromFilesystem(projectsDir) {
  if (!fs.existsSync(projectsDir)) return 0;
  let count = 0;
  for (const pid of fs.readdirSync(projectsDir)) {
    const sessionsDir = path.join(projectsDir, pid, 'workspace', '.webnovel', 'sessions');
    if (!fs.existsSync(sessionsDir)) continue;

    const indexPath = path.join(sessionsDir, 'index.json');
    if (fs.existsSync(indexPath)) {
      const index = readJSONFile(indexPath, null);
      if (index) saveSessionIndex(pid, index);
    }

    for (const file of fs.readdirSync(sessionsDir)) {
      if (!file.endsWith('.json') || file === 'index.json') continue;
      if (file.endsWith('.archive.json')) {
        const sid = file.replace('.archive.json', '');
        const archive = readJSONFile(path.join(sessionsDir, file), { messages: [] });
        saveSessionArchive(pid, sid, archive);
        continue;
      }
      const session = readJSONFile(path.join(sessionsDir, file), null);
      if (session?.id) {
        saveSession(pid, session.id, session);
        count += 1;
      }
    }
  }
  return count;
}

export function initSqliteStorage() {
  getDb();

  if (kvGet(KV_KEYS.migrated)) return { migrated: false, already: true };

  const projectsDir = path.join(DATA_DIR, 'projects');

  // KV stores from JSON files
  const settingsPath = path.join(DATA_DIR, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    kvSet(KV_KEYS.settings, readJSONFile(settingsPath, { active_id: '', models: [] }));
  }

  const toolsPath = path.join(DATA_DIR, 'tools.json');
  if (fs.existsSync(toolsPath)) {
    kvSet(KV_KEYS.tools, readJSONFile(toolsPath, {}));
  }

  const studioPath = path.join(DATA_DIR, 'studio.json');
  if (fs.existsSync(studioPath)) {
    kvSet(KV_KEYS.studio, readJSONFile(studioPath, {}));
  }

  const jobsPath = path.join(DATA_DIR, 'jobs.json');
  if (fs.existsSync(jobsPath)) {
    kvSet(KV_KEYS.jobs, readJSONFile(jobsPath, {}));
  }

  // Project metas
  if (fs.existsSync(projectsDir)) {
    for (const pid of fs.readdirSync(projectsDir)) {
      const metaPath = path.join(projectsDir, pid, 'meta.json');
      if (fs.existsSync(metaPath)) {
        const meta = readJSONFile(metaPath, null);
        if (meta?.id) saveProjectMeta(meta);
      }
    }
  }

  const sessionCount = importSessionsFromFilesystem(projectsDir);
  kvSet(KV_KEYS.migrated, { at: new Date().toISOString(), sessions: sessionCount });
  return { migrated: true, sessions: sessionCount };
}

export function sqliteEnabled() {
  return process.env.DISABLE_SQLITE !== '1';
}

export {
  kvGet,
  kvSet,
  saveSession,
  loadSession,
  saveSessionIndex,
  loadSessionIndex,
  saveSessionArchive,
  loadSessionArchive,
  saveProjectMeta,
  loadProjectMeta,
  listProjectMetas,
  KV_KEYS,
};
