PRAGMA foreign_keys = ON;

-- V3.5 gives every mutable top-level record a server-visible revision timestamp so the
-- same optimistic-concurrency contract can protect more than Entity rows.
ALTER TABLE settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE map_versions ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

UPDATE settings SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updated_at='';
UPDATE media SET updated_at = created_at WHERE updated_at='';
UPDATE map_versions SET updated_at = created_at WHERE updated_at='';

CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_media_updated_at ON media(updated_at);
CREATE INDEX IF NOT EXISTS idx_map_versions_updated_at ON map_versions(updated_at);
CREATE INDEX IF NOT EXISTS idx_entities_name_nocase ON entities(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_entities_type_status_archived ON entities(type,status,archived_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_story ON knowledge(story_entity_id);
CREATE INDEX IF NOT EXISTS idx_reveals_story ON reveals(book_id,part_id,chapter_id,scene_id);
CREATE INDEX IF NOT EXISTS idx_map_markers_faction ON map_markers(faction_id);

-- Structural safety nets. Domain/type rules still live in application validation, but
-- these triggers prevent dangling normalized references even if a future route forgets
-- to call that validation layer.
DROP TRIGGER IF EXISTS trg_relations_refs_insert;
CREATE TRIGGER trg_relations_refs_insert BEFORE INSERT ON relations BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.from_id) THEN RAISE(ABORT,'relation from_id does not exist') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.to_id) THEN RAISE(ABORT,'relation to_id does not exist') END;
  SELECT CASE WHEN NEW.era_id IS NOT NULL AND NEW.era_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.era_id) THEN RAISE(ABORT,'relation era_id does not exist') END;
END;
DROP TRIGGER IF EXISTS trg_relations_refs_update;
CREATE TRIGGER trg_relations_refs_update BEFORE UPDATE OF from_id,to_id,era_id ON relations BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.from_id) THEN RAISE(ABORT,'relation from_id does not exist') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.to_id) THEN RAISE(ABORT,'relation to_id does not exist') END;
  SELECT CASE WHEN NEW.era_id IS NOT NULL AND NEW.era_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.era_id) THEN RAISE(ABORT,'relation era_id does not exist') END;
END;

DROP TRIGGER IF EXISTS trg_clues_refs_insert;
CREATE TRIGGER trg_clues_refs_insert BEFORE INSERT ON clues BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.mystery_id) THEN RAISE(ABORT,'clue mystery_id does not exist') END;
  SELECT CASE WHEN NEW.story_entity_id IS NOT NULL AND NEW.story_entity_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.story_entity_id) THEN RAISE(ABORT,'clue story_entity_id does not exist') END;
END;
DROP TRIGGER IF EXISTS trg_clues_refs_update;
CREATE TRIGGER trg_clues_refs_update BEFORE UPDATE OF mystery_id,story_entity_id ON clues BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.mystery_id) THEN RAISE(ABORT,'clue mystery_id does not exist') END;
  SELECT CASE WHEN NEW.story_entity_id IS NOT NULL AND NEW.story_entity_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.story_entity_id) THEN RAISE(ABORT,'clue story_entity_id does not exist') END;
END;

DROP TRIGGER IF EXISTS trg_reveals_refs_insert;
CREATE TRIGGER trg_reveals_refs_insert BEFORE INSERT ON reveals BEGIN
  SELECT CASE WHEN NEW.mystery_id IS NOT NULL AND NEW.mystery_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.mystery_id) THEN RAISE(ABORT,'reveal mystery_id does not exist') END;
  SELECT CASE WHEN NEW.target_entity_id IS NOT NULL AND NEW.target_entity_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.target_entity_id) THEN RAISE(ABORT,'reveal target_entity_id does not exist') END;
  SELECT CASE WHEN NEW.book_id IS NOT NULL AND NEW.book_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.book_id) THEN RAISE(ABORT,'reveal book_id does not exist') END;
  SELECT CASE WHEN NEW.part_id IS NOT NULL AND NEW.part_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.part_id) THEN RAISE(ABORT,'reveal part_id does not exist') END;
  SELECT CASE WHEN NEW.chapter_id IS NOT NULL AND NEW.chapter_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.chapter_id) THEN RAISE(ABORT,'reveal chapter_id does not exist') END;
  SELECT CASE WHEN NEW.scene_id IS NOT NULL AND NEW.scene_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.scene_id) THEN RAISE(ABORT,'reveal scene_id does not exist') END;
END;
DROP TRIGGER IF EXISTS trg_reveals_refs_update;
CREATE TRIGGER trg_reveals_refs_update BEFORE UPDATE OF mystery_id,target_entity_id,book_id,part_id,chapter_id,scene_id ON reveals BEGIN
  SELECT CASE WHEN NEW.mystery_id IS NOT NULL AND NEW.mystery_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.mystery_id) THEN RAISE(ABORT,'reveal mystery_id does not exist') END;
  SELECT CASE WHEN NEW.target_entity_id IS NOT NULL AND NEW.target_entity_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.target_entity_id) THEN RAISE(ABORT,'reveal target_entity_id does not exist') END;
  SELECT CASE WHEN NEW.book_id IS NOT NULL AND NEW.book_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.book_id) THEN RAISE(ABORT,'reveal book_id does not exist') END;
  SELECT CASE WHEN NEW.part_id IS NOT NULL AND NEW.part_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.part_id) THEN RAISE(ABORT,'reveal part_id does not exist') END;
  SELECT CASE WHEN NEW.chapter_id IS NOT NULL AND NEW.chapter_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.chapter_id) THEN RAISE(ABORT,'reveal chapter_id does not exist') END;
  SELECT CASE WHEN NEW.scene_id IS NOT NULL AND NEW.scene_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.scene_id) THEN RAISE(ABORT,'reveal scene_id does not exist') END;
