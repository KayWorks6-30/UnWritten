import { APP_VERSION, SCHEMA_VERSION } from '../domain/schema.js';
import { DATA_STORES, getAll, replaceDatabaseSnapshot } from './db.js';
import { migrateBackupData } from './migrations.js';
import { assertValidBackupSnapshot } from './validation.js';
import { makeZip, readZip } from './zip.js';

function blobToDataUrl(blob) { return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(reader.error); reader.readAsDataURL(blob); }); }
async function mediaBlob(item){ if(item.blob instanceof Blob) return item.blob; if(item.url){ const response=await fetch(item.url,{cache:'no-store'}); if(!response.ok) throw new Error(`Could not download media ${item.id}.`); return response.blob(); } throw new Error(`Media ${item.id} has no downloadable payload.`); }
async function mediaToPortable(item){ const blob=await mediaBlob(item); const {url,r2Key,blob:_ignored,...rest}=item; return {...rest,dataUrl:await blobToDataUrl(blob)}; }
async function portableToMedia(item){ if(!item.dataUrl) return item; const response=await fetch(item.dataUrl); if(!response.ok) throw new Error(`Could not decode media ${item.id}.`); const blob=await response.blob(); const {dataUrl,...rest}=item; return {...rest,blob}; }

export async function buildBackup({includeMedia=true, portableMedia=true}={}) {
  const values=await Promise.all(DATA_STORES.map(getAll));
  const stores=Object.fromEntries(DATA_STORES.map((name,index)=>[name,values[index]]));
  stores.media = includeMedia ? (portableMedia ? await Promise.all(stores.media.map(mediaToPortable)) : stores.media) : [];
  return { format:'kayworks-world-bible-backup', appVersion:APP_VERSION, schemaVersion:SCHEMA_VERSION, exportedAt:new Date().toISOString(), ...stores };
}

export function downloadBlob(blob,filename){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),0); }
export function downloadJson(data,filename){ downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),filename); }

async function prepareJsonRestore(data){
  const migrated=migrateBackupData(data);
  assertValidBackupSnapshot(migrated);
  const media=await Promise.all((migrated.media||[]).map(portableToMedia));
  const snapshot={...migrated,media};
  assertValidBackupSnapshot(snapshot);
  return snapshot;
}

export async function restoreBackup(data,{replace=true}={}) {
  if(!replace) throw new Error('Merge import is not implemented. Restore uses replace-only semantics.');
  const snapshot=await prepareJsonRestore(data);
  await replaceDatabaseSnapshot(snapshot);
}

function extensionFor(item){ const byMime={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'}; return byMime[item.mime] || (item.name?.split('.').pop()?.replace(/[^a-z0-9]/gi,'').toLowerCase()) || 'bin'; }

export async function buildZipBackup(){
  const backup=await buildBackup({includeMedia:false}); const media=await getAll('media');
  backup.media=media.map(({blob,url,r2Key,...item})=>({...item,archivePath:`media/${item.id}.${extensionFor(item)}`}));
  const entries=[{name:'manifest.json',data:JSON.stringify(backup,null,2)}];
  for(const item of media){ const blob=await mediaBlob(item); entries.push({name:`media/${item.id}.${extensionFor(item)}`,data:blob}); }
  return makeZip(entries);
}

export async function restoreZipBackup(file,{replace=true}={}){
  if(!replace) throw new Error('Merge import is not implemented.');
  const entries=await readZip(file); const manifestBytes=entries.get('manifest.json'); if(!manifestBytes) throw new Error('ZIP backup is missing manifest.json.');
  const manifest=JSON.parse(new TextDecoder().decode(manifestBytes)); const migrated=migrateBackupData(manifest);
  assertValidBackupSnapshot(migrated);
  const media=[];
  for(const item of migrated.media||[]){
    if(!item.archivePath) throw new Error(`ZIP backup media ${item.id} is missing archivePath.`);
    const bytes=entries.get(item.archivePath);
    if(!bytes) throw new Error(`Backup is incomplete: ${item.archivePath} is missing.`);
    const {archivePath,...rest}=item;
    media.push({...rest,blob:new Blob([bytes],{type:item.mime||'application/octet-stream'})});
  }
  const snapshot={...migrated,media};
  assertValidBackupSnapshot(snapshot);
  await replaceDatabaseSnapshot(snapshot);
}

export { prepareJsonRestore };
