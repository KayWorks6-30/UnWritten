const DB_NAME='unwritten_local_drafts';
const DB_VERSION=1;
const STORE='drafts';
let dbPromise;

function openDb(){
  if(dbPromise) return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'}); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function store(mode='readonly'){return (await openDb()).transaction(STORE,mode).objectStore(STORE);}
export async function getDraft(id){return request((await store()).get(id));}
export async function getDrafts(){return request((await store()).getAll());}
export async function saveDraft(entity,baseUpdatedAt=null){const row={id:entity.id,entity:structuredClone(entity),baseUpdatedAt:baseUpdatedAt||null,savedAt:new Date().toISOString()};await request((await store('readwrite')).put(row));return row;}
export async function deleteDraft(id){await request((await store('readwrite')).delete(id));}
