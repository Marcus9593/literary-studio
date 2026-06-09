export function emptyArcs() {
  return { version: 2, schema: 'character_arcs', updated_at: null, source: null, items: [] };
}

export function emptyConflicts() {
  return { version: 2, schema: 'conflicts', updated_at: null, source: null, items: [] };
}

export function emptyStoryDna() {
  return {
    version: 2,
    schema: 'story_dna',
    updated_at: null,
    source: null,
    one_liner: '',
    core_engine: '',
    health_signals: {},
    top_priorities: [],
  };
}

export const UNDERSTANDING_FILE_MAP = {
  arcs: 'character_arcs.json',
  conflicts: 'conflicts.json',
  story_dna: 'story_dna.json',
};
