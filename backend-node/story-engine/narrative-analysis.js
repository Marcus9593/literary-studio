import { loadKnowledgeBundle } from '../story-kb/store.js';
import { listVoiceDnas } from '../storage/sqlite/repos/voice-dna-repo.js';
import { loadCriticContext } from './content-loader.js';
import {
  analyzePressure,
  analyzeSuspense,
  checkCharacterArc,
  checkForeshadow,
  checkTheme,
  checkVoiceConsistency,
} from './engines/index.js';
import { loadBeatOutline } from './beat-outline-store.js';

function voiceDnaMap(projectId) {
  const map = {};
  for (const dna of listVoiceDnas(projectId)) {
    map[dna.character_id] = dna;
  }
  return map;
}

function loadCharacters(projectId) {
  const kb = loadKnowledgeBundle(projectId);
  return kb.characters?.items || [];
}

/**
 * Full narrative engine analysis for a manuscript unit.
 */
export function runNarrativeAnalysis(projectId, {
  filename,
  chapter,
  unitIndex,
  totalBeats,
} = {}) {
  const ctx = loadCriticContext(projectId, { filename, chapter });
  if (!ctx.content?.trim()) {
    throw new Error('尚无正文可分析');
  }

  const resolvedUnit = Number(unitIndex) || ctx.chapter || 1;
  const characters = loadCharacters(projectId);
  const dnaMap = voiceDnaMap(projectId);

  let beats = totalBeats;
  if (!beats) {
    try {
      const outline = loadBeatOutline(projectId, resolvedUnit);
      beats = outline?.beats?.length || 0;
    } catch {
      beats = 0;
    }
  }

  const pressure = analyzePressure(ctx.content, beats);
  const suspense = analyzeSuspense(ctx.content, resolvedUnit);
  const theme = checkTheme(ctx.content, ctx.bible_themes);
  const foreshadow = checkForeshadow(ctx.content, resolvedUnit);
  const arc = checkCharacterArc(ctx.content, characters);
  const voice_issues = checkVoiceConsistency(ctx.content, characters, dnaMap);

  return {
    workspace_ref: ctx.filename,
    unit_index: resolvedUnit,
    title: ctx.title,
    pressure,
    suspense,
    theme,
    foreshadow,
    character_arc: arc,
    voice_issues,
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Enhance critic dimension scores using engine analysis.
 */
export function mergeEngineIntoCriticReport(criticReport, analysis) {
  if (!criticReport || !analysis) return criticReport;

  const next = { ...criticReport };

  if (analysis.pressure) {
    next.pressure = {
      ...next.pressure,
      score: analysis.pressure.overall,
      level: analysis.pressure.overall >= 7 ? 'PASS' : analysis.pressure.overall >= 4 ? 'SOFT' : 'HARD',
      details: `叙事压力 ${analysis.pressure.overall}/10 · ${analysis.pressure.state} · ${analysis.pressure.direction}`,
    };
  }

  if (analysis.suspense) {
    next.continuity = {
      ...next.continuity,
      score: analysis.suspense.intensity,
      level: analysis.suspense.level === 'low' ? 'SOFT' : 'PASS',
      details: `悬念 ${analysis.suspense.intensity}/10 · 未解线索 ${analysis.suspense.open_threads?.length || 0}`,
    };
  }

  if (analysis.character_arc) {
    next.character = {
      ...next.character,
      score: Math.max(next.character?.score || 0, analysis.character_arc.score),
      level: analysis.character_arc.level,
      details: analysis.character_arc.summary,
    };
  }

  if (analysis.voice_issues?.length) {
    next.voice = {
      ...next.voice,
      level: analysis.voice_issues.length > 2 ? 'HARD' : 'SOFT',
      details: analysis.voice_issues.slice(0, 3).join('；'),
    };
  }

  return next;
}
