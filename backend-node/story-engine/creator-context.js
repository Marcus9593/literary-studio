import { buildCanonContext } from '../story-canon/engine.js';
import { loadKnowledgeBundle } from '../story-kb/store.js';
import { listNarrativeSummaries } from '../storage/sqlite/repos/memory-facts-repo.js';
import { listVoiceDnas } from '../storage/sqlite/repos/voice-dna-repo.js';
import { loadUnderstandingBundle } from '../story-understanding/store.js';
import { buildVoiceContext } from './engines/voice-engine.js';
import { analyzePressure } from './engines/pressure-engine.js';
import { loadBible } from './bible-store.js';
import { loadCriticContext } from './content-loader.js';
import { loadBeatOutline } from './beat-outline-store.js';

function buildCharacterProfiles(characters) {
  if (!characters.length) return 'No characters defined.';

  let result = 'CHARACTER PROFILES:\n\n';
  for (const p of characters) {
    result += `## ${p.name}\n`;
    if (p.role) result += `Role: ${p.role}\n`;
    if (p.ghost) result += `Ghost: ${p.ghost}\n`;
    if (p.wound) result += `Wound: ${p.wound}\n`;
    if (p.lie) result += `Lie: ${p.lie}\n`;
    if (p.want) result += `Want: ${p.want}\n`;
    if (p.need) result += `Need: ${p.need}\n`;
    if (p.arc_stage) result += `Arc stage: ${p.arc_stage}\n`;
    result += '\n';
  }
  return result;
}

function buildBibleContext(bible) {
  if (!bible?.title && !bible?.sections?.length) {
    return 'No story bible defined.';
  }

  let result = 'STORY BIBLE:\n\n';
  if (bible.title) result += `Title: ${bible.title}\n`;
  if (bible.genre) result += `Genre: ${bible.genre}\n`;
  if (bible.logline) result += `Logline: ${bible.logline}\n`;
  if (bible.setting) result += `Setting: ${bible.setting}\n`;
  if (bible.tone) result += `Tone: ${bible.tone}\n`;
  if (bible.themes) result += `Themes: ${bible.themes}\n`;

  for (const sec of bible.sections || []) {
    result += `\n### ${sec.title || sec.type}\n${sec.content || ''}\n`;
  }
  return result;
}

function buildSummaryContext(summaries, unitIndex) {
  const prior = (summaries || []).filter((s) => s.unit_index < unitIndex);
  if (!prior.length) {
    return unitIndex <= 1
      ? 'No narrative history yet — this is the first unit.'
      : 'No narrative summaries recorded for prior units.';
  }

  let result = 'NARRATIVE HISTORY:\n\n';
  for (const s of prior.slice(-5)) {
    result += `--- Unit ${s.unit_index} ---\n${s.summary}\n\n`;
  }
  return result;
}

/**
 * Creator context chain: Canon → Bible → Characters → Voice → Summary → Pressure → Knowledge
 */
export function loadCreatorContext(projectId, unitIndex = 1, { filename } = {}) {
  const kb = loadKnowledgeBundle(projectId);
  const characters = kb.characters?.items || [];
  const dnaList = listVoiceDnas(projectId);
  const dnaMap = Object.fromEntries(dnaList.map((d) => [d.character_id, d]));

  const bible = loadBible(projectId);
  const canon = buildCanonContext(projectId);
  const charactersCtx = buildCharacterProfiles(characters);
  const voiceCtx = buildVoiceContext(characters, dnaMap);
  const summaryCtx = buildSummaryContext(listNarrativeSummaries(projectId), unitIndex);

  let pressureCtx = `Maintain natural narrative tension for unit ${unitIndex}.`;
  try {
    const ctx = loadCriticContext(projectId, { filename });
    if (ctx.content?.trim()) {
      const p = analyzePressure(ctx.content, 0);
      pressureCtx = `Current pressure: ${p.overall}/10 (${p.state}, ${p.direction}). Target: sustain or build tension appropriately.`;
    }
  } catch {
    /* ignore */
  }

  let themes = '';
  try {
    const u = loadUnderstandingBundle(projectId);
    themes = u?.story_dna?.themes?.join?.(', ') || '';
  } catch {
    themes = bible.themes || '';
  }

  const knowledgeCtx = [
    'Use scene headings (INT./EXT.) for screenplay mode.',
    'Action lines describe what we see; dialogue under character names.',
    themes ? `Core themes: ${themes}` : '',
  ].filter(Boolean).join('\n');

  let beatsCtx = '';
  try {
    const outline = loadBeatOutline(projectId, unitIndex);
    if (outline?.beats?.length) {
      beatsCtx = `BEAT OUTLINE (unit ${unitIndex}):\n${outline.title ? `Title: ${outline.title}\n` : ''}${outline.description || ''}\n\n`;
      for (const b of outline.beats) {
        beatsCtx += `${b.order}. [${b.scene_type || 'scene'}] ${b.title}: ${b.description || ''}\n`;
      }
    }
  } catch {
    beatsCtx = '';
  }

  const sections = {
    canon,
    bible: buildBibleContext(bible),
    characters: charactersCtx,
    voice: voiceCtx,
    summary: summaryCtx,
    pressure: pressureCtx,
    beats: beatsCtx || `No beat outline for unit ${unitIndex}.`,
    knowledge: knowledgeCtx,
  };

  const prompt = Object.entries(sections)
    .map(([key, val]) => `=== ${key.toUpperCase()} ===\n${val}`)
    .join('\n\n');

  return { unit_index: unitIndex, sections, prompt };
}
