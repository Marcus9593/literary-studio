export function emptyKnowledge() {
  return {
    characters: { version: 1, updated_at: null, items: [] },
    relationships: { version: 1, updated_at: null, items: [] },
    timeline: { version: 1, updated_at: null, events: [] },
    locations: { version: 1, updated_at: null, items: [] },
    foreshadows: { version: 1, updated_at: null, items: [] },
    story_summary: {
      version: 1,
      updated_at: null,
      logline: '',
      themes: [],
      arcs: [],
      factions: [],
    },
  };
}

export const KB_FILE_MAP = {
  characters: 'characters.json',
  relationships: 'relationships.json',
  timeline: 'timeline.json',
  locations: 'locations.json',
  foreshadows: 'foreshadows.json',
  story_summary: 'story_summary.json',
};
