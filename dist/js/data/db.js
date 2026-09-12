import { SCHEMA_VERSION } from '../domain/schema.js';
import { migrateEntity } from './migrations.js';

const DB_NAME = 'kayworks_world_bible';
const DB_VERSION = 2;
export const DATA_STORES = ['entities','relations','media','settings','clues','reveals','knowledge','mapVersions','mapMarkers'];
let dbPromise;

function createStore(db, name, keyPath = 'id') {
  if (!db.objectStoreNames.contains(name)) return db.createObjectStore(name, { keyPath });
  return null;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entities')) {
        const store = createStore(db, 'entities');
        store.createIndex('type', 'type'); store.createIndex('status', 'status'); store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('relations')) {
        const store = createStore(db, 'relations');
        store.createIndex('fromId', 'fromId'); store.createIndex('toId', 'toId'); store.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('media')) { const store = createStore(db, 'media'); store.createIndex('createdAt', 'createdAt'); }
      createStore(db, 'settings', 'key');
      if (!db.objectStoreNames.contains('clues')) { const s = createStore(db, 'clues'); s.createIndex('mysteryId','mysteryId'); s.createIndex('storyEntityId','storyEntityId'); }
      if (!db.objectStoreNames.contains('reveals')) { const s = createStore(db, 'reveals'); s.createIndex('mysteryId','mysteryId'); s.createIndex('targetEntityId','targetEntityId'); }
      if (!db.objectStoreNames.contains('knowledge')) { const s = createStore(db, 'knowledge'); s.createIndex('subjectEntityId','subjectEntityId'); s.createIndex('knowerEntityId','knowerEntityId'); }
      if (!db.objectStoreNames.contains('mapVersions')) { const s = createStore(db, 'mapVersions'); s.createIndex('mapId','mapId'); }
      if (!db.objectStoreNames.contains('mapMarkers')) { const s = createStore(db, 'mapMarkers'); s.createIndex('mapVersionId','mapVersionId'); s.createIndex('locationId','locationId'); }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqPromise(req) { return new Promise((resolve,reject)=>{ req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
async function storeFor(name, mode='readonly') { const db=await openDb(); return db.transaction(name,mode).objectStore(name); }
export async function getAll(name) { return reqPromise((await storeFor(name)).getAll()); }
export async function getOne(name,key) { return reqPromise((await storeFor(name)).get(key)); }
export async function putOne(name,value) { return reqPromise((await storeFor(name,'readwrite')).put(value)); }
export async function deleteOne(name,key) { return reqPromise((await storeFor(name,'readwrite')).delete(key)); }
export async function clearStore(name) { return reqPromise((await storeFor(name,'readwrite')).clear()); }

export async function putMany(name, values) {
  const db=await openDb();
  return new Promise((resolve,reject)=>{ const tx=db.transaction(name,'readwrite'); const store=tx.objectStore(name); for(const value of values) store.put(value); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||new Error('Transaction aborted')); });
}

export async function replaceAll(name, values) {
  const db=await openDb();
  return new Promise((resolve,reject)=>{ const tx=db.transaction(name,'readwrite'); const store=tx.objectStore(name); store.clear(); for(const value of values) store.put(value); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||new Error('Transaction aborted')); });
}


export async function replaceDatabaseSnapshot(snapshot) {
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(DATA_STORES,'readwrite');
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error||new Error('Restore transaction aborted.'));
    try {
      for (const name of DATA_STORES) {
        const store = tx.objectStore(name);
        store.clear();
        for (const value of snapshot[name] || []) store.put(value);
      }
    } catch (error) {
      try { tx.abort(); } catch {}
      reject(error);
    }
  });
}

export async function deleteMapVersionCascade(versionId) {
  const db = await openDb();
  const [version,versions,markers,media] = await Promise.all([getOne('mapVersions',versionId),getAll('mapVersions'),getAll('mapMarkers'),getAll('media')]);
  if (!version) return;
  const tx = db.transaction(['mapVersions','mapMarkers','media'],'readwrite');
  tx.objectStore('mapVersions').delete(versionId);
  markers.filter(m=>m.mapVersionId===versionId).forEach(m=>tx.objectStore('mapMarkers').delete(m.id));
  if (version.mediaId) {
    const otherVersionUses=versions.some(v=>v.id!==versionId&&v.mediaId===version.mediaId);
    const mediaItem=media.find(m=>m.id===version.mediaId);
    const linkedElsewhere=(mediaItem?.entityIds||[]).some(id=>id!==version.mapId);
    if (!otherVersionUses&&!linkedElsewhere) tx.objectStore('media').delete(version.mediaId);
  }
  return new Promise((resolve,reject)=>{ tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||new Error('Transaction aborted')); });
}

