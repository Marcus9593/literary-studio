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

export function emptyValueShifts() {
  return {
    version: 2,
    schema: 'value_shifts',
    updated_at: null,
    source: null,
    items: [],
    value_curve: [],
    flat_ranges: [],
  };
}

export function emptyEmotionCurve() {
  return {
    version: 1,
    schema: 'emotion_curve',
    updated_at: null,
    source: null,
    curve: [],
    fatigue_warnings: [],
    summary: {
      avg_intensity: 0,
      emotion_distribution: {},
      value_shifts: 0,
      chapter_count: 0,
      peak_intensity: 0,
      lowest_intensity: 0,
    },
  };
}

export function emptyGaps() {
  return { version: 2, schema: 'gaps', updated_at: null, source: null, items: [] };
}

export function emptyForeshadows() {
  return { version: 2, schema: 'foreshadows', updated_at: null, source: null, items: [] };
}

export function emptyTurningPoints() {
  return { version: 2, schema: 'turning_points', updated_at: null, source: null, items: [] };
}

export const UNDERSTANDING_FILE_MAP = {
  arcs: 'character_arcs.json',
  conflicts: 'conflicts.json',
  story_dna: 'story_dna.json',
  value_shifts: 'value_shifts.json',
  emotion_curve: 'emotion_curve.json',
  gaps: 'gaps.json',
  foreshadows: 'foreshadows.json',
  turning_points: 'turning_points.json',
};
