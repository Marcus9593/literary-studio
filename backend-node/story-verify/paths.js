import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');

export function verifyDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'verify');
}

export function verifyLogPath(projectId) {
  return path.join(verifyDir(projectId), 'verify_log.json');
}

export function healthSnapshotPath(projectId) {
  return path.join(verifyDir(projectId), 'health_snapshot.json');
}

export function baselinesDir(projectId) {
  return path.join(verifyDir(projectId), 'baselines');
}

export function baselinePath(projectId, key) {
  return path.join(baselinesDir(projectId), `${key}.json`);
}
