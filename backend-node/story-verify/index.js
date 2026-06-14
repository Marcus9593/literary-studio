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
import { verifyStructure } from './structure-verifier.js';
import { loadUnderstandingBundle } from '../story-understanding/store.js';
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
  const originalStatus = verifyResult.status;
  const withMetrics = enrichWithMetrics(projectId, verifyResult);
  const enriched = enrichWithStructureCheck(projectId, withMetrics);
  const record = appendVerifyRecord(projectId, enriched);

  const actionId = originalStatus !== 'pass'
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

/**
 * 结构完整性验证：从 Understanding bundle 提取数据并运行七维度检查
 */
export function verifyStructureIntegrity(projectId) {
  const bundle = (() => {
    try {
      return loadUnderstandingBundle(projectId);
    } catch {
      return null;
    }
  })();

  if (!bundle) {
    return {
      score: 0,
      dimensionScores: {},
      checks: [{
        id: 'structure_data_available',
        label: '结构数据可用',
        pass: false,
        detail: '无法读取 Understanding bundle',
      }],
      gaps: [{ check_id: 'structure_data_available', label: '结构数据可用', detail: '无法读取 Understanding bundle' }],
      suggestions: [{ dimension: 'data', priority: 'high', action: '请先执行作品分析同步，生成 Understanding 数据' }],
    };
  }

  const arcs = bundle?.arcs?.items || [];
  const conflicts = bundle?.conflicts?.items || [];
  const valueShifts = bundle?.value_shifts?.items || bundle?.valueShifts || [];
  const turningPoints = bundle?.turning_points?.items || bundle?.turningPoints || [];
  const emotionCurve = bundle?.emotion_curve || bundle?.emotionCurve || [];
  const totalChapters = bundle?.total_chapters || bundle?.outline?.total_chapters || 0;

  return verifyStructure({
    arcs,
    conflicts,
    valueShifts,
    turningPoints,
    emotionCurve,
    totalChapters,
  });
}

/**
 * 在验收流程中追加结构完整性检查
 * 将结构检查结果合入已有的 verifyResult
 */
function enrichWithStructureCheck(projectId, verifyResult) {
  try {
    const structureResult = verifyStructureIntegrity(projectId);
    if (!structureResult || structureResult.score === 0 && !structureResult.checks?.length) {
      return verifyResult;
    }

    // 将结构检查作为额外 checks 合入
    const structureChecks = [
      {
        id: 'structure_score',
        label: `结构完整性评分（${structureResult.score}/100）`,
        pass: structureResult.score >= 70,
        detail: `综合得分 ${structureResult.score}，维度：${Object.entries(structureResult.dimensionScores || {})
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`,
      },
      // 仅取 gaps 的前 5 条作为 checks 展示
      ...structureResult.gaps.slice(0, 5).map((g) => ({
        id: `structure_gap_${g.check_id}`,
        label: `结构·${g.label}`,
        pass: false,
        detail: g.detail,
      })),
    ];

    const checks = [...(verifyResult.checks || []), ...structureChecks];
    const allPass = checks.every((c) => c.pass);
    const anyPass = checks.some((c) => c.pass);
    let status = verifyResult.status;
    // 结构检查仅作为参考，不改变已通过的验收结果
    if (status !== 'pass') {
      if (allPass) status = 'pass';
      else if (anyPass) status = 'partial';
      else status = 'fail';
    }

    return {
      ...verifyResult,
      status,
      checks,
      structure_score: structureResult.score,
      structure_gaps: structureResult.gaps,
      structure_suggestions: structureResult.suggestions,
    };
  } catch {
    return verifyResult;
  }
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
  verifyStructureIntegrity,
  getLatestVerify,
  listRecentVerifies,
  captureExecutionBaseline,
};
