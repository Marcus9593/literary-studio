import { analyzeArcs, buildArcAction } from './arc-analyzer.js';
import { analyzeConflicts, buildConflictAction, analyzeGaps, buildGapAction, detectTurningPoints } from './conflict-analyzer.js';
import {
  analyzeForeshadows,
  buildForeshadowActions,
} from './foreshadow-analyzer.js';
import {
  analyzeValueShifts,
  buildValueCurve,
  detectFlatScenes,
  buildValueShiftActions,
} from './value-analyzer.js';
import { analyzeEmotions } from './emotion-analyzer.js';
import { buildStoryDna } from './summary-builder.js';
import { loadKnowledgeBundle, saveKnowledgeFile, isPhaseCEntities } from '../story-kb/store.js';
import { saveUnderstandingFile } from './store.js';
import { replaceActions } from '../story-actions/store.js';
import { collectActions } from '../story-actions/collector.js';
import { buildFallbackActions } from '../story-actions/fallback.js';
import { scanSources, inferCharacterNames } from '../story-kb/scan-sources.js';
import { filterInferredCharacterItems } from '../story-kb/character-name-filter.js';
import { bootstrapFromWorkspace } from '../story-kb/sync.js';
import { rebuildStoryIndex } from '../story-index/build.js';

function enrichKbFromManifest(kb, manifest) {
  const items = [...(kb.characters?.items || [])];
  if (items.length > 0) return kb;

  const names = inferCharacterNames(manifest.chapters || []);
  for (const name of names) {
    items.push({
      id: name,
      name,
      role: items.length === 0 ? 'protagonist' : 'unknown',
      notes: '从正文对话推断',
      source: 'inferred',
    });
  }
  return {
    ...kb,
    characters: {
      ...(kb.characters || {}),
      items: filterInferredCharacterItems(items),
    },
  };
}

/**
 * 运行理解层分析（Arc / Conflict / Gap / Foreshadow / ValueShift / Emotion）并写入 understanding + actions
 */
export function runUnderstandingEngine(projectId, { latestChapters = 10, source = 'quick_sync' } = {}) {
  bootstrapFromWorkspace(projectId);
  let kb = loadKnowledgeBundle(projectId);
  const manifest = scanSources(projectId, { latestChapters });
  kb = enrichKbFromManifest(kb, manifest);

  const arcs = analyzeArcs({ kb, manifest, projectId });
  const conflicts = analyzeConflicts({ kb, manifest, projectId });
  const foreshadowResult = analyzeForeshadows({ kb, manifest });

  // 价值转变分析（P0-2 麦基 Value Shift System）
  const storyEvents = kb.story_events || [];
  const valueShiftResult = analyzeValueShifts({ kb, manifest, storyEvents });
  const valueCurve = buildValueCurve(valueShiftResult.items);
  const flatRanges = detectFlatScenes(valueShiftResult.items);
  const valueShiftActions = buildValueShiftActions({ valueCurve, flatRanges });

  if (foreshadowResult.kbItems?.length) {
    saveUnderstandingFile(projectId, 'foreshadows', {
      version: 2,
      schema: 'foreshadows',
      source: 'foreshadow_analyzer',
      items: foreshadowResult.kbItems,
    }, source);
  }

  // 写入价值转变分析结果
  saveUnderstandingFile(projectId, 'value_shifts', {
    version: 2,
    schema: 'value_shifts',
    source: 'value_analyzer',
    items: valueShiftResult.items,
    value_curve: valueCurve,
    flat_ranges: flatRanges,
  }, source);

  // 情感曲线分析（P0-3 Emotion Curve Visualization）
  const emotionResult = analyzeEmotions({ kb, manifest, storyEvents });
  saveUnderstandingFile(projectId, 'emotion_curve', emotionResult, source);

  // 鸿沟分析（P0-1 麦基 Gap Theory）
  const gaps = analyzeGaps({ kb, manifest, projectId });
  saveUnderstandingFile(projectId, 'gaps', {
    version: 2,
    schema: 'gaps',
    source: 'gap_analyzer',
    items: gaps.items,
  }, source);

  // 转折点检测（P1-6 Turning Point Detection）
  const reviewMetrics = kb.review_metrics || [];
  const turningPoints = detectTurningPoints(storyEvents, reviewMetrics);
  saveUnderstandingFile(projectId, 'turning_points', {
    version: 2,
    schema: 'turning_points',
    source: 'turning_point_detector',
    items: turningPoints.items,
  }, source);

  if (
    !isPhaseCEntities(projectId)
    && (kb.characters?.items || []).some((c) => c.source === 'inferred')
  ) {
    saveKnowledgeFile(projectId, 'characters', {
      version: 2,
      updated_at: new Date().toISOString(),
      source: 'inferred',
      items: filterInferredCharacterItems(kb.characters.items),
    });
  }

  saveUnderstandingFile(projectId, 'arcs', {
    version: 2,
    schema: 'character_arcs',
    items: arcs.items,
  }, source);
  saveUnderstandingFile(projectId, 'conflicts', {
    version: 2,
    schema: 'conflicts',
    items: conflicts.items,
  }, source);

  let actions = collectActions({ arcs, conflicts, foreshadowResult });
  // 追加价值转变行动建议
  actions = actions.concat(valueShiftActions);
  // 追加鸿沟增强行动建议
  const gapMainItem = gaps.items.find((g) => g.id === 'gap_main');
  const gapAction = buildGapAction(gapMainItem);
  if (gapAction) actions.push(gapAction);
  if (actions.length === 0) {
    actions = buildFallbackActions({ kb, manifest });
  }
  replaceActions(projectId, actions, source);

  const refreshedKb = loadKnowledgeBundle(projectId);
  const storyDna = buildStoryDna({
    kb: refreshedKb,
    arcs,
    conflicts,
    actions: { items: actions },
  });
  saveUnderstandingFile(projectId, 'story_dna', {
    version: 2,
    schema: 'story_dna',
    ...storyDna,
  }, source);

  rebuildStoryIndex(projectId);

  return {
    source,
    synced_at: new Date().toISOString(),
    manifest: {
      chapters_scanned: manifest.chapters_scanned,
      chapters_total: manifest.chapters_total,
      settings_files: manifest.settings?.length || 0,
      outline_files: manifest.outline?.length || 0,
    },
    stats: {
      arcs: arcs.items.length,
      conflicts: conflicts.items.length,
      gaps: gaps.items.length,
      turning_points: turningPoints.items.length,
      value_shifts: valueShiftResult.items.length,
      value_flat_ranges: flatRanges.length,
      emotions: emotionResult.curve.length,
      fatigue_warnings: emotionResult.fatigue_warnings.length,
      actions: actions.length,
    },
    story_dna: storyDna,
  };
}
