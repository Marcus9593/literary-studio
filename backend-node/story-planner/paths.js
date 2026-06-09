import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');

export const ALLOWED_HORIZONS = [5, 10, 20, 50];

export function plannerDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'planner');
}

export function plannerPath(projectId, filename) {
  return path.join(plannerDir(projectId), filename);
}

export function tasksDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'tasks');
}

export function tasksPath(projectId) {
  return path.join(tasksDir(projectId), 'tasks.json');
}
