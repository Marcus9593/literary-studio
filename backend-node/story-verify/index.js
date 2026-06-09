import { loadTasks, updateTaskStatus, getTask } from '../story-tasks/store.js';
import { emit, EVENTS } from '../event-bus/bus.js';
import { scoreProjectHealth } from '../quality/scorer.js';
import {
  appendVerifyRecord,
  getLatestVerify,
  listRecentVerifies,
  buildVerifyAggregate,
  loadVerifyLog,
} from './store.js';
import { verifyLogPath } from './paths.js';
import fs from 'fs';
import {
  verifyWriteChapter,
  verifyPlanExecution,
  verifyTaskCompletion,
} from './verifiers.js';
import { loadBaselineForVerify, captureExecutionBaseline } from './baseline.js';
import { loadCurrentMetrics, compareUnderstandingMetrics, mergeMetricChecks } from './metrics.js';
import { createActionFromVerify } from './action-followup.js';
import { onContentApproved } from '../story-engine/hooks.js';

function findWriteTask(projectId, chapter) {
  const doc = loadTasks(projectId);
  const ch = parseInt(chapter, 10);
  return doc.items.find(
    (t) => t.type === 'write_chapter' && t.chapter === ch && t.status === 'in_progress',
  ) || doc.items.find(
    (t) => t.type === 'write_chapter' && t.chapter === ch && t.status === 'todo',
  ) || null;
}

function enrichWithMetrics(projectId, verifyResult) {
  const baseline = loadBaselineForVerify(projectId, verifyResult);
  if (!baseline?.metrics) return verifyResult;
  const after = loadCurrentMetrics(projectId);
  const comparison = compareUnderstandingMetrics(baseline.metrics, after, {
    kind: verifyResult.kind,
  });
  return mergeMetricChecks(verifyResult, comparison);
}

function patchRecordActionId(projectId, recordId, actionId) {
  const log = loadVerifyLog(projectId);
  const idx = log.items.findIndex((v) => v.id === recordId);
  if (idx >= 0) {
    log.items[idx].created_action_id = actionId;
    log.updated_at = new Date().toISOString();
    fs.writeFileSync(verifyLogPath(projectId), JSON.stringify(log, null, 2), 'utf-8');
  }
}

function applyTaskOutcome(projectId, verify) {
  if (!verify.task_id) return null;
  if (verify.status === 'pass' || verify.status === 'partial') {
    try {
      return updateTaskStatus(projectId, verify.task_id, 'done');
    } catch {
      return null;
    }
  }
  return null;
}

function refreshHealthSnapshot(projectId) {
  const quality = scoreProjectHealth(projectId);
  const aggregate = buildVerifyAggregate(projectId, 20);
  return {
    ...aggregate,
    quality_overview: {
      overall_health: quality.overall_health,
      kb_stats: quality.kb_stats,
    },
  };
}

export function recordVerify(projectId, verifyResult) {
  const enriched = enrichWithMetrics(projectId, verifyResult);
  const record = appendVerifyRecord(projectId, enriched);

  const actionId = enriched.status !== 'pass'
    ? createActionFromVerify(projectId, record)?.id
    : null;
  if (actionId) {
    record.created_action_id = actionId;
    patchRecordActionId(projectId, record.id, actionId);
  }

  applyTaskOutcome(projectId, record);

  let memory_sync = null;
  if (record.status === 'pass' || record.status === 'partial') {
    try {
      memory_sync = onContentApproved(projectId, {
        chapter: record.chapter,
        verifyStatus: record.status,
      });
    } catch {
      memory_sync = null;
    }
  }

  const health = refreshHealthSnapshot(projectId);
  emit(EVENTS.VERIFY_COMPLETED, { projectId, verify: record, health, created_action_id: actionId, memory_sync });
  return { verify: record, health, created_action_id: actionId, memory_sync };
}

export function verifyAfterWrite(projectId, { chapter, filename, title }) {
  const task = findWriteTask(projectId, chapter);
  const result = verifyWriteChapter(projectId, {
    chapter,
    filename,
    taskId: task?.id,
  });
  return recordVerify(projectId, result);
}

export function verifyAfterPlanComplete(projectId, plan) {
  const result = verifyPlanExecution(projectId, plan, { taskId: plan.task_id });
  return recordVerify(projectId, result);
}

export function verifyAndCompleteTask(projectId, taskId) {
  updateTaskStatus(projectId, taskId, 'done');
  const task = getTask(projectId, taskId);
  const result = verifyTaskCompletion(projectId, task);
  const wrapped = recordVerify(projectId, result);
  return { task, ...wrapped };
}

export function getVerifyBundle(projectId) {
  return {
    latest: getLatestVerify(projectId),
    recent: listRecentVerifies(projectId, 10),
    health_snapshot: buildVerifyAggregate(projectId, 20),
  };
}

export {
  verifyWriteChapter,
  verifyPlanExecution,
  verifyTaskCompletion,
  getLatestVerify,
  listRecentVerifies,
  captureExecutionBaseline,
};
