import { loadKnowledgeBundle } from '../story-kb/store.js';

/** @type {Map<string, object>} */
const indexCache = new Map();

export function rebuildStoryIndex(projectId) {
  const kb = loadKnowledgeBundle(projectId);
  const index = {
    project_id: projectId,
    built_at: new Date().toISOString(),
    characters: new Map(),
    relationships: [],
    timeline: [],
    foreshadows: [],
    locations: [],
  };

  for (const c of kb.characters?.items || []) {
    const key = (c.name || c.id || '').trim();
    if (!key) continue;
    index.characters.set(key, {
      ...c,
      aliases: c.aliases || [],
      appearances: c.appearances || [],
    });
  }

  index.relationships = kb.relationships?.items || [];
  index.timeline = kb.timeline?.events || [];
  index.foreshadows = kb.foreshadows?.items || [];
  index.locations = kb.locations?.items || [];

  indexCache.set(projectId, index);
  return index;
}

export function getStoryIndex(projectId) {
  if (!indexCache.has(projectId)) {
    rebuildStoryIndex(projectId);
  }
  return indexCache.get(projectId);
}

export function invalidateStoryIndex(projectId) {
  indexCache.delete(projectId);
}
