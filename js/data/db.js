import { SCHEMA_VERSION } from '../domain/schema.js';

const DB_NAME = 'kayworks_world_bible';
const DB_VERSION = 1;
let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entities')) {
        const store = db.createObjectStore('entities', { keyPath: 'id' });
        store.createIndex('type', 'type');
        store.createIndex('status', 'status');
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('relations')) {
        const store = db.createObjectStore('relations', { keyPath: 'id' });
        store.createIndex('fromId', 'fromId');
        store.createIndex('toId', 'toId');
        store.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('media')) {
        const store = db.createObjectStore('media', { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeFor(name, mode = 'readonly') {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function getAll(name) {
  return reqPromise((await storeFor(name)).getAll());
}

export async function getOne(name, key) {
  return reqPromise((await storeFor(name)).get(key));
}

export async function putOne(name, value) {
  return reqPromise((await storeFor(name, 'readwrite')).put(value));
}

export async function deleteOne(name, key) {
  return reqPromise((await storeFor(name, 'readwrite')).delete(key));
}

export async function clearStore(name) {
  return reqPromise((await storeFor(name, 'readwrite')).clear());
}

export async function initializeDefaults() {
  const existing = await getOne('settings', 'project');
  if (!existing) {
    await putOne('settings', { key: 'project', value: { name: 'Galatea', currentBookId: null, schemaVersion: SCHEMA_VERSION } });
  }
}

export async function putMany(name, values) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    const store = tx.objectStore(name);
    for (const value of values) store.put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function replaceAll(name, values) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    const store = tx.objectStore(name);
    store.clear();
    for (const value of values) store.put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function deleteEntityCascade(entityId) {
  const db = await openDb();
  const relations = await getAll('relations');
  const media = await getAll('media');
  const tx = db.transaction(['entities', 'relations', 'media'], 'readwrite');
  tx.objectStore('entities').delete(entityId);
  const relStore = tx.objectStore('relations');
  relations.filter(r => r.fromId === entityId || r.toId === entityId).forEach(r => relStore.delete(r.id));
  const mediaStore = tx.objectStore('media');
  media.forEach(item => {
    if ((item.entityIds || []).includes(entityId)) {
      mediaStore.put({ ...item, entityIds: item.entityIds.filter(id => id !== entityId) });
    }
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export { openDb, DB_NAME };
