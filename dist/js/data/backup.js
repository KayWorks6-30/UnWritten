import { APP_VERSION, SCHEMA_VERSION } from '../domain/schema.js';
import { DATA_STORES, getAll, replaceAll } from './db.js';
import { migrateBackupData } from './migrations.js';
import { makeZip, readZip } from './zip.js';

function blobToDataUrl(blob) { return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(reader.error); reader.readAsDataURL(blob); }); }
async function mediaToPortable(item){ if(!(item.blob instanceof Blob)) return item; const {blob,...rest}=item; return {...rest,dataUrl:await blobToDataUrl(blob)}; }
async function portableToMedia(item){ if(!item.dataUrl) return item; const response=await fetch(item.dataUrl); const blob=await response.blob(); const {dataUrl,...rest}=item; return {...rest,blob}; }

export async function buildBackup({includeMedia=true, portableMedia=true}={}) {
  const [entities,relations,mediaRaw,settings,clues,reveals,knowledge,mapVersions,mapMarkers]=await Promise.all(DATA_STORES.map(getAll));
  const media = includeMedia ? (portableMedia ? await Promise.all(mediaRaw.map(mediaToPortable)) : mediaRaw) : [];
  return { format:'kayworks-world-bible-backup', appVersion:APP_VERSION, schemaVersion:SCHEMA_VERSION, exportedAt:new Date().toISOString(), entities,relations,settings,media,clues,reveals,knowledge,mapVersions,mapMarkers };
}

export function downloadBlob(blob,filename){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),0); }
export function downloadJson(data,filename){ downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),filename); }

export async function restoreBackup(data,{replace=true}={}) {
  const migrated=migrateBackupData(data); if(!replace) throw new Error('Merge import is not implemented. Restore uses replace-only semantics.');
  const media=await Promise.all((migrated.media||[]).map(portableToMedia));
  const sets={...migrated,media};
  for(const store of DATA_STORES) await replaceAll(store,sets[store]||[]);
}

function extensionFor(item){ const byMime={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'}; return byMime[item.mime] || (item.name?.split('.').pop()?.replace(/[^a-z0-9]/gi,'').toLowerCase()) || 'bin'; }

export async function buildZipBackup(){
  const backup=await buildBackup({includeMedia:false}); const media=await getAll('media');
  backup.media=media.map(({blob,...item})=>({...item,archivePath:`media/${item.id}.${extensionFor(item)}`}));
  const entries=[{name:'manifest.json',data:JSON.stringify(backup,null,2)}];
  for(const item of media){ if(item.blob instanceof Blob) entries.push({name:`media/${item.id}.${extensionFor(item)}`,data:item.blob}); }
  return makeZip(entries);
}

export async function restoreZipBackup(file,{replace=true}={}){
  const entries=await readZip(file); const manifestBytes=entries.get('manifest.json'); if(!manifestBytes) throw new Error('ZIP backup is missing manifest.json.');
  const manifest=JSON.parse(new TextDecoder().decode(manifestBytes)); const migrated=migrateBackupData(manifest);
  const media=[];
  for(const item of migrated.media||[]){ const bytes=entries.get(item.archivePath); const {archivePath,...rest}=item; media.push({...rest,blob:bytes?new Blob([bytes],{type:item.mime||'application/octet-stream'}):undefined}); }
  migrated.media=media; if(!replace) throw new Error('Merge import is not implemented.');
  for(const store of DATA_STORES) await replaceAll(store,migrated[store]||[]);
}
