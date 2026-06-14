import fs from 'fs';
import path from 'path';
import { plannerDir, plannerPath, ALLOWED_HORIZONS } from './paths.js';
import { stripDeprecatedGoalFields } from '../story-schemas/goal.js';

function now() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    let raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

const DEFAULT_PREFERENCES = {
  version: 1,
  schema: 'planner_preferences',
  default_horizon: 5,
  allowed_horizons: ALLOWED_HORIZONS,
  daily_capacity_minutes: 120,
  preferred_task_count: 3,
  updated_at: null,
};

export function loadPreferences(projectId) {
  const fp = plannerPath(projectId, 'preferences.json');
  if (!fs.existsSync(fp)) {
    const prefs = { ...DEFAULT_PREFERENCES, updated_at: now() };
    writeJson(fp, prefs);
    return prefs;
  }
  return { ...DEFAULT_PREFERENCES, ...readJson(fp, DEFAULT_PREFERENCES) };
}

export function savePreferences(projectId, patch) {
  const prefs = { ...loadPreferences(projectId), ...patch, updated_at: now() };
  writeJson(plannerPath(projectId, 'preferences.json'), prefs);
  return prefs;
}

export function loadManifest(projectId) {
  const fp = plannerPath(projectId, 'manifest.json');
  if (!fs.existsSync(fp)) return null;
  return readJson(fp, null);
}

export function saveManifest(projectId, data) {
  const payload = { ...data, updated_at: now() };
  writeJson(plannerPath(projectId, 'manifest.json'), payload);
  return payload;
}

export function loadStoryGoal(projectId) {
  const fp = plannerPath(projectId, 'story_goal.json');
  if (!fs.existsSync(fp)) return null;
  return readJson(fp, null);
}

export function saveStoryGoal(projectId, goal) {
  const payload = { ...goal, updated_at: now() };
  writeJson(plannerPath(projectId, 'story_goal.json'), payload);
  return payload;
}

export function loadActBeats(projectId) {
  const fp = plannerPath(projectId, 'act_beats.json');
  if (!fs.existsSync(fp)) return null;
  return readJson(fp, null);
}

export function saveActBeats(projectId, beats) {
  const payload = { ...beats, updated_at: now() };
  writeJson(plannerPath(projectId, 'act_beats.json'), payload);
  return payload;
}

export function loadChapterRoadmap(projectId) {
  const fp = plannerPath(projectId, 'chapter_roadmap.json');
  if (!fs.existsSync(fp)) return null;
  return readJson(fp, null);
}

export function saveChapterRoadmap(projectId, roadmap) {
  const payload = { ...roadmap, updated_at: now() };
  writeJson(plannerPath(projectId, 'chapter_roadmap.json'), payload);
  return payload;
}

export function loadPlannerBundle(projectId) {
  const goal = loadStoryGoal(projectId);
  return {
    preferences: loadPreferences(projectId),
    manifest: loadManifest(projectId),
    story_goal: goal ? stripDeprecatedGoalFields(goal) : null,
    act_beats: loadActBeats(projectId),
    chapter_roadmap: loadChapterRoadmap(projectId),
  };
}
