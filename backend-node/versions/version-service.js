/**
 * Version Domain — 读写 projects/{id}/versions/（非 studio.json）
 * @see docs/archive/v2.8/v2.8-migration-design.md §2
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { workspacePath, touchProject, getProject } from '../storage.js';
import {
  versionsDir,
  versionsManifestPath,
  versionMetadataPath,
  versionFilesDir,
  versionDir,
} from './paths.js';
import { captureWorkspaceFiles, listManagedMarkdownPaths } from './workspace-capture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = process.env.LITERARY_STUDIO_DATA || path.join(__dirname, '../../data');
const LEGACY_WARN = '[deprecated] studio.snapshots read fallback — use /api/projects/:id/versions';

function now() {
  return new Date().toISOString();
}

function readJson(fp, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(fp, data) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

export function hasVersionsDomain(projectId) {
  return fs.existsSync(versionsManifestPath(projectId));
}

function emptyManifest() {
  return { version: 1, updated_at: null, head: null, items: [] };
}

export function loadManifest(projectId) {
  if (!hasVersionsDomain(projectId)) return emptyManifest();
  return readJson(versionsManifestPath(projectId), emptyManifest());
}

function saveManifest(projectId, manifest) {
  manifest.updated_at = now();
  writeJson(versionsManifestPath(projectId), manifest);
  return manifest;
}

/** 解析 API / 旧 UI 传入的 id → versions 目录 id */
export function resolveVersionId(projectId, rawId) {
  const id = String(rawId || '').trim();
  if (!id) return null;
  const manifest = loadManifest(projectId);
  const hit = manifest.items.find(
    (it) => it.id === id || it.legacy_snapshot_id === id || it.id === `v_${id}`,
  );
  if (hit) return hit.id;
  if (fs.existsSync(versionMetadataPath(projectId, id))) return id;
  const candidate = `v_${id}`;
  if (fs.existsSync(versionMetadataPath(projectId, candidate))) return candidate;
  return null;
}

