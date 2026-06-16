import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertLegacyStudioWriteAllowed } from '../migration/legacy-write-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
const STUDIO_PATH = path.join(DATA_DIR, 'studio.json');

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function defaultStudioState() {
  return {
    snapshots: {},
    assets: {},
    review_by_project: {},
  };
}

export function loadStudioState() {
  const raw = readJSON(STUDIO_PATH, defaultStudioState());
  if (!raw.snapshots || typeof raw.snapshots !== 'object' || Array.isArray(raw.snapshots)) {
    raw.snapshots = {};
  }
  if (Array.isArray(raw.assets)) {
    raw.assets = { __global__: raw.assets };
  }
  if (!raw.assets || typeof raw.assets !== 'object' || Array.isArray(raw.assets)) raw.assets = {};
  if (!raw.review_by_project || typeof raw.review_by_project !== 'object') {
    raw.review_by_project = {};
  }
  return raw;
}

/**
 * @deprecated V2.8 — studio.json 写入已被 legacy-write-guard 保护
 * 仅保留用于向后兼容，新代码不应写入 studio.json
 */
export function saveStudioState(state) {
  assertLegacyStudioWriteAllowed();
  writeJSON(STUDIO_PATH, state);
  return state;
}

export function pendingReviewChecks() {
  const REVIEW_KEYS = ['节奏密度', '人设一致性', '伏笔回收率', '风格稳定性'];
  return REVIEW_KEYS.map((key) => ({
    key,
    status: 'pending',
    score: null,
    updated_at: null,
  }));
}

/** 从 studio.json 读取已缓存的审稿结果 */
export function getStudioReview(projectId = '') {
  const state = loadStudioState();
  if (!projectId) {
    return { checks: pendingReviewChecks(), hints: [], project_id: '' };
  }
  const cached = state.review_by_project[projectId];
  if (!cached) {
    return { checks: pendingReviewChecks(), hints: [], project_id: projectId };
  }
  return {
    project_id: projectId,
    checks: cached.checks || pendingReviewChecks(),
    hints: cached.hints || [],
    manuscript_words: cached.manuscript_words || 0,
    updated_at: cached.updated_at || null,
  };
}
