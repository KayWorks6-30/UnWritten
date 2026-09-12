PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  favorite INTEGER NOT NULL DEFAULT 0,
  fields_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);
CREATE INDEX IF NOT EXISTS idx_entities_updated_at ON entities(updated_at);

CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  generated_parent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id);
CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  entity_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at);

CREATE TABLE IF NOT EXISTS clues (
  id TEXT PRIMARY KEY,
  mystery_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  story_entity_id TEXT,
  visibility TEXT NOT NULL DEFAULT '',
  first_read TEXT NOT NULL DEFAULT '',
  true_interpretation TEXT NOT NULL DEFAULT '',
  order_value TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clues_mystery ON clues(mystery_id);
CREATE INDEX IF NOT EXISTS idx_clues_story ON clues(story_entity_id);

CREATE TABLE IF NOT EXISTS reveals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  reader_knowledge TEXT NOT NULL DEFAULT '',
  mystery_id TEXT,
  target_entity_id TEXT,
  book_id TEXT,
  chapter_id TEXT,
  scene_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reveals_mystery ON reveals(mystery_id);
CREATE INDEX IF NOT EXISTS idx_reveals_target ON reveals(target_entity_id);

CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  subject_entity_id TEXT NOT NULL,
  knower_kind TEXT NOT NULL,
  knower_entity_id TEXT,
  state TEXT NOT NULL,
  belief TEXT NOT NULL DEFAULT '',
  truth_note TEXT NOT NULL DEFAULT '',
  story_entity_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_subject ON knowledge(subject_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_knower ON knowledge(knower_entity_id);

CREATE TABLE IF NOT EXISTS map_versions (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT '',
  effective_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_map_versions_map ON map_versions(map_id);

CREATE TABLE IF NOT EXISTS map_markers (
  id TEXT PRIMARY KEY,
  map_version_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_map_markers_version ON map_markers(map_version_id);
CREATE INDEX IF NOT EXISTS idx_map_markers_location ON map_markers(location_id);
