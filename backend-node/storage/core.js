import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as sqlAdapter from './sqlite/adapter.js';
import { initSqliteStorage } from './sqlite/migrate.js';

initSqliteStorage();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
export const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
export const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
export const JOBS_PATH = path.join(DATA_DIR, 'jobs.json');

for (const dir of [DATA_DIR, PROJECTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

export function now() {
  return new Date().toISOString();
}

export function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

export function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export { sqlAdapter };
