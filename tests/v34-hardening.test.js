import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  APP_VERSION, SCHEMA_VERSION, ENTRY_TYPES, RELATION_STATUSES,
  STORY_POINT_TYPES, SEMANTIC_TEXT_REFERENCE_PAIRS, createEmptyEntity
} from '../js/domain/schema.js';
import { narrativePosition, storyPath } from '../js/domain/story.js';
import { relationIsProjectable, relationEndpointsProjectable, relationMatchesFilters } from '../js/domain/relations.js';
import { neighborhood } from '../js/domain/graphs.js';
import { referenceEdgesForRecord, buildReferenceIndex } from '../js/domain/references.js';
import { migrateBackupData } from '../js/data/migrations.js';
import { validateBackupSnapshot } from '../js/data/validation.js';
import { continuityWarnings, sceneContinuity } from '../js/domain/intelligence.js';

const stamp='2026-09-15T00:00:00.000Z';
function entity(type,id,name,fields={},status='Canon'){
  return {...createEmptyEntity(type),id,name,status,fields,createdAt:stamp,updatedAt:stamp};
}
function backup(entities=[]){
  return {
    format:'kayworks-world-bible-backup',schemaVersion:SCHEMA_VERSION,
    entities,relations:[],media:[],settings:[],clues:[],reveals:[],knowledge:[],mapVersions:[],mapMarkers:[],workspace:[]
  };
}

test('V3.4 hardening remains intact in V3.5 and optional Part story points remain first-class',()=>{
  assert.equal(APP_VERSION,'3.5.1');
  assert.equal(SCHEMA_VERSION,8);
  assert.ok(ENTRY_TYPES.part);
  assert.ok(ENTRY_TYPES.chapter.fields.some(f=>f.key==='parentPartId'&&f.entityTypes?.includes('part')));
  assert.deepEqual(STORY_POINT_TYPES,['book','part','chapter','scene']);
  assert.deepEqual(RELATION_STATUSES,['Canon','Provisional','Concept','Contradicted','Shelved','Unknown']);
});

test('narrative position is first-class across Book → Part → Chapter → Scene while direct chapters remain valid',()=>{
  const book=entity('book','b','Book',{order:2});
  const part=entity('part','p','Part',{parentBookId:'b',order:3});
  const chapter=entity('chapter','c','Chapter',{parentBookId:'b',parentPartId:'p',number:4});
  const scene=entity('scene','s','Scene',{parentChapterId:'c',order:5});
  const direct=entity('chapter','d','Direct chapter',{parentBookId:'b',number:1});
  const entities=[book,part,chapter,scene,direct];
  const position=narrativePosition(scene,entities);
  assert.equal(position.bookId,'b');
  assert.equal(position.partId,'p');
  assert.equal(position.chapterId,'c');
  assert.equal(position.sceneId,'s');
  assert.deepEqual(position.tuple,[2,3,4,5,3]);
  assert.equal(storyPath(scene,entities),'Book → Part → Chapter → Scene');
  assert.deepEqual(narrativePosition(direct,entities).tuple,[2,0,1,-1,2]);
});

test('restore validation rejects a Chapter whose selected Part belongs to another Book',()=>{
  const b1=entity('book','b1','One',{order:1});
  const b2=entity('book','b2','Two',{order:2});
  const part=entity('part','p','Part',{parentBookId:'b1',order:1});
  const chapter=entity('chapter','c','Chapter',{parentBookId:'b2',parentPartId:'p',number:1});
  const errors=validateBackupSnapshot(backup([b1,b2,part,chapter]));
  assert.ok(errors.some(e=>/parentPartId belongs to a different book/i.test(e)));
});

test('legacy relationships migrate to Canon and invalid relationship status is rejected',()=>{
  const a=entity('character','a','A'), b=entity('character','b','B');
  const old={...backup([a,b]),schemaVersion:6,relations:[{id:'r',fromId:'a',toId:'b',type:'friend_of',createdAt:stamp}]};
  const migrated=migrateBackupData(old);
  assert.equal(migrated.relations[0].status,'Canon');
  migrated.relations[0].status='Impossible';
  assert.ok(validateBackupSnapshot(migrated).some(e=>/invalid status/i.test(e)));
});

test('derived graph projections exclude blocked entity endpoints by default while explicit relation status filters still work',()=>{
  const a=entity('character','a','A');
  const b=entity('character','b','B',{},'Contradicted');
  const c=entity('character','c','C');
  const canon={id:'r1',fromId:'a',toId:'b',type:'friend_of',status:'Canon'};
  const concept={id:'r2',fromId:'a',toId:'c',type:'friend_of',status:'Concept'};
  const entities=[a,b,c];
  assert.equal(relationEndpointsProjectable(canon,entities),false);
  assert.equal(relationIsProjectable(canon,entities),false);
  assert.equal(relationMatchesFilters(concept,{statuses:['Concept']}),true);
  const graph=neighborhood('a',[canon,concept],1,{entities,statuses:['Canon','Concept']});
  assert.deepEqual(new Set(graph.ids),new Set(['a','c']));
});

