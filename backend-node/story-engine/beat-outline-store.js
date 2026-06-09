import fs from 'fs';
import path from 'path';
import { knowledgeDir } from '../story-kb/paths.js';

const BEATS_FILE = 'beat_outlines.json';

function beatsPath(projectId) {
  return path.join(knowledgeDir(projectId), BEATS_FILE);
}

function now() {
  return new Date().toISOString();
}

function loadAll(projectId) {
  const fp = beatsPath(projectId);
  if (!fs.existsSync(fp)) return { version: 1, units: {} };
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return { version: 1, units: {} };
  }
}

function saveAll(projectId, data) {
  fs.mkdirSync(knowledgeDir(projectId), { recursive: true });
  fs.writeFileSync(beatsPath(projectId), JSON.stringify(data, null, 2), 'utf8');
}

export function listBeatOutlines(projectId) {
  const all = loadAll(projectId);
  return Object.entries(all.units || {}).map(([unit, outline]) => ({
    unit_index: Number(unit),
    ...outline,
  }));
}

export function loadBeatOutline(projectId, unitIndex = 1) {
  const all = loadAll(projectId);
  return all.units?.[String(unitIndex)] || {
    title: '',
    unit_index: unitIndex,
    description: '',
    beats: [],
    characters: [],
    updated_at: null,
  };
}

export function saveBeatOutline(projectId, unitIndex, outline) {
  const all = loadAll(projectId);
  const key = String(unitIndex);
  all.units = all.units || {};
  all.units[key] = {
    title: outline.title || '',
    unit_index: unitIndex,
    description: outline.description || '',
    beats: outline.beats || [],
    characters: outline.characters || [],
    updated_at: now(),
  };
  all.updated_at = now();
  saveAll(projectId, all);
  return all.units[key];
}
