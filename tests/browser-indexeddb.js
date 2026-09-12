import { DATA_STORES, getAll, getOne, initializeDefaults, putOne, replaceDatabaseSnapshot, openDb } from '../js/data/db.js';
import { buildBackup, restoreBackup } from '../js/data/backup.js';
import { createEmptyEntity, SCHEMA_VERSION } from '../js/domain/schema.js';

function assert(condition, message) { if (!condition) throw new Error(message); }
function emptySnapshot() { return Object.fromEntries(DATA_STORES.map(name => [name, []])); }

async function run() {
  await replaceDatabaseSnapshot(emptySnapshot());
  await initializeDefaults();

  const location=createEmptyEntity('location');
  location.id='location-world'; location.name='Galatea'; location.status='Canon'; location.fields.locationKind='World';
  await putOne('entities',location);
  await putOne('media',{id:'media-map',name:'world.png',title:'World map',mime:'image/png',size:4,blob:new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'}),tags:['map'],entityIds:['location-world'],createdAt:new Date().toISOString()});

  const backup=await buildBackup({includeMedia:true});
  assert(backup.entities.some(e=>e.id==='location-world'),'backup should contain location');
  assert(backup.media[0]?.dataUrl?.startsWith('data:image/png'),'backup should serialize media');

  const replacement=emptySnapshot();
  replacement.entities=[{...createEmptyEntity('lore'),id:'temporary',name:'Temporary'}];
  replacement.settings=[{key:'project',value:{name:'Temporary',currentBookId:null,schemaVersion:SCHEMA_VERSION}}];
  await replaceDatabaseSnapshot(replacement);
  assert((await getAll('entities')).some(e=>e.id==='temporary'),'replacement snapshot should be present');

  await restoreBackup(backup,{replace:true});
  const restoredEntities=await getAll('entities');
  const restoredMedia=await getAll('media');
  assert(restoredEntities.length===1&&restoredEntities[0].id==='location-world','JSON restore should recover original entities');
  assert(restoredMedia.length===1&&restoredMedia[0].blob instanceof Blob&&restoredMedia[0].blob.size===4,'JSON restore should recover media blobs');

  const beforeProject=structuredClone(await getOne('settings','project'));
  const beforeEntities=structuredClone(restoredEntities);
  const invalid=emptySnapshot();
  invalid.entities=[{...createEmptyEntity('lore'),id:'would-have-replaced',name:'Should not commit'}];
  invalid.settings=[{value:{name:'Missing key'}}];
  let failed=false;
  try { await replaceDatabaseSnapshot(invalid); } catch { failed=true; }
  assert(failed,'invalid multi-store snapshot should reject');
  const afterEntities=await getAll('entities');
  const afterProject=await getOne('settings','project');
  assert(JSON.stringify(afterEntities)===JSON.stringify(beforeEntities),'failed atomic restore must preserve entities');
  assert(JSON.stringify(afterProject)===JSON.stringify(beforeProject),'failed atomic restore must preserve settings');

  const future={...backup,schemaVersion:SCHEMA_VERSION+1};
  failed=false;
  try { await restoreBackup(future,{replace:true}); } catch { failed=true; }
  assert(failed,'future schema backup should reject');
  assert((await getAll('entities'))[0]?.id==='location-world','future-schema rejection must leave database unchanged');

  (await openDb()).close();
  document.body.dataset.result='pass';
  document.body.textContent='PASS';
}

run().catch(error=>{ console.error(error); document.body.dataset.result='fail'; document.body.textContent=`FAIL: ${error.message||error}`; });