function loadVersionFilesFromDisk(projectId, versionId) {
  const dir = versionFilesDir(projectId, versionId);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (absDir, relPrefix = '') => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith('.md')) continue;
      const content = fs.readFileSync(abs, 'utf8');
      out.push({
        path: rel,
        content,
        words: content.replace(/[\s\n]/g, '').length,
      });
    }
  };
  walk(dir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function versionPublic(meta, projectId, { includeFiles = false } = {}) {
  const pid = meta.project_id || projectId;
  const files = includeFiles ? loadVersionFilesFromDisk(pid, meta.id) : [];
  const file_count = meta.file_count ?? files.length;
  const total_words = files.length
    ? files.reduce((s, f) => s + (f.words || 0), 0)
    : (meta.total_words ?? 0);
  const base = {
    id: meta.id,
    legacy_snapshot_id: meta.legacy_snapshot_id || null,
    project_id: pid,
    title: meta.title || '',
    notes: meta.notes || '',
    created_at: meta.created_at,
    file_count,
    total_words,
  };
  if (includeFiles) return { ...base, files };
  return base;
}

function listVersionsLegacyFallback(projectId) {
  console.warn(LEGACY_WARN, projectId);
  const studio = readJson(path.join(DATA_ROOT, 'studio.json'));
  const snaps = studio?.snapshots?.[projectId] || [];
  return snaps.map((s) => {
    const files = s.files || [];
    return {
      id: s.id.startsWith('v_') ? s.id : `v_${s.id}`,
      legacy_snapshot_id: s.id,
      project_id: projectId,
      title: s.title,
      notes: s.notes,
      created_at: s.created_at,
      file_count: files.length,
      total_words: files.reduce((sum, f) => sum + (f.words || 0), 0),
      _legacy_source: 'studio.snapshots',
    };
  }).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function getVersionLegacyFallback(projectId, versionId, { includeFiles }) {
  console.warn(LEGACY_WARN, 'get', projectId, versionId);
  const studio = readJson(path.join(DATA_ROOT, 'studio.json'));
  const bare = versionId.replace(/^v_/, '');
  const snap = (studio?.snapshots?.[projectId] || []).find(
    (s) => s.id === versionId || s.id === bare || `v_${s.id}` === versionId,
  );
  if (!snap) throw new Error(`版本不存在: ${versionId}`);
  const vid = snap.id.startsWith('v_') ? snap.id : `v_${snap.id}`;
  const base = {
    id: vid,
    legacy_snapshot_id: snap.id,
    project_id: projectId,
    title: snap.title,
    notes: snap.notes,
    created_at: snap.created_at,
    file_count: (snap.files || []).length,
    total_words: (snap.files || []).reduce((s, f) => s + (f.words || 0), 0),
    _legacy_source: 'studio.snapshots',
  };
  if (includeFiles) return { ...base, files: snap.files || [] };
  return base;
}

export function listVersions(projectId) {
  if (!hasVersionsDomain(projectId)) {
    return listVersionsLegacyFallback(projectId);
  }
  const manifest = loadManifest(projectId);
  return manifest.items
    .map((item) => {
      const meta = readJson(versionMetadataPath(projectId, item.id));
      return versionPublic(meta || { ...item, project_id: projectId }, projectId);
    })
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export function getVersion(projectId, versionId, { includeFiles = false } = {}) {
  const resolved = resolveVersionId(projectId, versionId);
  if (!resolved && !hasVersionsDomain(projectId)) {
    return getVersionLegacyFallback(projectId, versionId, { includeFiles });
  }
  if (!resolved) throw new Error(`版本不存在: ${versionId}`);

  if (!hasVersionsDomain(projectId)) {
    return getVersionLegacyFallback(projectId, versionId, { includeFiles });
  }

  const meta = readJson(versionMetadataPath(projectId, resolved));
  if (!meta) throw new Error(`版本不存在: ${versionId}`);
  return versionPublic({ ...meta, project_id: projectId }, projectId, { includeFiles });
}

export function createVersion(projectId, payload = {}) {
  getProject(projectId);
  workspacePath(projectId);
  fs.mkdirSync(versionsDir(projectId), { recursive: true });

  const manifest = hasVersionsDomain(projectId) ? loadManifest(projectId) : emptyManifest();
  const versionId = `v_${randomUUID().slice(0, 12)}`;
  const files = captureWorkspaceFiles(projectId);
  const title = String(payload.title || '').trim() || `版本 ${manifest.items.length + 1}`;
  const notes = String(payload.notes || '提交前保留版本，便于回滚');
  const type = String(payload.type || '').trim() || (notes.includes('自动') ? 'auto_write' : 'manual');
  const meta = {
    id: versionId,
    project_id: projectId,
    title,
    notes,
    type,
    created_at: now(),
    parent: payload.parent || null,
    file_count: files.length,
    legacy_snapshot_id: null,
  };

  const filesRoot = versionFilesDir(projectId, versionId);
  for (const f of files) {
    const dest = path.join(filesRoot, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, String(f.content ?? ''), 'utf8');
  }

  writeJson(versionMetadataPath(projectId, versionId), meta);
  manifest.items.unshift({
    id: versionId,
    title: meta.title,
    created_at: meta.created_at,
  });
  manifest.head = versionId;
  saveManifest(projectId, manifest);
  touchProject(projectId);

  return versionPublic(meta, projectId);
}

export function deleteVersion(projectId, versionId) {
  const resolved = resolveVersionId(projectId, versionId);
  if (!resolved) throw new Error(`版本不存在: ${versionId}`);

  const manifest = loadManifest(projectId);
  const vdir = versionDir(projectId, resolved);
  if (fs.existsSync(vdir)) fs.rmSync(vdir, { recursive: true, force: true });
  manifest.items = manifest.items.filter((it) => it.id !== resolved);
  if (manifest.head === resolved) manifest.head = manifest.items[0]?.id || null;
  saveManifest(projectId, manifest);
  return { status: 'deleted', version_id: resolved };
}

export function getVersionDiff(projectId, versionId) {
  const resolved = resolveVersionId(projectId, versionId);
  if (!resolved) throw new Error(`版本不存在: ${versionId}`);

  const snapshot = getVersion(projectId, resolved, { includeFiles: true });
  const currentFiles = captureWorkspaceFiles(projectId);
  const oldMap = new Map((snapshot.files || []).map((f) => [f.path, f]));
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
    version_id: resolved,
    snapshot_id: resolved,
    project_id: projectId,
    counts: { changed: changed.length, added: added.length, deleted: deleted.length },
    changed,
    added,
    deleted,
  };
}

export function restoreVersion(projectId, versionId) {
  const resolved = resolveVersionId(projectId, versionId);
  if (!resolved) throw new Error(`版本不存在: ${versionId}`);

  const snapshot = getVersion(projectId, resolved, { includeFiles: true });
  const ws = workspacePath(projectId);
  const currentPaths = listManagedMarkdownPaths(projectId);
  const snapshotPathSet = new Set((snapshot.files || []).map((f) => f.path));

  for (const rel of currentPaths) {
    if (!snapshotPathSet.has(rel)) {
      try { fs.unlinkSync(path.join(ws, rel)); } catch {}
    }
  }
  for (const file of snapshot.files || []) {
    const abs = path.join(ws, file.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, String(file.content || ''), 'utf8');
  }
  touchProject(projectId);
  return {
    status: 'restored',
    version_id: resolved,
    snapshot_id: resolved,
    restored_files: snapshot.files?.length || 0,
    deleted_files: currentPaths.filter((p) => !snapshotPathSet.has(p)).length,
  };
}
