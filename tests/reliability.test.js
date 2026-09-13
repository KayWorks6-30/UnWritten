import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, ENTRY_TYPES, createEmptyEntity } from '../js/domain/schema.js';
import { migrateBackupData } from '../js/data/migrations.js';
import { validateBackupSnapshot } from '../js/data/validation.js';
import { makeZip, readZip } from '../js/data/zip.js';
import { validateRelation } from '../js/domain/relations.js';

function validSnapshot(){
  const world={...createEmptyEntity('location'),id:'world',name:'Galatea',status:'Canon',fields:{locationKind:'World'}};
  const kingdom={...createEmptyEntity('location'),id:'kingdom',name:'Kingdom',status:'Canon',fields:{locationKind:'Country',parentLocationId:'world'}};
  const map={...createEmptyEntity('map'),id:'map-world',name:'World Map',status:'Canon',fields:{mapKind:'World',scopeLocationId:'world',parentMapId:''}};
  return {
    format:'kayworks-world-bible-backup', appVersion:'1.1.0', schemaVersion:SCHEMA_VERSION, exportedAt:new Date().toISOString(),
    entities:[world,kingdom,map],
    relations:[{id:'rel-1',fromId:'kingdom',toId:'world',type:'located_in',note:'',createdAt:new Date().toISOString()}],
    settings:[{key:'project',value:{name:'Galatea',currentBookId:null,schemaVersion:SCHEMA_VERSION}}],
    media:[{id:'media-1',name:'map.png',title:'Map',mime:'image/png',size:1,blob:new Blob([new Uint8Array([1])],{type:'image/png'}),tags:['map'],entityIds:['map-world'],createdAt:new Date().toISOString()}],
    clues:[],reveals:[],knowledge:[],workspace:[],
    mapVersions:[{id:'version-1',mapId:'map-world',mediaId:'media-1',label:'Current',variant:'World',effectiveDate:'',notes:'',createdAt:new Date().toISOString()}],
    mapMarkers:[{id:'marker-1',mapVersionId:'version-1',locationId:'kingdom',x:50,y:50,createdAt:new Date().toISOString()}]
  };
}

test('V1.1 map schema supports geographic scope and overview-map hierarchy',()=>{
  const keys=ENTRY_TYPES.map.fields.map(field=>field.key);
  assert.ok(keys.includes('scopeLocationId'));
  assert.ok(keys.includes('parentMapId'));
});

test('future backup schemas are rejected instead of downgraded',()=>{
  const snapshot=validSnapshot();
  assert.throws(()=>migrateBackupData({...snapshot,schemaVersion:SCHEMA_VERSION+1}),/newer|supports up to/i);
});

test('backup validator accepts a consistent cross-store snapshot',()=>{
  assert.deepEqual(validateBackupSnapshot(validSnapshot()),[]);
});

test('backup validator rejects bad relation types and missing endpoints',()=>{
  const snapshot=validSnapshot();
  snapshot.relations=[{id:'bad-rel',fromId:'world',toId:'missing',type:'made_up'}];
  const errors=validateBackupSnapshot(snapshot).join(' ');
  assert.match(errors,/missing endpoint/i);
  assert.match(errors,/invalid type/i);
});

test('backup validator rejects map versions whose media is missing',()=>{
  const snapshot=validSnapshot();
  snapshot.media=[];
  assert.match(validateBackupSnapshot(snapshot).join(' '),/references missing media/i);
});

test('backup validator rejects self-parenting map/location fields',()=>{
  const snapshot=validSnapshot();
  snapshot.entities.find(e=>e.id==='world').fields.parentLocationId='world';
  snapshot.entities.find(e=>e.id==='map-world').fields.parentMapId='map-world';
  const errors=validateBackupSnapshot(snapshot).join(' ');
  assert.match(errors,/parentLocationId cannot point to itself/i);
  assert.match(errors,/parentMapId cannot point to itself/i);
});

test('relation validator rejects unknown relationship types',()=>{
  const errors=validateRelation({id:'r',fromId:'a',toId:'b',type:'not-real'});
  assert.ok(errors.some(error=>/invalid/i.test(error)));
});

test('ZIP reader detects payload corruption with CRC validation',async()=>{
  const zip=await makeZip([{name:'test.bin',data:new Uint8Array([10,20,30,40])}]);
  const bytes=new Uint8Array(await zip.arrayBuffer());
  const view=new DataView(bytes.buffer);
  const nameLength=view.getUint16(26,true);
  const extraLength=view.getUint16(28,true);
  const payloadOffset=30+nameLength+extraLength;
  bytes[payloadOffset]^=0xff;
  await assert.rejects(()=>readZip(new Blob([bytes],{type:'application/zip'})),/CRC/i);
});


test('backup validator rejects a character portrait that references missing media',()=>{
  const snapshot=validSnapshot();
  snapshot.entities.push({id:'char-portrait',type:'character',name:'Portrait Character',status:'Canon',tags:[],favorite:false,fields:{portraitMediaId:'missing-media'},summary:'',notes:'',archivedAt:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  assert.match(validateBackupSnapshot(snapshot).join(' '),/portraitMediaId references missing media/i);
});
