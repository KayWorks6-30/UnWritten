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
  const [relations,media,clues,reveals,knowledge,mapVersions,mapMarkers] = await Promise.all([
    getAll('relations'),getAll('media'),getAll('clues'),getAll('reveals'),getAll('knowledge'),getAll('mapVersions'),getAll('mapMarkers')
  ]);
  const stores=['entities','relations','media','clues','reveals','knowledge','mapVersions','mapMarkers'];
  const tx=db.transaction(stores,'readwrite');
  tx.objectStore('entities').delete(entityId);
  relations.filter(r=>r.fromId===entityId||r.toId===entityId).forEach(r=>tx.objectStore('relations').delete(r.id));
  media.forEach(item=>{ if((item.entityIds||[]).includes(entityId)) tx.objectStore('media').put({...item,entityIds:item.entityIds.filter(id=>id!==entityId)}); });
  clues.filter(c=>c.mysteryId===entityId||c.storyEntityId===entityId).forEach(c=>tx.objectStore('clues').delete(c.id));
  reveals.filter(r=>r.mysteryId===entityId||r.targetEntityId===entityId||r.bookId===entityId||r.chapterId===entityId||r.sceneId===entityId).forEach(r=>tx.objectStore('reveals').delete(r.id));
  knowledge.filter(k=>k.subjectEntityId===entityId||k.knowerEntityId===entityId||k.storyEntityId===entityId).forEach(k=>tx.objectStore('knowledge').delete(k.id));
  const versionIds = mapVersions.filter(v=>v.mapId===entityId).map(v=>v.id);
  mapVersions.filter(v=>v.mapId===entityId).forEach(v=>tx.objectStore('mapVersions').delete(v.id));
  mapMarkers.filter(m=>m.locationId===entityId||versionIds.includes(m.mapVersionId)).forEach(m=>tx.objectStore('mapMarkers').delete(m.id));
  return new Promise((resolve,reject)=>{ tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||new Error('Transaction aborted')); });
}

export { openDb, DB_NAME, DB_VERSION };
