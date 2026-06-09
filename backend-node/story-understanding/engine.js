import { analyzeArcs, buildArcAction } from './arc-analyzer.js';
import { analyzeConflicts, buildConflictAction } from './conflict-analyzer.js';
import {
  analyzeForeshadows,
  buildForeshadowActions,
} from './foreshadow-analyzer.js';
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
 * 运行理解层分析（Arc / Conflict / Foreshadow）并写入 understanding + actions
 */
export function runUnderstandingEngine(projectId, { latestChapters = 10, source = 'quick_sync' } = {}) {
  bootstrapFromWorkspace(projectId);
  let kb = loadKnowledgeBundle(projectId);
  const manifest = scanSources(projectId, { latestChapters });
  kb = enrichKbFromManifest(kb, manifest);

  const arcs = analyzeArcs({ kb, manifest, projectId });
  const conflicts = analyzeConflicts({ kb, manifest, projectId });
  const foreshadowResult = analyzeForeshadows({ kb, manifest });

  if (foreshadowResult.kbItems?.length) {
    saveUnderstandingFile(projectId, 'foreshadows', {
      version: 2,
      schema: 'foreshadows',
      source: 'foreshadow_analyzer',
      items: foreshadowResult.kbItems,
    }, source);
  }

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
      actions: actions.length,
    },
    story_dna: storyDna,
  };
}
