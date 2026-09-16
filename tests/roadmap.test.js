import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRY_TYPES, SCHEMA_VERSION, KNOWLEDGE_STATES } from '../js/domain/schema.js';
import { compareTimelineEvents, eventRangeLabel } from '../js/domain/timeline.js';
import { storyOrder, storyPath } from '../js/domain/story.js';
import { neighborhood, familyLevels, radialLayout } from '../js/domain/graphs.js';
import { migrateBackupData, migrateEntity } from '../js/data/migrations.js';
import { makeZip, readZip } from '../js/data/zip.js';
import { buildMarkdownExport } from '../js/data/markdown.js';

test('roadmap schema includes structured parent helpers and map records', () => {
  assert.ok(ENTRY_TYPES.location.fields.some(f=>f.key==='parentLocationId'&&f.type==='entity'));
  assert.ok(ENTRY_TYPES.part?.fields.some(f=>f.key==='parentBookId'));
  assert.ok(ENTRY_TYPES.chapter.fields.some(f=>f.key==='parentBookId'));
  assert.ok(ENTRY_TYPES.chapter.fields.some(f=>f.key==='parentPartId'));
  assert.ok(ENTRY_TYPES.scene.fields.some(f=>f.key==='parentChapterId'));
  assert.ok(ENTRY_TYPES.map);
  assert.ok(SCHEMA_VERSION >= 4);
  assert.ok(KNOWLEDGE_STATES.includes('Incorrect belief'));
});

test('timeline sorts numeric ranges before unknown text and keeps display wording', () => {
  const later={fields:{dateStart:'200',dateText:'Around the second century'}};
  const earlier={fields:{dateStart:'100',dateEnd:'120',dateText:'Traditional reign'}};
  const unknown={fields:{dateText:'Unknown'}};
  assert.ok(compareTimelineEvents(earlier,later)<0);
  assert.ok(compareTimelineEvents(later,unknown)<0);
  assert.equal(eventRangeLabel(earlier),'Traditional reign');
});

test('story helpers resolve Book → optional Part → Chapter → Scene order and path', () => {
  const book={id:'b',type:'book',name:'Book I',fields:{order:'1'}};
  const part={id:'p',type:'part',name:'Part I',fields:{parentBookId:'b',order:'1'}};
  const chapter={id:'c',type:'chapter',name:'Chapter 4',fields:{parentBookId:'b',parentPartId:'p',number:'4'}};
  const scene={id:'s',type:'scene',name:'Ruin',fields:{parentChapterId:'c',order:'2'}};
  const entities=[book,part,chapter,scene];
  assert.deepEqual(storyOrder(scene,entities),[1,1,4,2,3]);
  assert.equal(storyPath(scene,entities),'Book I → Part I → Chapter 4 → Ruin');
  const direct={id:'d',type:'chapter',name:'Prologue',fields:{parentBookId:'b',number:'0'}};
  assert.deepEqual(storyOrder(direct,[...entities,direct]),[1,0,0,-1,2]);
});

test('relationship neighborhood respects depth and family levels infer generations', () => {
  const relations=[
    {id:'1',fromId:'a',toId:'b',type:'friend_of'},
    {id:'2',fromId:'b',toId:'c',type:'friend_of'},
    {id:'3',fromId:'p',toId:'a',type:'parent_of'},
    {id:'4',fromId:'a',toId:'child',type:'parent_of'}
  ];
  assert.deepEqual(new Set(neighborhood('a',relations,1).ids),new Set(['a','b','p','child']));
  const levels=familyLevels('a',relations,2);
  assert.equal(levels.get('p'),-1);
  assert.equal(levels.get('child'),1);
  const layout=radialLayout('a',['a','b','p'],600,400);
  assert.deepEqual(layout.a,{x:300,y:200});
});

test('migration preserves legacy fields and adds archive/date defaults', () => {
  const migrated=migrateEntity({id:'x',type:'event',name:'Old Event',status:'Canon',fields:{dateText:'Traditional date'},tags:[]});
  assert.equal(migrated.archivedAt,null);
  assert.equal(migrated.fields.dateUncertainty,'Unknown');
  const backup=migrateBackupData({format:'kayworks-world-bible-backup',entities:[migrated],relations:[],settings:[],media:[]});
  assert.deepEqual(backup.clues,[]);
  assert.deepEqual(backup.mapMarkers,[]);
  assert.equal(backup.schemaVersion,SCHEMA_VERSION);
});

test('store-only ZIP writer round trips text and binary entries', async () => {
  const zip=await makeZip([{name:'manifest.json',data:'{"ok":true}'},{name:'media/a.bin',data:new Uint8Array([1,2,3,4])}]);
  const entries=await readZip(zip);
  assert.equal(new TextDecoder().decode(entries.get('manifest.json')),'{"ok":true}');
  assert.deepEqual([...entries.get('media/a.bin')],[1,2,3,4]);
});

test('markdown export resolves structured entity links and knowledge records', () => {
  const entities=[
    {id:'l',type:'location',name:'Capital',status:'Canon',tags:['city'],fields:{},summary:'City',notes:'',archivedAt:null},
    {id:'c',type:'character',name:'Scholar',status:'Canon',tags:[],fields:{currentLocation:'Capital'},summary:'',notes:'',archivedAt:null}
  ];
  const md=buildMarkdownExport({project:{name:'Galatea'},entities,relations:[{fromId:'c',toId:'l',type:'located_in',note:''}],clues:[],reveals:[],knowledge:[{subjectEntityId:'l',knowerKind:'character',knowerEntityId:'c',state:'Partial truth',belief:'Old maps'}],mapVersions:[],mapMarkers:[]});
  assert.match(md,/# Galatea/);
  assert.match(md,/Scholar/);
  assert.match(md,/Partial truth/);
  assert.match(md,/located in: Capital/);
});