END;

DROP TRIGGER IF EXISTS trg_knowledge_refs_insert;
CREATE TRIGGER trg_knowledge_refs_insert BEFORE INSERT ON knowledge BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.subject_entity_id) THEN RAISE(ABORT,'knowledge subject_entity_id does not exist') END;
  SELECT CASE WHEN NEW.knower_entity_id IS NOT NULL AND NEW.knower_entity_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.knower_entity_id) THEN RAISE(ABORT,'knowledge knower_entity_id does not exist') END;
  SELECT CASE WHEN NEW.story_entity_id IS NOT NULL AND NEW.story_entity_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.story_entity_id) THEN RAISE(ABORT,'knowledge story_entity_id does not exist') END;
END;
DROP TRIGGER IF EXISTS trg_knowledge_refs_update;
CREATE TRIGGER trg_knowledge_refs_update BEFORE UPDATE OF subject_entity_id,knower_entity_id,story_entity_id ON knowledge BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.subject_entity_id) THEN RAISE(ABORT,'knowledge subject_entity_id does not exist') END;
  SELECT CASE WHEN NEW.knower_entity_id IS NOT NULL AND NEW.knower_entity_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.knower_entity_id) THEN RAISE(ABORT,'knowledge knower_entity_id does not exist') END;
  SELECT CASE WHEN NEW.story_entity_id IS NOT NULL AND NEW.story_entity_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.story_entity_id) THEN RAISE(ABORT,'knowledge story_entity_id does not exist') END;
END;

DROP TRIGGER IF EXISTS trg_map_versions_refs_insert;
CREATE TRIGGER trg_map_versions_refs_insert BEFORE INSERT ON map_versions BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.map_id) THEN RAISE(ABORT,'map version map_id does not exist') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM media WHERE id=NEW.media_id) THEN RAISE(ABORT,'map version media_id does not exist') END;
END;
DROP TRIGGER IF EXISTS trg_map_versions_refs_update;
CREATE TRIGGER trg_map_versions_refs_update BEFORE UPDATE OF map_id,media_id ON map_versions BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.map_id) THEN RAISE(ABORT,'map version map_id does not exist') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM media WHERE id=NEW.media_id) THEN RAISE(ABORT,'map version media_id does not exist') END;
END;

DROP TRIGGER IF EXISTS trg_map_markers_refs_insert;
CREATE TRIGGER trg_map_markers_refs_insert BEFORE INSERT ON map_markers BEGIN
  SELECT CASE WHEN NEW.x<0 OR NEW.x>100 OR NEW.y<0 OR NEW.y>100 THEN RAISE(ABORT,'map marker coordinates out of range') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM map_versions WHERE id=NEW.map_version_id) THEN RAISE(ABORT,'map marker map_version_id does not exist') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.location_id) THEN RAISE(ABORT,'map marker location_id does not exist') END;
  SELECT CASE WHEN NEW.custom_media_id IS NOT NULL AND NEW.custom_media_id<>'' AND NOT EXISTS(SELECT 1 FROM media WHERE id=NEW.custom_media_id) THEN RAISE(ABORT,'map marker custom_media_id does not exist') END;
  SELECT CASE WHEN NEW.faction_id IS NOT NULL AND NEW.faction_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.faction_id) THEN RAISE(ABORT,'map marker faction_id does not exist') END;
END;
DROP TRIGGER IF EXISTS trg_map_markers_refs_update;
CREATE TRIGGER trg_map_markers_refs_update BEFORE UPDATE OF map_version_id,location_id,x,y,custom_media_id,faction_id ON map_markers BEGIN
  SELECT CASE WHEN NEW.x<0 OR NEW.x>100 OR NEW.y<0 OR NEW.y>100 THEN RAISE(ABORT,'map marker coordinates out of range') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM map_versions WHERE id=NEW.map_version_id) THEN RAISE(ABORT,'map marker map_version_id does not exist') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.location_id) THEN RAISE(ABORT,'map marker location_id does not exist') END;
  SELECT CASE WHEN NEW.custom_media_id IS NOT NULL AND NEW.custom_media_id<>'' AND NOT EXISTS(SELECT 1 FROM media WHERE id=NEW.custom_media_id) THEN RAISE(ABORT,'map marker custom_media_id does not exist') END;
  SELECT CASE WHEN NEW.faction_id IS NOT NULL AND NEW.faction_id<>'' AND NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.faction_id) THEN RAISE(ABORT,'map marker faction_id does not exist') END;
END;
