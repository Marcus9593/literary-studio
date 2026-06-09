import { Router } from 'express';
import * as store from './storage.js';
import { requireProjectWrite } from './auth/project-access.js';
import {
  listCanonRules,
  getCanonRule,
  createCanonRule,
  updateCanonRule,
  softDeleteCanonRule,
  getOverrideBudget,
} from './storage/sqlite/repos/canon-repo.js';
import {
  createPipelineRun,
  getPipelineRun,
  listPipelineRuns,
  updatePipelineRun,
  listCriticReports,
  saveCriticReport,
} from './storage/sqlite/repos/pipeline-repo.js';
import {
  listMemoryFacts,
  addMemoryFact,
  addMemoryFactsBatch,
  listNarrativeSummaries,
  getNarrativeSummary,
  upsertNarrativeSummary,
  buildMemoryContext,
} from './storage/sqlite/repos/memory-facts-repo.js';
import { validateCanon, buildCanonContext } from './story-canon/engine.js';
import { decideGovernor } from './story-governor/decide.js';
import { runEngineCritic } from './story-engine/run-critic.js';
import { runLlmCritic } from './story-engine/llm-critic.js';
import { buildBeatWritePlan } from './story-engine/beat-write.js';
import { onContentApproved } from './story-engine/hooks.js';
import { runAutoPipeline, getEngineLatest } from './story-engine/auto-pipeline.js';
import { runNarrativeAnalysis } from './story-engine/narrative-analysis.js';
import { loadCreatorContext } from './story-engine/creator-context.js';
import { extractSelfReview, hasSelfReview } from './story-engine/self-review.js';
import { loadBible, saveBible, upsertBibleSection, deleteBibleSection } from './story-engine/bible-store.js';
import { listBeatOutlines, loadBeatOutline, saveBeatOutline } from './story-engine/beat-outline-store.js';
import { buildCharacterGraph } from './story-engine/character-graph.js';
import { writeExportFile, exportMarkdown, exportDocx } from './story-engine/content-export.js';
import { listVoiceDnas, getVoiceDna, upsertVoiceDna } from './storage/sqlite/repos/voice-dna-repo.js';
import { trainVoiceDnaFromScript } from './story-engine/engines/voice-engine.js';
import { readManuscriptText } from './story-engine/content-loader.js';

const router = Router();

function pid(req) {
  return req.params.id;
}

function ensureProject(req, res, next) {
  if (req.projectMeta) return next();
  try {
    store.getProject(pid(req));
    next();
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
}

const base = '/projects/:id/engine';

router.use(base, (req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method)) return next();
  return requireProjectWrite(req, res, next);
});

// ── Canon ──

router.get(`${base}/canon`, ensureProject, (req, res) => {
  res.json({ rules: listCanonRules(pid(req)) });
});

router.get(`${base}/canon/context`, ensureProject, (req, res) => {
  res.json({ context: buildCanonContext(pid(req)) });
});

