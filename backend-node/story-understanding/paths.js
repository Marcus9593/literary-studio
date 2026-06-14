import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');

export const UNDERSTANDING_FILES = {
  arcs: 'character_arcs.json',
  conflicts: 'conflicts.json',
  story_dna: 'story_dna.json',
  value_shifts: 'value_shifts.json',
  emotion_curve: 'emotion_curve.json',
  gaps: 'gaps.json',
};

export function understandingDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'understanding');
}

export function understandingPath(projectId, filename) {
  return path.join(understandingDir(projectId), filename);
}

export function actionsDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'actions');
}

export function actionsPath(projectId) {
  return path.join(actionsDir(projectId), 'actions.json');
}

export function reportsDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'reports');
}
