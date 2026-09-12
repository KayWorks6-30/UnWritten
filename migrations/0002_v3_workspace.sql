PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspace_kind ON workspace(kind);
CREATE INDEX IF NOT EXISTS idx_workspace_updated_at ON workspace(updated_at);

ALTER TABLE map_markers ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE map_markers ADD COLUMN icon TEXT NOT NULL DEFAULT '';
ALTER TABLE map_markers ADD COLUMN custom_media_id TEXT;
ALTER TABLE map_markers ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE map_markers ADD COLUMN active_from TEXT NOT NULL DEFAULT '';
ALTER TABLE map_markers ADD COLUMN active_to TEXT NOT NULL DEFAULT '';
ALTER TABLE map_markers ADD COLUMN layer_id TEXT;
ALTER TABLE map_markers ADD COLUMN faction_id TEXT;
ALTER TABLE map_markers ADD COLUMN book_ids_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE map_markers ADD COLUMN story_relevance TEXT NOT NULL DEFAULT '';
ALTER TABLE map_markers ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE map_markers ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

ALTER TABLE relations ADD COLUMN era_id TEXT;
ALTER TABLE relations ADD COLUMN active_from TEXT NOT NULL DEFAULT '';
ALTER TABLE relations ADD COLUMN active_to TEXT NOT NULL DEFAULT '';
ALTER TABLE relations ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_relations_era ON relations(era_id);

ALTER TABLE clues ADD COLUMN mystery_ids_json TEXT NOT NULL DEFAULT '[]';