router.post(`${base}/canon`, ensureProject, (req, res) => {
  try {
    res.json(createCanonRule(pid(req), req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch(`${base}/canon/:ruleId`, ensureProject, (req, res) => {
  try {
    const rule = updateCanonRule(pid(req), Number(req.params.ruleId), req.body || {});
    if (!rule) return res.status(404).json({ error: '规则不存在' });
    res.json(rule);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete(`${base}/canon/:ruleId`, ensureProject, (req, res) => {
  const ok = softDeleteCanonRule(pid(req), Number(req.params.ruleId));
  if (!ok) return res.status(404).json({ error: '规则不存在' });
  res.json({ status: 'deleted' });
});

router.get(`${base}/canon/:ruleId`, ensureProject, (req, res) => {
  const rule = getCanonRule(pid(req), Number(req.params.ruleId));
  if (!rule) return res.status(404).json({ error: '规则不存在' });
  res.json(rule);
});

router.post(`${base}/canon/validate`, ensureProject, (req, res) => {
  const { content = '', unit_index: unitIndex = 1 } = req.body || {};
  res.json(validateCanon(pid(req), content, Number(unitIndex) || 1));
});

router.get(`${base}/override-budget/:unitIndex`, ensureProject, (req, res) => {
  res.json(getOverrideBudget(pid(req), Number(req.params.unitIndex) || 1));
});

// ── Pipeline ──

router.get(`${base}/pipelines`, ensureProject, (req, res) => {
  const unitIndex = req.query.unit_index != null ? Number(req.query.unit_index) : undefined;
  res.json({ runs: listPipelineRuns(pid(req), { unitIndex }) });
});

router.post(`${base}/pipelines`, ensureProject, (req, res) => {
  try {
    res.json(createPipelineRun(pid(req), req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get(`${base}/pipelines/:runId`, ensureProject, (req, res) => {
  const run = getPipelineRun(pid(req), Number(req.params.runId));
  if (!run) return res.status(404).json({ error: '流水线不存在' });
  res.json(run);
});

router.patch(`${base}/pipelines/:runId`, ensureProject, (req, res) => {
  const run = updatePipelineRun(pid(req), Number(req.params.runId), req.body || {});
  if (!run) return res.status(404).json({ error: '流水线不存在' });
  res.json(run);
});

router.post(`${base}/governor/decide`, ensureProject, (req, res) => {
  const { critic_report: criticReport, unit_index: unitIndex = 1 } = req.body || {};
  if (!criticReport) return res.status(400).json({ error: '需要 critic_report' });
  res.json(decideGovernor(pid(req), criticReport, Number(unitIndex) || 1));
});

router.get(`${base}/critic-reports`, ensureProject, (req, res) => {
  res.json({ reports: listCriticReports(pid(req)) });
});

router.post(`${base}/critic-reports`, ensureProject, (req, res) => {
  const { unit_index: unitIndex, workspace_ref: workspaceRef, report, scoring_method: scoringMethod } = req.body || {};
  if (!report) return res.status(400).json({ error: '需要 report' });
  res.json(saveCriticReport(pid(req), {
    unitIndex,
    workspaceRef,
    report,
    scoringMethod,
  }));
});

router.get(`${base}/critic/latest`, ensureProject, (req, res) => {
  res.json(getEngineLatest(pid(req)));
});

router.post(`${base}/critic/run`, ensureProject, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runEngineCritic(pid(req), {
      filename: body.filename,
      unitIndex: body.unit_index,
      pipelineId: body.pipeline_id,
      includeMeasurement: body.include_measurement !== false,
      includeLlmCritic: body.include_llm_critic === true,
      autoCreatePlan: body.auto_create_plan !== false,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/critic/llm`, ensureProject, async (req, res) => {
  try {
    const body = req.body || {};
    res.json(await runLlmCritic(pid(req), {
      filename: body.filename,
      unitIndex: body.unit_index,
    }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/pipeline/run`, ensureProject, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runAutoPipeline(pid(req), {
      filename: body.filename,
      unitIndex: body.unit_index,
      autoCreatePlan: body.auto_create_plan !== false,
      includeMeasurement: body.include_measurement !== false,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/memory/sync`, ensureProject, (req, res) => {
  try {
    const body = req.body || {};
    const result = onContentApproved(pid(req), {
      filename: body.filename,
      chapter: body.unit_index ?? body.chapter,
      content: body.content,
      verifyStatus: body.verify_status || 'pass',
    });
    if (!result) return res.status(400).json({ error: '无法同步记忆（内容为空或未通过验收）' });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Memory (structured facts) ──

router.get(`${base}/memory/facts`, ensureProject, (req, res) => {
  const unitIndex = req.query.unit_index != null ? Number(req.query.unit_index) : undefined;
  const category = req.query.category || undefined;
  res.json({ facts: listMemoryFacts(pid(req), { unitIndex, category }) });
});

router.post(`${base}/memory/facts`, ensureProject, (req, res) => {
  const body = req.body || {};
  if (Array.isArray(body.facts)) {
    return res.json({ facts: addMemoryFactsBatch(pid(req), body.facts) });
  }
  res.json(addMemoryFact(pid(req), body));
});

router.get(`${base}/memory/summaries`, ensureProject, (req, res) => {
  res.json({ summaries: listNarrativeSummaries(pid(req)) });
});

router.get(`${base}/memory/summaries/:unitIndex`, ensureProject, (req, res) => {
  const summary = getNarrativeSummary(pid(req), Number(req.params.unitIndex) || 1);
  if (!summary) return res.status(404).json({ error: '摘要不存在' });
  res.json(summary);
});

router.put(`${base}/memory/summaries/:unitIndex`, ensureProject, (req, res) => {
  const summary = String(req.body?.summary || '');
  res.json(upsertNarrativeSummary(pid(req), Number(req.params.unitIndex) || 1, summary));
});

router.get(`${base}/memory/context/:unitIndex`, ensureProject, (req, res) => {
  const unitIndex = Number(req.params.unitIndex) || 1;
  res.json({ context: buildMemoryContext(pid(req), unitIndex) });
});

// ── Narrative analysis (Pressure / Suspense / Arc / Theme / Foreshadow) ──

router.get(`${base}/analysis`, ensureProject, (req, res) => {
  try {
    res.json(runNarrativeAnalysis(pid(req), {
      filename: req.query.filename,
      chapter: req.query.chapter,
      unitIndex: req.query.unit_index,
    }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/analysis`, ensureProject, (req, res) => {
  try {
    const body = req.body || {};
    res.json(runNarrativeAnalysis(pid(req), {
      filename: body.filename,
      chapter: body.chapter,
      unitIndex: body.unit_index,
      totalBeats: body.total_beats,
    }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Creator context chain ──

router.get(`${base}/creator-context/:unitIndex`, ensureProject, (req, res) => {
  const unitIndex = Number(req.params.unitIndex) || 1;
  res.json(loadCreatorContext(pid(req), unitIndex, { filename: req.query.filename }));
});

// ── Self-review extraction ──

router.post(`${base}/self-review/extract`, ensureProject, (req, res) => {
  const output = String(req.body?.output || '');
  res.json({ ...extractSelfReview(output), has_self_review: hasSelfReview(output) });
});

// ── Voice DNA ──

router.get(`${base}/voice-dna`, ensureProject, (req, res) => {
  res.json({ items: listVoiceDnas(pid(req)) });
});

router.get(`${base}/voice-dna/:characterId`, ensureProject, (req, res) => {
  const dna = getVoiceDna(pid(req), req.params.characterId);
  if (!dna) return res.status(404).json({ error: 'Voice DNA 不存在' });
  res.json(dna);
});

router.put(`${base}/voice-dna/:characterId`, ensureProject, (req, res) => {
  try {
    res.json(upsertVoiceDna(pid(req), req.params.characterId, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/voice-dna/:characterId/train`, ensureProject, (req, res) => {
  try {
    const projectId = pid(req);
    const characterId = req.params.characterId;
    const body = req.body || {};
    const loaded = readManuscriptText(projectId, body.filename, body.unit_index);
    const name = body.character_name;
    if (!name) return res.status(400).json({ error: '需要 character_name' });
    const trained = trainVoiceDnaFromScript(loaded.content, name);
    if (!trained) return res.status(400).json({ error: '未在正文中找到该角色对白' });
    res.json(upsertVoiceDna(projectId, characterId, trained));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Story Bible (sections + changelog) ──

router.get(`${base}/bible`, ensureProject, (req, res) => {
  res.json(loadBible(pid(req)));
});

router.put(`${base}/bible`, ensureProject, (req, res) => {
  try {
    res.json(saveBible(pid(req), req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/bible/sections`, ensureProject, (req, res) => {
  try {
    res.json(upsertBibleSection(pid(req), req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete(`${base}/bible/sections/:sectionId`, ensureProject, (req, res) => {
  res.json(deleteBibleSection(pid(req), req.params.sectionId));
});

// ── Beat outlines ──

router.get(`${base}/beats`, ensureProject, (req, res) => {
  const unitIndex = req.query.unit_index != null ? Number(req.query.unit_index) : null;
  if (unitIndex != null) {
    return res.json(loadBeatOutline(pid(req), unitIndex));
  }
  res.json({ outlines: listBeatOutlines(pid(req)) });
});

router.put(`${base}/beats/:unitIndex`, ensureProject, (req, res) => {
  try {
    const unitIndex = Number(req.params.unitIndex) || 1;
    res.json(saveBeatOutline(pid(req), unitIndex, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(`${base}/beats/:unitIndex/write-plan`, ensureProject, (req, res) => {
  try {
    const unitIndex = Number(req.params.unitIndex) || 1;
    res.json(buildBeatWritePlan(pid(req), unitIndex));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Character graph ──

router.get(`${base}/character-graph`, ensureProject, (req, res) => {
  res.json(buildCharacterGraph(pid(req)));
});

// ── Export ──

router.post(`${base}/export`, ensureProject, (req, res) => {
  try {
    const body = req.body || {};
    const format = body.format === 'docx' ? 'docx' : 'md';
    if (body.download === false) {
      const exporter = format === 'docx' ? exportDocx : exportMarkdown;
      const result = exporter(pid(req), body);
      return res.json(result);
    }
    res.json(writeExportFile(pid(req), { ...body, format }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
