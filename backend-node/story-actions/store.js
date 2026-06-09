import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { actionsDir, actionsPath } from '../story-understanding/paths.js';

function now() {
  return new Date().toISOString();
}

function emptyActions() {
  return { version: 2, schema: 'story_actions', updated_at: null, items: [] };
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

export function loadActions(projectId) {
  const fp = actionsPath(projectId);
  if (!fs.existsSync(fp)) {
    const empty = emptyActions();
    writeJson(fp, empty);
    return empty;
  }
  return readJson(fp, emptyActions());
}

export function saveActions(projectId, data, source = 'collector') {
  const payload = {
    ...data,
    version: 2,
    schema: 'story_actions',
    updated_at: now(),
    source,
  };
  writeJson(actionsPath(projectId), payload);
  return payload;
}

export function replaceActions(projectId, items, source = 'collector') {
  return saveActions(projectId, { items }, source);
}

export function getAction(projectId, actionId) {
  const doc = loadActions(projectId);
  const item = (doc.items || []).find((a) => a.id === actionId);
  if (!item) throw new Error('建议不存在');
  return item;
}

export function newActionId(prefix = 'act') {
  return `${prefix}_${randomUUID().slice(0, 10)}`;
}

/** 追加单条 Action（Verify 跟进等），按 source_ref 去重 */
export function appendAction(projectId, action, source = 'verify') {
  const doc = loadActions(projectId);
  const items = doc.items || [];
  if (action.source_ref && items.some((a) => a.source_ref === action.source_ref)) {
    return doc;
  }
  const entry = {
    ...action,
    created_at: action.created_at || now(),
  };
  return saveActions(projectId, { items: [entry, ...items] }, source);
}
