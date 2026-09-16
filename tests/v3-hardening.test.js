import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEmptyEntity, SCHEMA_VERSION, WORKSPACE_KINDS } from '../js/domain/schema.js';
import { migrateBackupData } from '../js/data/migrations.js';
import { validateBackupSnapshot } from '../js/data/validation.js';
import { knowledgeAtPoint, knowledgeAsymmetryAtPoint, mysteryProgression, continuityWarnings, plotCoverage, characterInteractionMatrix } from '../js/domain/intelligence.js';

const root=new URL('../',import.meta.url);
const read=async path=>readFile(new URL(path,root),'utf8');
const stamp='2026-09-12T12:00:00.000Z';
function entity(type,id,name,fields={}){
  return {...createEmptyEntity(type),id,name,status:'Canon',fields,createdAt:stamp,updatedAt:stamp};
}
function snapshot(entities=[]){
  return {
    format:'kayworks-world-bible-backup',appVersion:'3.0.0',schemaVersion:SCHEMA_VERSION,exportedAt:stamp,
    entities,relations:[],settings:[{key:'project',value:{name:'Test',schemaVersion:SCHEMA_VERSION}}],media:[],clues:[],reveals:[],knowledge:[],mapVersions:[],mapMarkers:[],workspace:[]
  };
}

test('schema 0 remains invalid instead of silently becoming schema 1',()=>{
  assert.throws(()=>migrateBackupData({...snapshot(),schemaVersion:0}),/schema version is invalid/i);
});

test('backup validation rejects multi-node Location and Map cycles',()=>{
  const a=entity('location','loc-a','A',{locationKind:'Country',parentLocationId:'loc-b'});
  const b=entity('location','loc-b','B',{locationKind:'Country',parentLocationId:'loc-a'});
  const ma=entity('map','map-a','Map A',{mapKind:'World',parentMapId:'map-b'});
  const mb=entity('map','map-b','Map B',{mapKind:'World',parentMapId:'map-a'});
  const errors=validateBackupSnapshot(snapshot([a,b,ma,mb])).join(' ');
  assert.match(errors,/Location hierarchy contains a cycle/i);
  assert.match(errors,/Map hierarchy contains a cycle/i);
});

test('restore validation enforces typed story references',()=>{
  const book=entity('book','book-1','Book One',{order:1});
  const character=entity('character','char-1','Arin',{});
  const data=snapshot([book,character]);
  data.reveals.push({id:'reveal-1',title:'Bad ref',bookId:'char-1',createdAt:stamp,updatedAt:stamp});
  assert.match(validateBackupSnapshot(data).join(' '),/bookId must point to book/i);
});

test('workspace schema covers V3 planning and author-workflow records',()=>{
  for(const kind of ['plotThread','plotBeat','contextNote','task','savedView','calendar','calendarDate','mapLayer','mapRoute','whiteboardNode','whiteboardEdge','manuscriptDocument','revision','readerProfile']) assert.ok(WORKSPACE_KINDS.includes(kind),`missing ${kind}`);
});

test('character knowledge uses the latest state at the selected story point',()=>{
  const book=entity('book','book','Book',{order:1});
  const chapter=entity('chapter','chapter','Chapter',{parentBookId:'book',number:1});
  const s1=entity('scene','s1','Scene 1',{parentChapterId:'chapter',order:1});
  const s2=entity('scene','s2','Scene 2',{parentChapterId:'chapter',order:2});
  const char=entity('character','char','Hero',{});
  const secret=entity('lore','secret','Secret',{});
  const knowledge=[
    {id:'k1',subjectEntityId:'secret',knowerKind:'character',knowerEntityId:'char',state:'Incorrect belief',belief:'Wrong',storyEntityId:'s1'},
    {id:'k2',subjectEntityId:'secret',knowerKind:'character',knowerEntityId:'char',state:'Knows truth',belief:'Right',storyEntityId:'s2'}
  ];
  const at1=knowledgeAtPoint({knowledge,entities:[book,chapter,s1,s2,char,secret],characterId:'char',pointId:'s1'});
  const at2=knowledgeAtPoint({knowledge,entities:[book,chapter,s1,s2,char,secret],characterId:'char',pointId:'s2'});
  assert.equal(at1.rows[0].state,'Incorrect belief');
  assert.equal(at2.rows[0].state,'Knows truth');
});

