import path from 'path';
import { fileURLToPath } from 'url';
import * as storage from '../storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');

export const KB_FILES = [
  'characters.json',
  'relationships.json',
  'timeline.json',
  'locations.json',
  'foreshadows.json',
  'story_summary.json',
];

export function knowledgeDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'knowledge');
}

export function knowledgePath(projectId, filename) {
  return path.join(knowledgeDir(projectId), filename);
}

export function plansDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'plans');
}

export function planPath(projectId, planId) {
  return path.join(plansDir(projectId), `${planId}.json`);
}

export function summariesDir(projectId) {
  return path.join(storage.workspacePath(projectId), '.webnovel', 'summaries');
}
