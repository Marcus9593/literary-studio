import fs from 'fs';
import path from 'path';
import {
  understandingDir,
  understandingPath,
  UNDERSTANDING_FILES,
} from './paths.js';
import {
  emptyArcs,
  emptyConflicts,
  emptyStoryDna,
  emptyValueShifts,
  emptyEmotionCurve,
  emptyGaps,
  UNDERSTANDING_FILE_MAP,
} from './defaults.js';

const DEFAULTS = {
  arcs: emptyArcs,
  conflicts: emptyConflicts,
  story_dna: emptyStoryDna,
  value_shifts: emptyValueShifts,
  emotion_curve: emptyEmotionCurve,
  gaps: emptyGaps,
};

function now() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function ensureUnderstandingDir(projectId) {
  fs.mkdirSync(understandingDir(projectId), { recursive: true });
  return understandingDir(projectId);
}

export function loadUnderstandingBundle(projectId) {
  ensureUnderstandingDir(projectId);
  const bundle = {};
  for (const [key, file] of Object.entries(UNDERSTANDING_FILE_MAP)) {
    const fp = understandingPath(projectId, file);
    const fallback = DEFAULTS[key]();
    if (!fs.existsSync(fp)) {
      writeJson(fp, fallback);
      bundle[key] = fallback;
    } else {
      bundle[key] = readJson(fp, fallback);
    }
  }
  return bundle;
}

export function saveUnderstandingFile(projectId, key, data, source = 'analyzer') {
  const file = UNDERSTANDING_FILE_MAP[key];
  if (!file) throw new Error(`未知理解层文件: ${key}`);
  const payload = { ...data, updated_at: now(), source: source || data.source };
  writeJson(understandingPath(projectId, file), payload);
  return payload;
}

export { UNDERSTANDING_FILES };