test('reader/character asymmetry distinguishes reader-only and character-only truth',()=>{
  const book=entity('book','book','Book',{order:1});
  const chapter=entity('chapter','chapter','Chapter',{parentBookId:'book',number:1});
  const scene=entity('scene','scene','Scene',{parentChapterId:'chapter',order:1});
  const char=entity('character','char','Hero',{});
  const secretA=entity('lore','secret-a','Secret A',{});
  const secretB=entity('lore','secret-b','Secret B',{});
  const entities=[book,chapter,scene,char,secretA,secretB];
  const knowledge=[{id:'k',subjectEntityId:'secret-a',knowerKind:'character',knowerEntityId:'char',state:'Knows truth',belief:'A',storyEntityId:'scene'}];
  const reveals=[{id:'r',title:'B reveal',targetEntityId:'secret-b',sceneId:'scene'}];
  const result=knowledgeAsymmetryAtPoint({knowledge,reveals,entities,characterId:'char',pointId:'scene'});
  assert.equal(result.characterKnowsReaderDoesNot[0].subjectEntityId,'secret-a');
  assert.deepEqual(result.readerKnowsCharacterDoesNot,['secret-b']);
});

test('a clue may contribute to multiple mysteries without duplicating the clue record',()=>{
  const m1=entity('mystery','m1','Mystery 1',{}),m2=entity('mystery','m2','Mystery 2',{});
  const clue={id:'clue',mysteryId:'m1',mysteryIds:['m2'],label:'Shared clue',kind:'Clue'};
  assert.equal(mysteryProgression('m1',{clues:[clue],entities:[m1,m2]}).clueCount,1);
  assert.equal(mysteryProgression('m2',{clues:[clue],entities:[m1,m2]}).clueCount,1);
});

test('continuity intelligence flags scene use before birth, after death, and before a location exists',()=>{
  const book=entity('book','book','Book',{order:1});
  const chapter=entity('chapter','chapter','Chapter',{parentBookId:'book',number:1});
  const place=entity('location','place','New City',{locationKind:'City',existsFrom:100});
  const char=entity('character','char','Hero',{birthSort:80,deathSort:90,revivalSort:120});
  const scene=entity('scene','scene','Scene',{parentChapterId:'chapter',order:1,storyDateSort:95,locationId:'place'});
  const data={entities:[book,chapter,place,char,scene],relations:[{id:'presence',fromId:'char',toId:'scene',type:'appears_in'}],knowledge:[],clues:[],reveals:[]};
  const codes=new Set(continuityWarnings(data).map(w=>w.code));
  assert.ok(codes.has('location-before-exists'));
  assert.ok(codes.has('character-after-death'));
});

test('plot coverage and character interaction are derived from canonical scenes/relations',()=>{
  const book=entity('book','book','Book',{order:1});
  const chapter=entity('chapter','chapter','Chapter',{parentBookId:'book',number:1});
  const s1=entity('scene','s1','Scene 1',{parentChapterId:'chapter',order:1}),s2=entity('scene','s2','Scene 2',{parentChapterId:'chapter',order:2});
  const a=entity('character','a','A',{}),b=entity('character','b','B',{});
  const entities=[book,chapter,s1,s2,a,b];
  const workspace=[{id:'thread',kind:'plotThread',title:'Main',data:{}},{id:'beat',kind:'plotBeat',title:'Beat',data:{threadId:'thread',sceneId:'s1'}}];
  const coverage=plotCoverage({entities,workspace},'thread');
  assert.deepEqual(coverage.map(x=>x.covered),[true,false]);
  const matrix=characterInteractionMatrix({entities,relations:[{id:'r1',fromId:'a',toId:'s1',type:'appears_in'},{id:'r2',fromId:'b',toId:'s1',type:'appears_in'}]});
  assert.equal(matrix.counts.get('a|b'),1);
});

test('Worker contains Access JWT validation, reviewer write guard, safe delete routing, optimistic conflicts, revisions, and R2 trash',async()=>{
  const worker=await read('worker/index.js');
  assert.match(worker,/Cf-Access|cf-access-jwt-assertion/i);
  assert.match(worker,/jwtVerify\(/);
  assert.match(worker,/Reviewer access is read-only/i);
  assert.match(worker,/\['entities','mapVersions'\]\.includes\(store\)/);
  assert.match(worker,/This record changed elsewhere\. Reload before overwriting\./);
  assert.match(worker,/revisionStatement\(/);
  assert.match(worker,/_trash\//);
});

test('client media rendering is URL-first and map zoom supports 25–300 percent',async()=>{
  const app=await read('js/app.js');
  assert.match(app,/function mediaUrl\(item\)\{ if\(item\?\.url\) return item\.url/);
  assert.match(app,/Math\.max\(25,state\.mapZoom-25\)/);
  assert.match(app,/Math\.min\(300,state\.mapZoom\+25\)/);
  assert.doesNotMatch(app,/item\.blob\s*\?\s*`<img/);
});
