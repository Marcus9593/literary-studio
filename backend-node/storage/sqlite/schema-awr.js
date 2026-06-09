/**
 * AWR-inspired engine tables — global studio.db, scoped by project_id.
 * Workspace / Knowledge remain file-based truth sources.
 */
export const SCHEMA_AWR = `
CREATE TABLE IF NOT EXISTS canon_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'world_rule',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'mutable',
  unit_index INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_canon_rules_project
  ON canon_rules(project_id, active, category);

CREATE TABLE IF NOT EXISTS override_budget (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  unit_index INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  max_overrides INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, unit_index)
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  unit_index INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  workspace_ref TEXT,
  beat_json TEXT,
  critic_json TEXT,
  governor_decision TEXT,
  governor_memo TEXT,
  revision_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_project
  ON pipeline_runs(project_id, unit_index, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  unit_index INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'plot',
  fact TEXT NOT NULL,
  characters_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 1.0,
  source_scene TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_memory_facts_project
  ON memory_facts(project_id, unit_index);

CREATE TABLE IF NOT EXISTS narrative_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  unit_index INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, unit_index)
);

CREATE TABLE IF NOT EXISTS critic_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  unit_index INTEGER,
  workspace_ref TEXT,
  report_json TEXT NOT NULL,
  scoring_method TEXT NOT NULL DEFAULT 'rules',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_critic_reports_project
  ON critic_reports(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS voice_dnas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  avg_sentence REAL NOT NULL DEFAULT 0,
  question_ratio REAL NOT NULL DEFAULT 0,
  vocabulary_json TEXT NOT NULL DEFAULT '[]',
  forbidden_words_json TEXT NOT NULL DEFAULT '[]',
  catchphrases_json TEXT NOT NULL DEFAULT '[]',
  sample_dialogue TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  formality TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_voice_dnas_project
  ON voice_dnas(project_id);
`;

export const SCHEMA_AWR_V2 = `
CREATE TABLE IF NOT EXISTS voice_dnas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  avg_sentence REAL NOT NULL DEFAULT 0,
  question_ratio REAL NOT NULL DEFAULT 0,
  vocabulary_json TEXT NOT NULL DEFAULT '[]',
  forbidden_words_json TEXT NOT NULL DEFAULT '[]',
  catchphrases_json TEXT NOT NULL DEFAULT '[]',
  sample_dialogue TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  formality TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_voice_dnas_project
  ON voice_dnas(project_id);
`;

export const AWR_ENGINE_TABLES = [
  'canon_rules',
  'override_budget',
  'pipeline_runs',
  'memory_facts',
  'narrative_summaries',
  'critic_reports',
  'voice_dnas',
];
