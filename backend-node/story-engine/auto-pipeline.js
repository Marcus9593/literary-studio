import * as storage from '../storage.js';
import { runEngineCritic } from './run-critic.js';
import { syncRevisionFollowup } from './revision-followup.js';
import {
  createPipelineRun,
  getPipelineRun,
  updatePipelineRun,
  listPipelineRuns,
  listCriticReports,
  MAX_REVISIONS,
} from '../storage/sqlite/repos/pipeline-repo.js';

function isScreenplayWorkType(workType) {
  return String(workType || '').startsWith('screenplay') || workType === 'web_short';
}

export function getEngineLatest(projectId) {
  const reports = listCriticReports(projectId, { limit: 1 });
  const pipelines = listPipelineRuns(projectId, { limit: 1 });
  return {
    latest_report: reports[0] || null,
    latest_pipeline: pipelines[0] || null,
  };
}

/**
 * 编剧室流水线：Critic → Governor → Actions/Plan（剧本模式自动建修订 Plan）
 */
export async function runAutoPipeline(projectId, {
  filename,
  unitIndex,
  autoCreatePlan = true,
  includeMeasurement = true,
} = {}) {
  const meta = storage.getProject(projectId);
  const pipeline = createPipelineRun(projectId, {
    unit_index: unitIndex,
    status: 'running',
    workspace_ref: filename || null,
  });

  const result = await runEngineCritic(projectId, {
    filename,
    unitIndex,
    pipelineId: pipeline.id,
    includeMeasurement,
    skipFollowup: true,
  });

  const followup = syncRevisionFollowup(projectId, result, {
    createPlan: autoCreatePlan,
    workType: meta.work_type,
  });

  const finalPipeline = getPipelineRun(projectId, pipeline.id);

  return {
    ...result,
    followup,
    pipeline: finalPipeline,
    auto_revision_enabled: isScreenplayWorkType(meta.work_type),
    max_revisions: MAX_REVISIONS,
  };
}

/**
 * 修订 Plan 完成后继续流水线（max 2 次修订循环）
 */
export async function continuePipelineAfterRevision(projectId, plan) {
  if (plan?.source !== 'engine_revision' || !plan.pipeline_id) {
    return null;
  }

  const pipeline = getPipelineRun(projectId, plan.pipeline_id);
  if (!pipeline) return null;

  if (pipeline.revision_count >= MAX_REVISIONS) {
    return {
      stopped: true,
      reason: 'max_revisions',
      revision_count: pipeline.revision_count,
      max_revisions: MAX_REVISIONS,
    };
  }

  const nextCount = pipeline.revision_count + 1;
  updatePipelineRun(projectId, pipeline.id, {
    revision_count: nextCount,
    status: 'running',
  });

  const meta = storage.getProject(projectId);
  const result = await runEngineCritic(projectId, {
    filename: plan.chapter_filename || pipeline.workspace_ref,
    unitIndex: plan.chapter || pipeline.unit_index,
    pipelineId: pipeline.id,
    includeMeasurement: false,
    skipFollowup: true,
  });

  let followup = { actions: [], plan: null, skipped: true };
  if (result.governor?.decision === 'REVISE' && nextCount < MAX_REVISIONS) {
    followup = syncRevisionFollowup(projectId, result, {
      createPlan: true,
      workType: meta.work_type,
    });
  } else {
    updatePipelineRun(projectId, pipeline.id, {
      status: result.governor?.decision === 'APPROVE' ? 'complete' : 'failed',
    });
  }

  return {
    stopped: result.governor?.decision !== 'REVISE' || nextCount >= MAX_REVISIONS,
    reason: result.governor?.decision === 'APPROVE'
      ? 'approved'
      : nextCount >= MAX_REVISIONS
        ? 'max_revisions'
        : result.governor?.decision,
    revision_count: nextCount,
    max_revisions: MAX_REVISIONS,
    critic: result,
    followup,
    pipeline: getPipelineRun(projectId, pipeline.id),
  };
}
