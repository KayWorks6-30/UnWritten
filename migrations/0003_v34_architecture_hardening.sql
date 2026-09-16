PRAGMA foreign_keys = ON;

-- Hot/queryable values remain canonically stored in fields_json. Generated columns expose
-- the small subset that UnWritten repeatedly filters, joins, validates, or orders by.
ALTER TABLE entities ADD COLUMN parent_location_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.parentLocationId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN parent_map_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.parentMapId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN parent_book_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.parentBookId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN parent_part_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.parentPartId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN parent_chapter_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.parentChapterId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN era_ref_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.eraId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN location_ref_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.locationId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN scope_location_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.scopeLocationId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN story_entity_ref_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.storyEntityId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN homeland_location_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.homelandLocationId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN current_location_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.currentLocationId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN headquarters_location_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.headquartersLocationId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN creator_entity_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.creatorId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN original_owner_entity_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.originalOwnerId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN current_owner_entity_id TEXT GENERATED ALWAYS AS (json_extract(fields_json,'$.currentOwnerId')) VIRTUAL;
ALTER TABLE entities ADD COLUMN story_order_value REAL GENERATED ALWAYS AS (CASE WHEN type IN ('book','part','scene') THEN CAST(json_extract(fields_json,'$.order') AS REAL) WHEN type='chapter' THEN CAST(json_extract(fields_json,'$.number') AS REAL) END) VIRTUAL;
ALTER TABLE entities ADD COLUMN story_date_sort_value REAL GENERATED ALWAYS AS (CAST(json_extract(fields_json,'$.storyDateSort') AS REAL)) VIRTUAL;
ALTER TABLE entities ADD COLUMN date_start_value REAL GENERATED ALWAYS AS (CAST(json_extract(fields_json,'$.dateStart') AS REAL)) VIRTUAL;
ALTER TABLE entities ADD COLUMN date_end_value REAL GENERATED ALWAYS AS (CAST(json_extract(fields_json,'$.dateEnd') AS REAL)) VIRTUAL;
ALTER TABLE entities ADD COLUMN exists_from_value REAL GENERATED ALWAYS AS (CAST(json_extract(fields_json,'$.existsFrom') AS REAL)) VIRTUAL;
ALTER TABLE entities ADD COLUMN exists_to_value REAL GENERATED ALWAYS AS (CAST(json_extract(fields_json,'$.existsTo') AS REAL)) VIRTUAL;
ALTER TABLE entities ADD COLUMN birth_sort_value REAL GENERATED ALWAYS AS (CAST(json_extract(fields_json,'$.birthSort') AS REAL)) VIRTUAL;
ALTER TABLE entities ADD COLUMN death_sort_value REAL GENERATED ALWAYS AS (CAST(json_extract(fields_json,'$.deathSort') AS REAL)) VIRTUAL;
ALTER TABLE entities ADD COLUMN revival_sort_value REAL GENERATED ALWAYS AS (CAST(json_extract(fields_json,'$.revivalSort') AS REAL)) VIRTUAL;

