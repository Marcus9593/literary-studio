import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { verifyDir, verifyLogPath, healthSnapshotPath } from './paths.js';
import { HEALTH_SNAPSHOT_WRITE_ERROR } from '../migration/legacy-write-guard.js';

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

function emptyLog() {
  return { version: 1, schema: 'verify_log', items: [] };
}

export function loadVerifyLog(projectId) {
  const fp = verifyLogPath(projectId);
  if (!fs.existsSync(fp)) {
    const empty = emptyLog();
    writeJson(fp, empty);
    return empty;
  }
  return readJson(fp, emptyLog());
}

export function appendVerifyRecord(projectId, record) {
  const log = loadVerifyLog(projectId);
  const entry = {
    id: `ver_${randomUUID().slice(0, 8)}`,
    at: now(),
    ...record,
  };
  log.items.unshift(entry);
  log.items = log.items.slice(0, 100);
  log.updated_at = now();
  writeJson(verifyLogPath(projectId), log);
  return entry;
}

export function getLatestVerify(projectId) {
  const log = loadVerifyLog(projectId);
  return log.items[0] || null;
}

export function loadHealthSnapshot(projectId) {
  const fp = healthSnapshotPath(projectId);
  if (!fs.existsSync(fp)) return null;
  return readJson(fp, null);
}

/** @deprecated V2.8 — Cleanup A：禁止落盘 */
export function saveHealthSnapshot() {
  throw new Error(HEALTH_SNAPSHOT_WRITE_ERROR);
}

export function buildVerifyAggregate(projectId, limit = 20) {
  const recent = listRecentVerifies(projectId, limit);
  const scored = recent.filter((v) => v.status);
  const passCount = scored.filter((v) => v.status === 'pass').length;
  return {
    source: 'verify_log_aggregate',
    verify_summary: {
      recent_total: scored.length,
      pass: passCount,
      partial: scored.filter((v) => v.status === 'partial').length,
      fail: scored.filter((v) => v.status === 'fail').length,
      pass_rate: scored.length ? Math.round((passCount / scored.length) * 100) : null,
    },
    last_verify: recent[0] || null,
  };
}

export function listRecentVerifies(projectId, limit = 10) {
  const log = loadVerifyLog(projectId);
  return log.items.slice(0, limit);
}
