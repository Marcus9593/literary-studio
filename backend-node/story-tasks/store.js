import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { tasksPath, tasksDir } from '../story-planner/paths.js';

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

function emptyTasks() {
  return { version: 1, schema: 'story_tasks', generated_at: null, items: [] };
}

export function loadTasks(projectId) {
  const fp = tasksPath(projectId);
  if (!fs.existsSync(fp)) {
    const empty = emptyTasks();
    writeJson(fp, empty);
    return empty;
  }
  return readJson(fp, emptyTasks());
}

export function saveTasks(projectId, data) {
  const payload = {
    ...data,
    version: 1,
    schema: 'story_tasks',
    generated_at: now(),
  };
  writeJson(tasksPath(projectId), payload);
  return payload;
}

export function getTask(projectId, taskId) {
  const doc = loadTasks(projectId);
  const task = doc.items.find((t) => t.id === taskId);
  if (!task) throw new Error('任务不存在');
  return task;
}

export function updateTaskStatus(projectId, taskId, status, extra = {}) {
  const doc = loadTasks(projectId);
  const idx = doc.items.findIndex((t) => t.id === taskId);
  if (idx < 0) throw new Error('任务不存在');
  doc.items[idx] = {
    ...doc.items[idx],
    status,
    ...extra,
    ...(status === 'done' ? { completed_at: now() } : {}),
  };
  return saveTasks(projectId, doc);
}

export function newTaskId() {
  return `task_${randomUUID().slice(0, 8)}`;
}