CREATE INDEX IF NOT EXISTS idx_entities_parent_location ON entities(parent_location_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent_map ON entities(parent_map_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent_book ON entities(parent_book_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent_part ON entities(parent_part_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent_chapter ON entities(parent_chapter_id);
CREATE INDEX IF NOT EXISTS idx_entities_era_ref ON entities(era_ref_id);
CREATE INDEX IF NOT EXISTS idx_entities_location_ref ON entities(location_ref_id);
CREATE INDEX IF NOT EXISTS idx_entities_story_ref ON entities(story_entity_ref_id);
CREATE INDEX IF NOT EXISTS idx_entities_scope_location ON entities(scope_location_id);
CREATE INDEX IF NOT EXISTS idx_entities_homeland_location ON entities(homeland_location_id);
CREATE INDEX IF NOT EXISTS idx_entities_current_location ON entities(current_location_id);
CREATE INDEX IF NOT EXISTS idx_entities_headquarters_location ON entities(headquarters_location_id);
CREATE INDEX IF NOT EXISTS idx_entities_creator ON entities(creator_entity_id);
CREATE INDEX IF NOT EXISTS idx_entities_original_owner ON entities(original_owner_entity_id);
CREATE INDEX IF NOT EXISTS idx_entities_current_owner ON entities(current_owner_entity_id);
CREATE INDEX IF NOT EXISTS idx_entities_story_order ON entities(type,story_order_value);
CREATE INDEX IF NOT EXISTS idx_entities_story_date ON entities(type,story_date_sort_value);
CREATE INDEX IF NOT EXISTS idx_entities_event_dates ON entities(type,date_start_value,date_end_value);
CREATE INDEX IF NOT EXISTS idx_entities_location_existence ON entities(type,exists_from_value,exists_to_value);
CREATE INDEX IF NOT EXISTS idx_entities_character_lifespan ON entities(type,birth_sort_value,death_sort_value,revival_sort_value);

-- Relationships are claims in their own right. Existing rows were implicitly canonical.
ALTER TABLE relations ADD COLUMN status TEXT NOT NULL DEFAULT 'Canon';
CREATE INDEX IF NOT EXISTS idx_relations_status ON relations(status);

-- A reveal may anchor at the optional Part layer as well as Book/Chapter/Scene.
ALTER TABLE reveals ADD COLUMN part_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reveals_part ON reveals(part_id);

-- First-class, queryable narrative position without duplicating canonical story fields.
DROP VIEW IF EXISTS narrative_positions;
CREATE VIEW narrative_positions AS
SELECT
  e.id AS entity_id,
  e.type AS entity_type,
  CASE
    WHEN e.type='book' THEN e.id
    WHEN e.type='part' THEN e.parent_book_id
    WHEN e.type='chapter' THEN COALESCE(e.parent_book_id,p.parent_book_id)
    WHEN e.type='scene' THEN COALESCE(ch.parent_book_id,p.parent_book_id)
  END AS book_id,
  CASE
    WHEN e.type='part' THEN e.id
    WHEN e.type='chapter' THEN e.parent_part_id
    WHEN e.type='scene' THEN ch.parent_part_id
  END AS part_id,
  CASE WHEN e.type='chapter' THEN e.id WHEN e.type='scene' THEN e.parent_chapter_id END AS chapter_id,
  CASE WHEN e.type='scene' THEN e.id END AS scene_id,
  COALESCE(b.story_order_value,CASE WHEN e.type='book' THEN e.story_order_value END,999999999) AS book_order,
  CASE WHEN p.id IS NULL THEN 0 ELSE COALESCE(p.story_order_value,999999999) END AS part_order,
  CASE WHEN e.type='chapter' THEN COALESCE(e.story_order_value,999999999) WHEN e.type='scene' THEN COALESCE(ch.story_order_value,999999999) ELSE -1 END AS chapter_order,
  CASE WHEN e.type='scene' THEN COALESCE(e.story_order_value,999999999) ELSE -1 END AS scene_order,
  CASE e.type WHEN 'book' THEN 0 WHEN 'part' THEN 1 WHEN 'chapter' THEN 2 WHEN 'scene' THEN 3 ELSE 9 END AS level_rank
FROM entities e
LEFT JOIN entities ch ON ch.id=e.parent_chapter_id
LEFT JOIN entities p ON p.id=CASE WHEN e.type='part' THEN e.id WHEN e.type='chapter' THEN e.parent_part_id WHEN e.type='scene' THEN ch.parent_part_id END
LEFT JOIN entities b ON b.id=CASE WHEN e.type='book' THEN e.id WHEN e.type='part' THEN e.parent_book_id WHEN e.type='chapter' THEN COALESCE(e.parent_book_id,p.parent_book_id) WHEN e.type='scene' THEN COALESCE(ch.parent_book_id,p.parent_book_id) END
WHERE e.type IN ('book','part','chapter','scene');

-- Materialized reverse-reference index. This is derived data and is intentionally excluded
-- from backups; all mutation paths keep it in sync and restore can rebuild it completely.
CREATE TABLE IF NOT EXISTS reference_index (
  source_store TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_field TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  source_entity_id TEXT,
  kind TEXT NOT NULL DEFAULT 'Structured reference',
  PRIMARY KEY (source_store,source_id,source_field,target_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_reference_target ON reference_index(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_reference_source ON reference_index(source_store,source_id);
CREATE INDEX IF NOT EXISTS idx_reference_source_entity ON reference_index(source_entity_id);

-- Seed the reverse index for data that predates this migration.
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'parentLocationId',parent_location_id,id,'Parent location' FROM entities WHERE parent_location_id IS NOT NULL AND parent_location_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'parentMapId',parent_map_id,id,'Parent map' FROM entities WHERE parent_map_id IS NOT NULL AND parent_map_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'parentBookId',parent_book_id,id,'Parent book' FROM entities WHERE parent_book_id IS NOT NULL AND parent_book_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'parentPartId',parent_part_id,id,'Parent part' FROM entities WHERE parent_part_id IS NOT NULL AND parent_part_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'parentChapterId',parent_chapter_id,id,'Parent chapter' FROM entities WHERE parent_chapter_id IS NOT NULL AND parent_chapter_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'eraId',era_ref_id,id,'Era' FROM entities WHERE era_ref_id IS NOT NULL AND era_ref_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'locationId',location_ref_id,id,'Location' FROM entities WHERE location_ref_id IS NOT NULL AND location_ref_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'scopeLocationId',scope_location_id,id,'Map scope' FROM entities WHERE scope_location_id IS NOT NULL AND scope_location_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'storyEntityId',story_entity_ref_id,id,'Story point' FROM entities WHERE story_entity_ref_id IS NOT NULL AND story_entity_ref_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'homelandLocationId',homeland_location_id,id,'Homeland' FROM entities WHERE homeland_location_id IS NOT NULL AND homeland_location_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'currentLocationId',current_location_id,id,'Current location' FROM entities WHERE current_location_id IS NOT NULL AND current_location_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'headquartersLocationId',headquarters_location_id,id,'Headquarters' FROM entities WHERE headquarters_location_id IS NOT NULL AND headquarters_location_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'creatorId',creator_entity_id,id,'Creator' FROM entities WHERE creator_entity_id IS NOT NULL AND creator_entity_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'originalOwnerId',original_owner_entity_id,id,'Original owner' FROM entities WHERE original_owner_entity_id IS NOT NULL AND original_owner_entity_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',id,'currentOwnerId',current_owner_entity_id,id,'Current owner' FROM entities WHERE current_owner_entity_id IS NOT NULL AND current_owner_entity_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'entities',e.id,'protagonistIds',j.value,e.id,'Series protagonist' FROM entities e,json_each(e.fields_json,'$.protagonistIds') j WHERE e.type='trilogy' AND j.value IS NOT NULL;

INSERT OR IGNORE INTO reference_index SELECT 'relations',id,'fromId',from_id,to_id,'Relationship' FROM relations;
INSERT OR IGNORE INTO reference_index SELECT 'relations',id,'toId',to_id,from_id,'Relationship' FROM relations;
INSERT OR IGNORE INTO reference_index SELECT 'relations',id,'eraId',era_id,from_id,'Relationship era' FROM relations WHERE era_id IS NOT NULL AND era_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'media',m.id,'entityIds',j.value,NULL,'Media attachment' FROM media m,json_each(m.entity_ids_json) j WHERE j.value IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'clues',id,'mysteryId',mystery_id,mystery_id,'Clue' FROM clues WHERE mystery_id IS NOT NULL AND mystery_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'clues',id,'storyEntityId',story_entity_id,mystery_id,'Clue story point' FROM clues WHERE story_entity_id IS NOT NULL AND story_entity_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'clues',c.id,'mysteryIds',j.value,c.mystery_id,'Clue' FROM clues c,json_each(c.mystery_ids_json) j WHERE j.value IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'reveals',id,'mysteryId',mystery_id,COALESCE(target_entity_id,mystery_id),'Reveal' FROM reveals WHERE mystery_id IS NOT NULL AND mystery_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'reveals',id,'targetEntityId',target_entity_id,COALESCE(target_entity_id,mystery_id),'Reveal' FROM reveals WHERE target_entity_id IS NOT NULL AND target_entity_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'reveals',id,'bookId',book_id,COALESCE(target_entity_id,mystery_id),'Reveal' FROM reveals WHERE book_id IS NOT NULL AND book_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'reveals',id,'partId',part_id,COALESCE(target_entity_id,mystery_id),'Reveal' FROM reveals WHERE part_id IS NOT NULL AND part_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'reveals',id,'chapterId',chapter_id,COALESCE(target_entity_id,mystery_id),'Reveal' FROM reveals WHERE chapter_id IS NOT NULL AND chapter_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'reveals',id,'sceneId',scene_id,COALESCE(target_entity_id,mystery_id),'Reveal' FROM reveals WHERE scene_id IS NOT NULL AND scene_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'knowledge',id,'subjectEntityId',subject_entity_id,subject_entity_id,'Knowledge' FROM knowledge;
INSERT OR IGNORE INTO reference_index SELECT 'knowledge',id,'knowerEntityId',knower_entity_id,subject_entity_id,'Knowledge knower' FROM knowledge WHERE knower_entity_id IS NOT NULL AND knower_entity_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'knowledge',id,'storyEntityId',story_entity_id,subject_entity_id,'Knowledge story point' FROM knowledge WHERE story_entity_id IS NOT NULL AND story_entity_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'mapVersions',id,'mapId',map_id,map_id,'Map version' FROM map_versions;
INSERT OR IGNORE INTO reference_index SELECT 'mapMarkers',id,'locationId',location_id,location_id,'Map marker' FROM map_markers;
INSERT OR IGNORE INTO reference_index SELECT 'mapMarkers',id,'factionId',faction_id,location_id,'Map marker faction' FROM map_markers WHERE faction_id IS NOT NULL AND faction_id<>'';
INSERT OR IGNORE INTO reference_index SELECT 'mapMarkers',m.id,'bookIds',j.value,m.location_id,'Map marker book' FROM map_markers m,json_each(m.book_ids_json) j WHERE j.value IS NOT NULL;

INSERT OR IGNORE INTO reference_index SELECT 'workspace',id,'targetId',json_extract(data_json,'$.targetId'),COALESCE(json_extract(data_json,'$.linkedEntityId'),json_extract(data_json,'$.entityId'),json_extract(data_json,'$.characterId'),json_extract(data_json,'$.sceneId')),'Workspace' FROM workspace WHERE kind<>'revision' AND json_extract(data_json,'$.targetId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'workspace',id,'sceneId',json_extract(data_json,'$.sceneId'),COALESCE(json_extract(data_json,'$.linkedEntityId'),json_extract(data_json,'$.entityId'),json_extract(data_json,'$.characterId'),json_extract(data_json,'$.sceneId')),'Workspace' FROM workspace WHERE kind<>'revision' AND json_extract(data_json,'$.sceneId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'workspace',id,'linkedEntityId',json_extract(data_json,'$.linkedEntityId'),json_extract(data_json,'$.linkedEntityId'),'Workspace' FROM workspace WHERE kind<>'revision' AND json_extract(data_json,'$.linkedEntityId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'workspace',id,'entityId',json_extract(data_json,'$.entityId'),json_extract(data_json,'$.entityId'),'Workspace' FROM workspace WHERE kind<>'revision' AND json_extract(data_json,'$.entityId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'workspace',id,'characterId',json_extract(data_json,'$.characterId'),json_extract(data_json,'$.characterId'),'Workspace' FROM workspace WHERE kind<>'revision' AND json_extract(data_json,'$.characterId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'workspace',id,'bookId',json_extract(data_json,'$.bookId'),COALESCE(json_extract(data_json,'$.entityId'),json_extract(data_json,'$.characterId')),'Workspace' FROM workspace WHERE kind<>'revision' AND json_extract(data_json,'$.bookId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'workspace',id,'partId',json_extract(data_json,'$.partId'),COALESCE(json_extract(data_json,'$.entityId'),json_extract(data_json,'$.characterId')),'Workspace' FROM workspace WHERE kind<>'revision' AND json_extract(data_json,'$.partId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'workspace',id,'chapterId',json_extract(data_json,'$.chapterId'),COALESCE(json_extract(data_json,'$.entityId'),json_extract(data_json,'$.characterId')),'Workspace' FROM workspace WHERE kind<>'revision' AND json_extract(data_json,'$.chapterId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'workspace',id,'pointId',json_extract(data_json,'$.pointId'),NULL,'Workspace' FROM workspace WHERE kind<>'revision' AND json_extract(data_json,'$.pointId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'settings',key,'currentBookId',json_extract(value_json,'$.currentBookId'),NULL,'Project setting' FROM settings WHERE key='project' AND json_extract(value_json,'$.currentBookId') IS NOT NULL;
INSERT OR IGNORE INTO reference_index SELECT 'settings',s.key,'storyCompass.protagonistIds',j.value,NULL,'Project setting' FROM settings s,json_each(s.value_json,'$.storyCompass.protagonistIds') j WHERE s.key='project' AND j.value IS NOT NULL;
