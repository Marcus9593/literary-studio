import { emit, EVENTS } from './bus.js';

/** 文稿或 workspace 变更后通知（索引重建、统计刷新等） */
export function notifyProjectContentChanged(projectId, detail = {}) {
  if (!projectId) return;
  emit(EVENTS.PROJECT_UPDATED, { projectId, ...detail });
}
