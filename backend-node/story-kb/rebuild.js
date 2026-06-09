import * as storage from '../storage.js';
import { bootstrapFromWorkspace } from './sync.js';
import { scanSources } from './scan-sources.js';
import { runUnderstandingEngine } from '../story-understanding/engine.js';
import { emit, EVENTS } from '../event-bus/bus.js';

const QUICK_CHAPTER_DEFAULT = 10;

/**
 * 快速同步 — 最新 N 章 + 大纲 + 设定集
 */
export function runQuickSync(projectId, options = {}) {
  const latestChapters = options.latestChapters ?? QUICK_CHAPTER_DEFAULT;
  bootstrapFromWorkspace(projectId);
  const result = runUnderstandingEngine(projectId, {
    latestChapters,
    source: 'quick_sync',
  });
  const payload = {
    mode: 'quick',
    label: '快速同步',
    ...result,
  };
  emit(EVENTS.UNDERSTANDING_UPDATED, { projectId, mode: 'quick', result: payload });
  return payload;
}

/**
 * 全书理解 — Sprint 2 实现 Claude 全量；当前降级为全书启发式
 */
export async function runDeepSync(projectId, options = {}) {
  const jobId = options.jobId;
  const manifest = scanSources(projectId, { latestChapters: 99999 });
  const latestChapters = manifest.chapters_total || QUICK_CHAPTER_DEFAULT;

  if (jobId) {
    storage.updateJob(jobId, { status: 'running', phase: 'understanding' });
  }

  bootstrapFromWorkspace(projectId);
  const result = runUnderstandingEngine(projectId, {
    latestChapters,
    source: 'deep_sync',
  });

  if (jobId) {
    storage.updateJob(jobId, {
      status: 'completed',
      result,
      finished_at: new Date().toISOString(),
    });
  }

  await emit(EVENTS.KB_REBUILD_FINISHED, { projectId, mode: 'deep', result });

  return {
    mode: 'deep',
    label: '全书理解',
    ...result,
  };
}

export function startSyncJob(projectId, mode = 'quick') {
  const job = storage.createJob(projectId, mode === 'deep' ? 'deep_sync' : 'quick_sync', { mode });
  if (mode === 'quick') {
    try {
      const result = runQuickSync(projectId);
      storage.updateJob(job.id, {
        status: 'completed',
        result,
        finished_at: new Date().toISOString(),
      });
      emit(EVENTS.KB_REBUILD_FINISHED, { projectId, mode: 'quick', jobId: job.id, result });
      emit(EVENTS.UNDERSTANDING_UPDATED, { projectId, jobId: job.id });
    } catch (e) {
      storage.updateJob(job.id, { status: 'failed', error: e.message });
      emit(EVENTS.KB_REBUILD_FAILED, { projectId, jobId: job.id, error: e.message });
      throw e;
    }
    return job;
  }

  setImmediate(async () => {
    try {
      storage.updateJob(job.id, { status: 'running' });
      await emit(EVENTS.KB_REBUILD_STARTED, { projectId, jobId: job.id, mode: 'deep' });
      await runDeepSync(projectId, { jobId: job.id });
      await emit(EVENTS.UNDERSTANDING_UPDATED, { projectId, jobId: job.id });
    } catch (e) {
      storage.updateJob(job.id, { status: 'failed', error: e.message });
      await emit(EVENTS.KB_REBUILD_FAILED, { projectId, jobId: job.id, error: e.message });
    }
  });

  return job;
}

export { QUICK_CHAPTER_DEFAULT };
