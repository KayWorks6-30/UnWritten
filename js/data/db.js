import { SCHEMA_VERSION } from '../domain/schema.js';

export const DATA_STORES = ['entities','relations','media','settings','clues','reveals','knowledge','mapVersions','mapMarkers','workspace'];
let snapshotPromise = null;
let snapshotCache = null;

async function api(path, options={}) {
  const response = await fetch(path, { ...options, headers:{ 'accept':'application/json', ...(options.headers||{}) } });
  const type=response.headers.get('content-type')||'';
  const payload=type.includes('application/json') ? await response.json() : null;
  if(!response.ok){
    const err=new Error(payload?.error || `Request failed (${response.status}).`);
    err.status=response.status; err.details=payload?.details; throw err;
  }
  return payload;
}

function invalidate(){ snapshotPromise=null; snapshotCache=null; }

async function loadSnapshot(){
  if(snapshotCache) return snapshotCache;
  if(!snapshotPromise) snapshotPromise=api('/api/snapshot').then(data=>{
    const snap=Object.fromEntries(DATA_STORES.map(name=>[name,Array.isArray(data[name])?data[name]:[]]));
    snapshotCache=snap; snapshotPromise=null; return snap;
  }).catch(error=>{snapshotPromise=null;throw error;});
  return snapshotPromise;
}

export async function getAll(name){ if(!DATA_STORES.includes(name)) throw new Error(`Unknown store ${name}.`); return structuredClone((await loadSnapshot())[name]); }
export async function getOne(name,key){ const rows=await getAll(name); return rows.find(row=>(name==='settings'?row.key:row.id)===key); }

export async function putOne(name,value,{baseUpdatedAt=null}={}){
  if(!DATA_STORES.includes(name)) throw new Error(`Unknown store ${name}.`);
  if(name==='media'){
    if(!(value.blob instanceof Blob)) throw new Error('Media uploads require a local file/blob.');
    const {blob,url,r2Key,...metadata}=value;
    const form=new FormData(); form.append('metadata',JSON.stringify(metadata)); form.append('file',blob,value.name||'upload.bin');
    await api(`/api/media/${encodeURIComponent(value.id)}`,{method:'PUT',body:form});
  } else {
    const key=name==='settings'?value.key:value.id;
    const headers={'content-type':'application/json'};
    if(baseUpdatedAt) headers['x-base-updated-at']=baseUpdatedAt;
    await api(`/api/store/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,{method:'PUT',headers,body:JSON.stringify(value)});
  }
  invalidate(); return value;
}

export async function deleteOne(name,key){
  if(!DATA_STORES.includes(name)) throw new Error(`Unknown store ${name}.`);
  if(name==='entities') return deleteEntityCascade(key);
  if(name==='mapVersions') return deleteMapVersionCascade(key);
  const path=name==='media'?`/api/media/${encodeURIComponent(key)}`:`/api/store/${encodeURIComponent(name)}/${encodeURIComponent(key)}`;
  await api(path,{method:'DELETE'}); invalidate();
}

export async function clearStore(){ throw new Error('Direct store clearing is disabled for the server-backed database. Use restore/import instead.'); }
export async function putMany(name,values){ for(const value of values) await putOne(name,value); }
export async function replaceAll(){ throw new Error('Direct store replacement is disabled for the server-backed database. Use restore/import instead.'); }

export async function replaceDatabaseSnapshot(snapshot){
  const manifest={...snapshot,media:(snapshot.media||[]).map(({blob,dataUrl,url,r2Key,...item})=>({...item,archivePath:item.archivePath||`media/${item.id}`}))};
  const prepared=await api('/api/restore/prepare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(manifest)});
  for(const item of snapshot.media||[]){
    if(!(item.blob instanceof Blob)) throw new Error(`Media ${item.id} is missing its image payload.`);
    await api(`/api/restore/${encodeURIComponent(prepared.restoreId)}/media/${encodeURIComponent(item.id)}`,{method:'PUT',headers:{'content-type':item.mime||item.blob.type||'application/octet-stream'},body:item.blob});
  }
  await api(`/api/restore/${encodeURIComponent(prepared.restoreId)}/commit`,{method:'POST'});
  invalidate();
}

export async function deleteMapVersionCascade(versionId){ await api(`/api/map-versions/${encodeURIComponent(versionId)}/cascade`,{method:'DELETE'}); invalidate(); }
export async function deleteEntityCascade(entityId){ await api(`/api/entities/${encodeURIComponent(entityId)}/cascade`,{method:'DELETE'}); invalidate(); }

export async function getEntityRevisions(entityId,{limit=50}={}){ const payload=await api(`/api/entities/${encodeURIComponent(entityId)}/revisions?limit=${encodeURIComponent(limit)}`); return Array.isArray(payload?.revisions)?payload.revisions:[]; }
export async function getAllRevisions(){ const payload=await api('/api/revisions'); return Array.isArray(payload?.revisions)?payload.revisions:[]; }

export async function initializeDefaults(){
  const project=await getOne('settings','project');
  if(!project){ await putOne('settings',{key:'project',value:{name:'UnWritten.KayWorks',currentBookId:null,schemaVersion:SCHEMA_VERSION}}); return; }
  const name=project.value?.name==='Galatea'?'UnWritten.KayWorks':(project.value?.name||'UnWritten.KayWorks');
  if(name!==project.value?.name || Number(project.value?.schemaVersion)!==SCHEMA_VERSION) await putOne('settings',{...project,value:{...project.value,name,schemaVersion:SCHEMA_VERSION}});
}

export async function getStorageStatus(){ return api('/api/health'); }
export function mediaContentUrl(itemOrId){ const id=typeof itemOrId==='string'?itemOrId:itemOrId?.id; return id?`/api/media/${encodeURIComponent(id)}/content`:''; }
export function invalidateRemoteCache(){ invalidate(); }