test('semantic legacy text is audited and structured references are indexed instead of prose-scanned',()=>{
  assert.ok(SEMANTIC_TEXT_REFERENCE_PAIRS.artifact.some(([textKey,refKey])=>textKey==='creator'&&refKey==='creatorId'));
  const creator=entity('character','maker','Maker');
  const artifact=entity('artifact','artifact','Relic',{creator:'Maker'});
  const warnings=continuityWarnings({entities:[creator,artifact],relations:[],knowledge:[],clues:[],reveals:[]});
  assert.ok(warnings.some(w=>w.code==='legacy-semantic-text'&&w.entityId==='artifact'));
  artifact.fields.creatorId='maker';
  const edges=referenceEdgesForRecord('entities',artifact);
  assert.ok(edges.some(e=>e.sourceField==='creatorId'&&e.targetEntityId==='maker'));
});

test('reverse reference index covers canonical stores and remains derived data',()=>{
  const location=entity('location','loc','City');
  const character=entity('character','char','Traveler',{currentLocationId:'loc'});
  const relation={id:'rel',fromId:'char',toId:'loc',type:'located_in',status:'Canon'};
  const knowledge={id:'k',subjectEntityId:'loc',knowerKind:'character',knowerEntityId:'char',state:'Knows truth',storyEntityId:null};
  const workspace={id:'w',kind:'contextNote',title:'Note',data:{targetId:'loc'}};
  const refs=buildReferenceIndex({entities:[location,character],relations:[relation],knowledge:[knowledge],workspace:[workspace]});
  assert.ok(refs.some(r=>r.sourceStore==='entities'&&r.sourceId==='char'&&r.targetEntityId==='loc'));
  assert.ok(refs.some(r=>r.sourceStore==='relations'&&r.sourceId==='rel'&&r.targetEntityId==='loc'));
  assert.ok(refs.some(r=>r.sourceStore==='knowledge'&&r.sourceId==='k'&&r.targetEntityId==='loc'));
  assert.ok(refs.some(r=>r.sourceStore==='workspace'&&r.sourceId==='w'&&r.targetEntityId==='loc'));
});

test('Part is valid for Reveal/Knowledge/Reader Profile and reveal hierarchy is validated',()=>{
  const book=entity('book','b','Book',{order:1});
  const part=entity('part','p','Part',{parentBookId:'b',order:1});
  const chapter=entity('chapter','c','Chapter',{parentBookId:'b',parentPartId:'p',number:1});
  const scene=entity('scene','s','Scene',{parentChapterId:'c',order:1});
  const mystery=entity('mystery','m','Mystery');
  const subject=entity('lore','l','Truth');
  const data=backup([book,part,chapter,scene,mystery,subject]);
  data.reveals=[{id:'r',title:'Reveal',mysteryId:'m',targetEntityId:'l',bookId:'b',partId:'p',chapterId:'c',sceneId:'s',createdAt:stamp,updatedAt:stamp}];
  data.knowledge=[{id:'k',subjectEntityId:'l',knowerKind:'reader',knowerEntityId:null,state:'Knows truth',storyEntityId:'p',createdAt:stamp,updatedAt:stamp}];
  data.workspace=[{id:'rp',kind:'readerProfile',title:'Reader',data:{pointId:'p'},createdAt:stamp,updatedAt:stamp}];
  assert.deepEqual(validateBackupSnapshot(data),[]);
  data.reveals[0].bookId='missing';
  assert.ok(validateBackupSnapshot(data).some(e=>/bookId points to missing entity/i.test(e)));
});

test('scene continuity computes scene-scoped warnings without requiring a whole-project continuity pass',()=>{
  const book=entity('book','b','Book',{order:1});
  const chapter=entity('chapter','c','Chapter',{parentBookId:'b',number:1});
  const scene=entity('scene','s','Scene',{parentChapterId:'c',order:1,storyDateSort:5});
  const character=entity('character','char','Traveler',{birthSort:10});
  const result=sceneContinuity('s',{entities:[book,chapter,scene,character],relations:[{id:'r',fromId:'char',toId:'s',type:'appears_in',status:'Canon'}],knowledge:[],clues:[],reveals:[],workspace:[]});
  assert.ok(result.warnings.some(w=>w.code==='character-before-birth'));
});

test('architecture migration exposes hot JSON fields, narrative view, relation state, reveal Part, and reverse index',async()=>{
  const sql=await readFile(new URL('../migrations/0003_v34_architecture_hardening.sql',import.meta.url),'utf8');
  for(const fragment of ['parent_part_id','story_order_value','narrative_positions','ALTER TABLE relations ADD COLUMN status','ALTER TABLE reveals ADD COLUMN part_id','CREATE TABLE IF NOT EXISTS reference_index']) assert.match(sql,new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('Worker maintains reverse index transactionally and exposes indexed impact lookup',async()=>{
  const worker=await readFile(new URL('../worker/index.js',import.meta.url),'utf8');
  assert.match(worker,/DELETE FROM reference_index WHERE source_store=\? AND source_id=\?/);
  assert.match(worker,/\/api\\\/entities\\\/\(\[\^\/\]\+\)\\\/impact/);
  assert.match(worker,/SELECT source_store,source_id,source_field,target_entity_id,source_entity_id,kind FROM reference_index WHERE target_entity_id=\?/);
});
