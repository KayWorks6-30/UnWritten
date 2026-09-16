import { SCHEMA_VERSION } from '../domain/schema.js';
import { api } from './api.js';

export const DATA_STORES = ['entities','relations','media','settings','clues','reveals','knowledge','mapVersions','mapMarkers','workspace'];
const storeCache = new Map();
const storePromises = new Map();
const recordVersions = new Map();

function keyFor(name,row){ return name==='settings'?row?.key:row?.id; }
function clone(value){ return structuredClone(value); }
function versionKey(name,key){ return `${name}\u001f${key}`; }
function rememberVersion(name,row){ const key=keyFor(name,row); if(key&&row?.updatedAt) recordVersions.set(versionKey(name,key),row.updatedAt); }
function rememberVersions(name,rows){ for(const row of rows||[]) rememberVersion(name,row); }
function cachedVersion(name,key){ return recordVersions.get(versionKey(name,key))||null; }
function cacheRows(name,rows){ const next=Array.isArray(rows)?rows:[]; storeCache.set(name,next); rememberVersions(name,next); return storeCache.get(name); }
function updateCachedRecord(name,record){
  if(!record) return;
  rememberVersion(name,record);
  if(!storeCache.has(name)) return;
  const rows=storeCache.get(name),key=keyFor(name,record),index=rows.findIndex(row=>keyFor(name,row)===key);
  if(index>=0) rows[index]=record; else rows.push(record);
}
function removeCachedRecord(name,key){
  recordVersions.delete(versionKey(name,key));
  if(!storeCache.has(name)) return;
  storeCache.set(name,storeCache.get(name).filter(row=>keyFor(name,row)!==key));
}
export function invalidateStore(name){ storeCache.delete(name); storePromises.delete(name); for(const key of [...recordVersions.keys()]) if(key.startsWith(`${name}\u001f`)) recordVersions.delete(key); }
export function invalidateRemoteCache(){ storeCache.clear(); storePromises.clear(); recordVersions.clear(); }

export async function getAll(name,{fresh=false}={}){
  if(!DATA_STORES.includes(name)) throw new Error(`Unknown store ${name}.`);
  if(fresh) invalidateStore(name);
  if(storeCache.has(name)) return clone(storeCache.get(name));
  if(!storePromises.has(name)){
    storePromises.set(name,api(`/api/store/${encodeURIComponent(name)}`).then(payload=>{
      storePromises.delete(name);
      return cacheRows(name,Array.isArray(payload?.records)?payload.records:[]);
    }).catch(error=>{storePromises.delete(name);throw error;}));
  }
  return clone(await storePromises.get(name));
}

export async function getOne(name,key,{fresh=false}={}){
  if(!DATA_STORES.includes(name)) throw new Error(`Unknown store ${name}.`);
  if(!fresh&&storeCache.has(name)){
    const hit=storeCache.get(name).find(row=>keyFor(name,row)===key);
    if(hit) return clone(hit);
  }
  const payload=await api(`/api/store/${encodeURIComponent(name)}/${encodeURIComponent(key)}`);
  if(payload?.record) rememberVersion(name,payload.record);
  return payload?.record?clone(payload.record):null;
}

