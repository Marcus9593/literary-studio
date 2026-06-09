/**
 * @deprecated 请直接使用 creative-center/ 子模块。
 * 保留本文件以兼容 measurement/review-facade 等现有 import。
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  workspacePath,
  touchProject,
} from './storage.js';
import { getDashboardStats } from './creative-center/cockpit-service.js';
import {
  listStudioAssets,
  createStudioAsset,
  deleteStudioAsset,
  updateStudioAsset,
} from './creative-center/legacy-assets-service.js';
import { computeStudioReview } from './creative-center/review-compute.js';
import {
  loadStudioState,
  saveStudioState,
  pendingReviewChecks,
} from './creative-center/studio-state.js';

export { getDashboardStats, getDashboardStats as getStudioOverview };
export {
  listStudioAssets,
  createStudioAsset,
  deleteStudioAsset,
  updateStudioAsset,
  computeStudioReview,
};

function snapshotPublic(snap) {
  const files = snap.files || [];
  const { files: _omit, ...rest } = snap;
  return {
    ...rest,
    file_count: snap.file_count ?? files.length,
    total_words: snap.total_words ?? files.reduce((sum, f) => sum + (f.words || 0), 0),
  };
}

function now() {
  return new Date().toISOString();
}

/** @deprecated 快照已迁至 versions/ */
export function listStudioSnapshots() {
  const state = loadStudioState();
  const all = Object.values(state.snapshots || {}).flatMap((items) => items || []);
  return all.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

/** @deprecated */
export function listStudioSnapshotsByProject(projectId) {
  const state = loadStudioState();
  const snaps = (state.snapshots[projectId] || []).map(snapshotPublic);
  return [...snaps].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

/** @deprecated */
export function createStudioSnapshot(payload = {}) {
  const projectId = String(payload.project_id || '').trim();
  if (!projectId) throw new Error('project_id 不能为空');
  const ws = workspacePath(projectId);
  if (!fs.existsSync(ws)) throw new Error(`项目不存在: ${projectId}`);
  const state = loadStudioState();
  const projectSnaps = state.snapshots[projectId] || [];
  const title = String(payload.title || '').trim() || `手动快照 ${projectSnaps.length + 1}`;
  const files = captureSnapshotFiles(projectId);
  const snap = {
    id: randomUUID().slice(0, 12),
    project_id: projectId,
    title,
    notes: String(payload.notes || '提交前保留版本，便于回滚'),
    created_at: now(),
    file_count: files.length,
    total_words: files.reduce((s, f) => s + f.words, 0),
    files,
  };
  state.snapshots[projectId] = [snap, ...projectSnaps];
  saveStudioState(state);
  touchProject(projectId);
  return snapshotPublic(snap);
}

/** @deprecated */
export function deleteStudioSnapshot(snapshotId, projectId) {
  const state = loadStudioState();
  if (!projectId) throw new Error('project_id 不能为空');
  state.snapshots[projectId] = (state.snapshots[projectId] || []).filter((s) => s.id !== snapshotId);
  saveStudioState(state);
  return { status: 'deleted' };
}

/** @deprecated */
export function getStudioSnapshotDiff(projectId, snapshotId) {
  const snapshot = getSnapshot(projectId, snapshotId);
  const currentFiles = captureSnapshotFiles(projectId);
  const oldMap = new Map(snapshot.files.map((f) => [f.path, f]));
  const curMap = new Map(currentFiles.map((f) => [f.path, f]));

  const changed = [];
  const added = [];
  const deleted = [];

  for (const [p, cur] of curMap.entries()) {
    const old = oldMap.get(p);
    if (!old) {
      added.push({ path: p, words: cur.words });
      continue;
    }
    if (old.content !== cur.content) {
      changed.push({ path: p, from_words: old.words, to_words: cur.words });
    }
  }
  for (const [p, old] of oldMap.entries()) {
    if (!curMap.has(p)) deleted.push({ path: p, words: old.words });
  }
  return {
    snapshot_id: snapshotId,
    project_id: projectId,
    counts: { changed: changed.length, added: added.length, deleted: deleted.length },
    changed,
    added,
    deleted,
  };
}

/** @deprecated */
export function restoreStudioSnapshot(projectId, snapshotId) {
  const snapshot = getSnapshot(projectId, snapshotId);
  const ws = workspacePath(projectId);
  const managedDirs = ['正文', '试验稿', '大纲', '设定集', 'archive'];
  const currentPaths = listManagedMarkdownPaths(ws, managedDirs);
  const snapshotPathSet = new Set(snapshot.files.map((f) => f.path));

  for (const rel of currentPaths) {
    if (!snapshotPathSet.has(rel)) {
      const abs = path.join(ws, rel);
      try { fs.unlinkSync(abs); } catch {}
    }
  }
  for (const file of snapshot.files) {
    const abs = path.join(ws, file.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, String(file.content || ''), 'utf-8');
  }
  touchProject(projectId);
  return {
    status: 'restored',
    snapshot_id: snapshotId,
    restored_files: snapshot.files.length,
    deleted_files: currentPaths.filter((p) => !snapshotPathSet.has(p)).length,
  };
}

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

/** @deprecated 请用 measurement/review-facade */
export function runStudioReview(projectId = '') {
  const result = computeStudioReview(projectId);
  const state = loadStudioState();
  state.review_by_project[projectId] = result;
  saveStudioState(state);
  return {
    project_id: projectId,
    checks: result.checks,
    hints: result.hints,
    manuscript_words: result.manuscript_words,
    updated_at: result.updated_at,
  };
}

function captureSnapshotFiles(projectId) {
  const ws = workspacePath(projectId);
  const dirs = ['正文', '试验稿', '大纲', '设定集', 'archive'];
  const relPaths = listManagedMarkdownPaths(ws, dirs);
  return relPaths.map((rel) => {
    const content = fs.readFileSync(path.join(ws, rel), 'utf-8');
    return {
      path: rel,
      content,
      words: content.replace(/[\s\n]/g, '').length,
    };
  });
}

function listManagedMarkdownPaths(ws, dirs) {
  const paths = [];
  for (const dir of dirs) {
    const absDir = path.join(ws, dir);
    if (!fs.existsSync(absDir)) continue;
    collectMarkdownFiles(absDir, ws, paths);
  }
  return paths.sort();
}

function collectMarkdownFiles(currentDir, ws, out) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(abs, ws, out);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(path.relative(ws, abs));
    }
  }
}

function getSnapshot(projectId, snapshotId) {
  const state = loadStudioState();
  const snapshots = state.snapshots[projectId] || [];
  const snapshot = snapshots.find((s) => s.id === snapshotId);
  if (!snapshot) throw new Error(`快照不存在: ${snapshotId}`);
  return snapshot;
}
