import { runCriticReview } from '../screenplay-critic/critic-engine.js';
import { decideGovernor } from '../story-governor/decide.js';
import { validateCanon } from '../story-canon/engine.js';
import { loadCriticContext } from './content-loader.js';
import { runNarrativeAnalysis, mergeEngineIntoCriticReport } from './narrative-analysis.js';
import {
  createPipelineRun,
  updatePipelineRun,
  saveCriticReport,
} from '../storage/sqlite/repos/pipeline-repo.js';
import { runReview } from '../measurement/review-facade.js';
import { syncRevisionFollowup } from './revision-followup.js';
import { runLlmCritic } from './llm-critic.js';
import * as storage from '../storage.js';

/**
 * Full critic run: rules engine + canon check + governor + persistence.
 * Optional LLM semantic layer when includeLlmCritic and HTTP model configured.
 */
export async function runEngineCritic(projectId, {
  filename,
  unitIndex,
  pipelineId,
  includeMeasurement = true,
  includeLlmCritic = false,
  skipFollowup = false,
  autoCreatePlan = true,
} = {}) {
  const ctx = loadCriticContext(projectId, { filename });
  if (!ctx.content?.trim()) {
    throw new Error('尚无正文可审稿');
  }

  const resolvedUnit = Number(unitIndex) || ctx.chapter || 1;
  const review = runCriticReview(ctx.content, {
    characterNames: ctx.character_names,
    bibleThemes: ctx.bible_themes,
    workType: ctx.work_type,
  });

  let engineAnalysis = null;
  try {
    engineAnalysis = runNarrativeAnalysis(projectId, {
      filename: ctx.filename,
      unitIndex: resolvedUnit,
    });
    review.critic_report = mergeEngineIntoCriticReport(review.critic_report, engineAnalysis);
  } catch {
    engineAnalysis = null;
  }

  const canon = validateCanon(projectId, ctx.content, resolvedUnit);
  const governor = decideGovernor(projectId, review.critic_report, resolvedUnit);

  const savedReport = saveCriticReport(projectId, {
    unitIndex: resolvedUnit,
    workspaceRef: ctx.filename,
    report: {
      ...review,
      engine_analysis: engineAnalysis,
      canon_validation: canon,
      governor_decision: governor,
    },
    scoringMethod: 'rules',
  });

  let pipeline = null;
  if (pipelineId) {
    pipeline = updatePipelineRun(projectId, pipelineId, {
      status: 'complete',
      workspace_ref: ctx.filename,
      critic_json: savedReport.report,
      governor_decision: governor.decision,
      governor_memo: governor.revision_memo,
    });
  } else {
    pipeline = createPipelineRun(projectId, {
      unit_index: resolvedUnit,
      status: 'complete',
      workspace_ref: ctx.filename,
    });
    pipeline = updatePipelineRun(projectId, pipeline.id, {
      critic_json: savedReport.report,
      governor_decision: governor.decision,
      governor_memo: governor.revision_memo,
    });
  }

  let measurement = null;
  if (includeMeasurement) {
    try {
      measurement = runReview(projectId);
    } catch {
      measurement = null;
    }
  }

  let llmCritic = null;
  if (includeLlmCritic) {
    try {
      llmCritic = await runLlmCritic(projectId, {
        filename: ctx.filename,
        unitIndex: resolvedUnit,
      });
      if (llmCritic && !llmCritic.skipped) {
        saveCriticReport(projectId, {
          unitIndex: resolvedUnit,
          workspaceRef: ctx.filename,
          report: {
            ...review,
            engine_analysis: engineAnalysis,
            canon_validation: canon,
            governor_decision: governor,
            llm_critic: llmCritic,
          },
          scoringMethod: 'rules+llm',
        });
      }
    } catch (err) {
      llmCritic = { skipped: true, reason: err.message };
    }
  }

  const base = {
    workspace_ref: ctx.filename,
    unit_index: resolvedUnit,
    critic: review,
    engine_analysis: engineAnalysis,
    canon_validation: canon,
    governor,
    llm_critic: llmCritic,
    report_id: savedReport.id,
    pipeline_id: pipeline.id,
    measurement,
  };

  if (skipFollowup) {
    return { ...base, followup: null };
  }

  const meta = storage.getProject(projectId);
  const followup = syncRevisionFollowup(projectId, base, {
    createPlan: autoCreatePlan,
    workType: meta.work_type,
  });

  return { ...base, followup };
}
