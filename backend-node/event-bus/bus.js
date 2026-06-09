export const EVENTS = {
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  SNAPSHOT_CREATED: 'SNAPSHOT_CREATED',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  WORKFLOW_FINISHED: 'WORKFLOW_FINISHED',
  WRITE_FINISHED: 'WRITE_FINISHED',
  MEMORY_INDEXED: 'MEMORY_INDEXED',
  KB_REBUILD_STARTED: 'KB_REBUILD_STARTED',
  KB_REBUILD_PROGRESS: 'KB_REBUILD_PROGRESS',
  KB_REBUILD_FINISHED: 'KB_REBUILD_FINISHED',
  KB_REBUILD_FAILED: 'KB_REBUILD_FAILED',
  UNDERSTANDING_UPDATED: 'UNDERSTANDING_UPDATED',
  VERIFY_COMPLETED: 'VERIFY_COMPLETED',
};

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

export async function emit(event, payload = {}) {
  const handlers = listeners.get(event);
  if (!handlers?.size) return;
  const tasks = [...handlers].map(async (fn) => {
    try {
      await fn(payload);
    } catch (err) {
      console.error(`[event-bus] ${event} handler error:`, err.message);
    }
  });
  await Promise.all(tasks);
}

export function clearAll() {
  listeners.clear();
}
