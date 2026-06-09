import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');

export function versionsDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'versions');
}

export function versionsManifestPath(projectId) {
  return path.join(versionsDir(projectId), 'manifest.json');
}

export function versionDir(projectId, versionId) {
  return path.join(versionsDir(projectId), versionId);
}

export function versionMetadataPath(projectId, versionId) {
  return path.join(versionDir(projectId, versionId), 'metadata.json');
}

export function versionFilesDir(projectId, versionId) {
  return path.join(versionDir(projectId, versionId), 'files');
}
