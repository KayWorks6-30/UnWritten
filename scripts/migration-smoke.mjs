import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const db=new DatabaseSync(':memory:');
const read=name=>readFile(name,'utf8');

// Build an actual schema-6 database first, seed representative legacy rows, then
// apply the V3.4 schema-7 and V3.5 schema-8 migrations in order.
db.exec(await read('migrations/0001_initial.sql'));
db.exec(await read('migrations/0002_v3_workspace.sql'));

const stamp='2026-09-15T00:00:00.000Z';
const insertLegacyEntity=db.prepare('INSERT INTO entities (id,type,name,summary,status,tags_json,favorite,fields_json,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
insertLegacyEntity.run('book','book','Book','', 'Canon','[]',0,JSON.stringify({order:1}),'',stamp,stamp);
insertLegacyEntity.run('chapter','chapter','Legacy Chapter','', 'Canon','[]',0,JSON.stringify({parentBookId:'book',number:1}),'',stamp,stamp);
insertLegacyEntity.run('loc','location','City','', 'Canon','[]',0,'{}','',stamp,stamp);
insertLegacyEntity.run('char','character','Traveler','', 'Canon','[]',0,JSON.stringify({currentLocationId:'loc'}),'',stamp,stamp);
db.prepare('INSERT INTO relations (id,from_id,to_id,type,note,generated_parent,created_at,era_id,active_from,active_to,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  .run('rel','char','loc','located_in','',0,stamp,null,'','',stamp);

db.exec(await read('migrations/0003_v34_architecture_hardening.sql'));
db.exec(await read('migrations/0004_v35_architecture_stabilization.sql'));

const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
for(const table of ['entities','relations','settings','media','clues','reveals','knowledge','map_versions','map_markers','workspace','reference_index']){
  if(!tables.has(table)) throw new Error(`Migration smoke is missing table ${table}.`);
}
const views=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all().map(row=>row.name));
if(!views.has('narrative_positions')) throw new Error('Migration smoke is missing narrative_positions view.');

const relationColumns=new Set(db.prepare('PRAGMA table_xinfo(relations)').all().map(row=>row.name));
if(!relationColumns.has('status')) throw new Error('Relationship status column was not created.');
if(db.prepare("SELECT status FROM relations WHERE id='rel'").get()?.status!=='Canon') throw new Error('Legacy relationships were not migrated to implicit Canon status.');

const revealColumns=new Set(db.prepare('PRAGMA table_xinfo(reveals)').all().map(row=>row.name));
if(!revealColumns.has('part_id')) throw new Error('Reveal part_id column was not created.');

const entityColumns=new Set(db.prepare('PRAGMA table_xinfo(entities)').all().map(row=>row.name));
for(const column of [
  'parent_location_id','parent_map_id','parent_book_id','parent_part_id','parent_chapter_id',
  'story_order_value','story_date_sort_value','date_start_value','date_end_value',
  'exists_from_value','exists_to_value','birth_sort_value','death_sort_value','revival_sort_value',
  'current_location_id','creator_entity_id','current_owner_entity_id'
]) if(!entityColumns.has(column)) throw new Error(`Queryable entity column ${column} was not created.`);

for(const [table,column] of [['settings','updated_at'],['media','updated_at'],['map_versions','updated_at']]){
  const columns=new Set(db.prepare(`PRAGMA table_xinfo(${table})`).all().map(row=>row.name));
  if(!columns.has(column)) throw new Error(`${table}.${column} was not created by schema 8.`);
}

const indexes=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(row=>row.name));
for(const index of [
  'idx_entities_parent_book','idx_entities_parent_part','idx_entities_story_order','idx_entities_story_date',
  'idx_entities_event_dates','idx_entities_location_existence','idx_entities_character_lifespan',
  'idx_relations_status','idx_reference_target','idx_reference_source','idx_entities_name_nocase',
  'idx_entities_type_status_archived','idx_knowledge_story','idx_reveals_story'
]) if(!indexes.has(index)) throw new Error(`Expected hardening index ${index} was not created.`);

// Migration seeding must discover references that existed before schema 7.
if(!db.prepare("SELECT 1 AS ok FROM reference_index WHERE source_store='entities' AND source_id='char' AND source_field='currentLocationId' AND target_entity_id='loc'").get()) throw new Error('Legacy entity references were not seeded into reference_index.');
if(!db.prepare("SELECT 1 AS ok FROM reference_index WHERE source_store='relations' AND source_id='rel' AND target_entity_id='loc'").get()) throw new Error('Legacy relationship references were not seeded into reference_index.');

// Add the optional Part layer and prove both Part and direct-Chapter paths resolve.
insertLegacyEntity.run('part','part','Part I','', 'Canon','[]',0,JSON.stringify({parentBookId:'book',order:1}),'',stamp,stamp);
insertLegacyEntity.run('chapter2','chapter','Chapter 2','', 'Canon','[]',0,JSON.stringify({parentBookId:'book',parentPartId:'part',number:2}),'',stamp,stamp);
insertLegacyEntity.run('scene','scene','Scene 1','', 'Canon','[]',0,JSON.stringify({parentChapterId:'chapter2',order:1}),'',stamp,stamp);
const position=db.prepare("SELECT * FROM narrative_positions WHERE entity_id='scene'").get();
if(position.book_id!=='book'||position.part_id!=='part'||position.chapter_id!=='chapter2'||position.scene_id!=='scene') throw new Error('Narrative position view did not resolve Book → Part → Chapter → Scene.');
const direct=db.prepare("SELECT * FROM narrative_positions WHERE entity_id='chapter'").get();
if(direct.book_id!=='book'||direct.part_id!==null||direct.chapter_id!=='chapter') throw new Error('Narrative position view did not preserve direct Book → Chapter hierarchy.');

// DB-level trigger safety must reject dangling normalized references even if an API bug
// ever bypasses the domain validator.
let rejected=false;
try{
  db.prepare('INSERT INTO relations (id,from_id,to_id,type,status,note,generated_parent,created_at,era_id,active_from,active_to,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('bad-rel','missing','loc','related_to','Canon','',0,stamp,null,'','',stamp);
}catch{ rejected=true; }
if(!rejected) throw new Error('Schema-8 relation trigger failed to reject a dangling endpoint.');

const integrity=db.prepare('PRAGMA integrity_check').get();
if(integrity.integrity_check!=='ok') throw new Error(`SQLite integrity check failed: ${integrity.integrity_check}`);
console.log(`Migration smoke passed: schema 6 → 8 upgrade, ${tables.size} tables + narrative_positions view, reverse-index seed, concurrency columns, DB safety triggers, and SQLite integrity ok.`);