export async function initializeDefaults() {
  let project = await getOne('settings','project');
  if (!project) project = { key:'project', value:{name:'Galatea',currentBookId:null,schemaVersion:SCHEMA_VERSION} };
  else project = { ...project, value:{...project.value,schemaVersion:SCHEMA_VERSION} };
  await putOne('settings',project);

  const entities = await getAll('entities');
  const migrated = entities.map(migrateEntity);
  const changed = migrated.some((e,i)=>JSON.stringify(e)!==JSON.stringify(entities[i]));
  if (changed) await replaceAll('entities', migrated);
}

export async function deleteEntityCascade(entityId) {
  const db=await openDb();
  const [entities,relations,media,settings,clues,reveals,knowledge,mapVersions,mapMarkers] = await Promise.all([
    getAll('entities'),getAll('relations'),getAll('media'),getAll('settings'),getAll('clues'),getAll('reveals'),getAll('knowledge'),getAll('mapVersions'),getAll('mapMarkers')
  ]);
  const target=entities.find(e=>e.id===entityId);
  if (!target) return;
  const blocking=entities.filter(e=>!e.archivedAt && e.id!==entityId && (
    e.fields?.parentLocationId===entityId || e.fields?.parentBookId===entityId || e.fields?.parentChapterId===entityId
  ));
  if (blocking.length) throw new Error(`Cannot permanently delete this entry while ${blocking.length} active child entr${blocking.length===1?'y references':'ies reference'} it. Archive or move those children first.`);

  const optionalRefFields=['eraId','storyEntityId','scopeLocationId','parentMapId'];
  const updatedEntities=entities.filter(e=>e.id!==entityId).map(e=>{
    const fields={...(e.fields||{})}; let changed=false;
    for(const key of optionalRefFields){ if(fields[key]===entityId){ fields[key]=''; changed=true; } }
    if(fields.parentLocationId===entityId||fields.parentBookId===entityId||fields.parentChapterId===entityId){ fields.parentLocationId=fields.parentLocationId===entityId?'':fields.parentLocationId; fields.parentBookId=fields.parentBookId===entityId?'':fields.parentBookId; fields.parentChapterId=fields.parentChapterId===entityId?'':fields.parentChapterId; changed=true; }
    return changed?{...e,fields,updatedAt:new Date().toISOString()}:e;
  });
  const versionIds = mapVersions.filter(v=>v.mapId===entityId).map(v=>v.id);
  const mediaIdsFromVersions = new Set(mapVersions.filter(v=>v.mapId===entityId).map(v=>v.mediaId).filter(Boolean));
  const stores=DATA_STORES;
  const tx=db.transaction(stores,'readwrite');
  const entityStore=tx.objectStore('entities'); entityStore.clear(); updatedEntities.forEach(e=>entityStore.put(e));
  relations.filter(r=>r.fromId===entityId||r.toId===entityId).forEach(r=>tx.objectStore('relations').delete(r.id));
  media.forEach(item=>{
    const linkedIds=(item.entityIds||[]).filter(id=>id!==entityId);
    if(mediaIdsFromVersions.has(item.id)) {
      const usedByOtherVersion=mapVersions.some(v=>v.mapId!==entityId&&v.mediaId===item.id);
      if(!usedByOtherVersion&&!linkedIds.length) tx.objectStore('media').delete(item.id);
      else if((item.entityIds||[]).includes(entityId)) tx.objectStore('media').put({...item,entityIds:linkedIds});
    } else if((item.entityIds||[]).includes(entityId)) tx.objectStore('media').put({...item,entityIds:linkedIds});
  });
  settings.forEach(row=>{ if(row.key==='project'&&row.value?.currentBookId===entityId) tx.objectStore('settings').put({...row,value:{...row.value,currentBookId:null}}); });
  clues.filter(c=>c.mysteryId===entityId||c.storyEntityId===entityId).forEach(c=>tx.objectStore('clues').delete(c.id));
  reveals.filter(r=>r.mysteryId===entityId||r.targetEntityId===entityId||r.bookId===entityId||r.chapterId===entityId||r.sceneId===entityId).forEach(r=>tx.objectStore('reveals').delete(r.id));
  knowledge.filter(k=>k.subjectEntityId===entityId||k.knowerEntityId===entityId||k.storyEntityId===entityId).forEach(k=>tx.objectStore('knowledge').delete(k.id));
  mapVersions.filter(v=>v.mapId===entityId).forEach(v=>tx.objectStore('mapVersions').delete(v.id));
  mapMarkers.filter(m=>m.locationId===entityId||versionIds.includes(m.mapVersionId)).forEach(m=>tx.objectStore('mapMarkers').delete(m.id));
  return new Promise((resolve,reject)=>{ tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||new Error('Transaction aborted')); });
}

export { openDb, DB_NAME, DB_VERSION };