export async function putOne(name,value,{baseUpdatedAt=null}={}){
  if(!DATA_STORES.includes(name)) throw new Error(`Unknown store ${name}.`);
  const key=name==='settings'?value.key:value.id;
  const cached=storeCache.get(name)?.find(row=>keyFor(name,row)===key);
  const base=baseUpdatedAt || cached?.updatedAt || cachedVersion(name,key) || value?.updatedAt || null;
  let saved;
  if(name==='media'){
    if(!(value.blob instanceof Blob)) throw new Error('Media uploads require a local file/blob.');
    const {blob,url,r2Key,...metadata}=value;
    const form=new FormData(); form.append('metadata',JSON.stringify(metadata)); form.append('file',blob,value.name||'upload.bin');
    const headers={}; if(base) headers['x-base-updated-at']=base;
    const payload=await api(`/api/media/${encodeURIComponent(value.id)}`,{method:'PUT',headers,body:form});
    saved=payload?.record||value;
  } else {
    const headers={'content-type':'application/json'}; if(base) headers['x-base-updated-at']=base;
    const payload=await api(`/api/store/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,{method:'PUT',headers,body:JSON.stringify(value)});
    saved=payload?.record||value;
  }
  updateCachedRecord(name,saved);
  return clone(saved);
}

export async function deleteOne(name,key){
  if(!DATA_STORES.includes(name)) throw new Error(`Unknown store ${name}.`);
  if(name==='entities') return deleteEntityCascade(key);
  if(name==='mapVersions') return deleteMapVersionCascade(key);
  const path=name==='media'?`/api/media/${encodeURIComponent(key)}`:`/api/store/${encodeURIComponent(name)}/${encodeURIComponent(key)}`;
  const cached=storeCache.get(name)?.find(row=>keyFor(name,row)===key),headers={},base=cached?.updatedAt||cachedVersion(name,key); if(base) headers['x-base-updated-at']=base;
  await api(path,{method:'DELETE',headers});
  removeCachedRecord(name,key);
  invalidateRemoteCache();
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
  invalidateRemoteCache();
}

export async function deleteMapVersionCascade(versionId){ const cached=storeCache.get('mapVersions')?.find(row=>row.id===versionId),headers={},base=cached?.updatedAt||cachedVersion('mapVersions',versionId); if(base) headers['x-base-updated-at']=base; await api(`/api/map-versions/${encodeURIComponent(versionId)}/cascade`,{method:'DELETE',headers}); invalidateRemoteCache(); }
export async function deleteEntityCascade(entityId){ const cached=storeCache.get('entities')?.find(row=>row.id===entityId),headers={},base=cached?.updatedAt||cachedVersion('entities',entityId); if(base) headers['x-base-updated-at']=base; await api(`/api/entities/${encodeURIComponent(entityId)}/cascade`,{method:'DELETE',headers}); invalidateRemoteCache(); }

export async function queryEntities({q='',type='',status='',archived='active',limit=50,cursor=''}={}){
  const params=new URLSearchParams();
  if(q) params.set('q',q); if(type) params.set('type',type); if(status) params.set('status',status); if(archived) params.set('archived',archived);
  params.set('limit',String(limit)); if(cursor) params.set('cursor',String(cursor));
  const payload=await api(`/api/entities/query?${params.toString()}`);
  const records=Array.isArray(payload?.records)?payload.records:[]; rememberVersions('entities',records);
  return {records,nextCursor:payload?.nextCursor||null,total:Number(payload?.total)||0};
}

export async function getEntityRevisions(entityId,{limit=50}={}){ const payload=await api(`/api/entities/${encodeURIComponent(entityId)}/revisions?limit=${encodeURIComponent(limit)}`); return Array.isArray(payload?.revisions)?payload.revisions:[]; }
export async function getEntityImpact(entityId){ const payload=await api(`/api/entities/${encodeURIComponent(entityId)}/impact`); return Array.isArray(payload?.references)?payload.references:[]; }
export async function getAllRevisions(){ const payload=await api('/api/revisions'); return Array.isArray(payload?.revisions)?payload.revisions:[]; }
export async function getDiagnostics({deep=false}={}){ return api(`/api/diagnostics${deep?'?deep=1':''}`); }
export async function rebuildReferenceIndexRemote(){ return api('/api/diagnostics/reference-index/rebuild',{method:'POST'}); }

export async function initializeDefaults(){
  const project=await getOne('settings','project');
  if(!project){ await putOne('settings',{key:'project',value:{name:'UnWritten.KayWorks',currentBookId:null,schemaVersion:SCHEMA_VERSION}}); return; }
  const name=project.value?.name==='Galatea'?'UnWritten.KayWorks':(project.value?.name||'UnWritten.KayWorks');
  if(name!==project.value?.name || Number(project.value?.schemaVersion)!==SCHEMA_VERSION) await putOne('settings',{...project,value:{...project.value,name,schemaVersion:SCHEMA_VERSION}});
}

export async function getStorageStatus(){ return api('/api/health'); }
export function mediaContentUrl(itemOrId){ const id=typeof itemOrId==='string'?itemOrId:itemOrId?.id; return id?`/api/media/${encodeURIComponent(id)}/content`:''; }
