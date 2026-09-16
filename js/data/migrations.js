import { SCHEMA_VERSION } from '../domain/schema.js';

function arr(value){ return Array.isArray(value)?value:[]; }
function obj(value){ return value&&typeof value==='object'&&!Array.isArray(value)?value:{}; }
function stamp(value,fallback=''){ return value||fallback||''; }

export function migrateEntity(entity = {}) {
  const next = structuredClone(entity);
  next.tags = arr(next.tags);
  next.fields = obj(next.fields);
  next.favorite = Boolean(next.favorite);
  next.archivedAt = next.archivedAt || null;
  next.createdAt = next.createdAt || '';
  next.updatedAt = next.updatedAt || next.createdAt || '';
  if (next.type === 'event') {
    if (!next.fields.dateText && next.fields.date) next.fields.dateText = next.fields.date;
    if (!next.fields.dateUncertainty) next.fields.dateUncertainty = next.fields.dateText ? 'Unknown' : '';
  }
  if (next.type === 'map') {
    next.fields.scopeLocationId = next.fields.scopeLocationId || '';
    next.fields.parentMapId = next.fields.parentMapId || '';
  }
  if(next.type==='chapter'){
    next.fields.parentBookId=next.fields.parentBookId||'';
    next.fields.parentPartId=next.fields.parentPartId||'';
  }
  if(next.type==='part') next.fields.parentBookId=next.fields.parentBookId||'';
  if(next.type==='scene') next.fields.parentChapterId=next.fields.parentChapterId||'';
  return next;
}

function ensureStores(data){
  const next={...data};
  for(const store of ['entities','relations','settings','media','clues','reveals','knowledge','mapVersions','mapMarkers','workspace']) next[store]=arr(next[store]);
  return next;
}

function v1To2(data){
  const next=ensureStores(data);
  next.entities=next.entities.map(migrateEntity);
  next.media=next.media.map(item=>({...item,tags:arr(item?.tags),entityIds:arr(item?.entityIds)}));
  return {...next,schemaVersion:2};
}
function v2To3(data){
  const next=ensureStores(data);
  next.clues=next.clues.map(item=>({...item,mysteryIds:arr(item?.mysteryIds)}));
  next.mapMarkers=next.mapMarkers.map(item=>({...item,tags:arr(item?.tags),bookIds:arr(item?.bookIds)}));
  return {...next,schemaVersion:3};
}
function v3To4(data){
  const next=ensureStores(data);
  next.workspace=arr(next.workspace);
  return {...next,schemaVersion:4};
}
function v4To5(data){
  const next=ensureStores(data);
  next.relations=next.relations.map(item=>({...item,eraId:item?.eraId||null,activeFrom:item?.activeFrom||'',activeTo:item?.activeTo||'',updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.mapMarkers=next.mapMarkers.map(item=>({...item,category:item?.category||'',icon:item?.icon||'',customMediaId:item?.customMediaId||null,tags:arr(item?.tags),activeFrom:item?.activeFrom||'',activeTo:item?.activeTo||'',layerId:item?.layerId||null,factionId:item?.factionId||null,bookIds:arr(item?.bookIds),storyRelevance:item?.storyRelevance||'',active:item?.active!==false,updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  return {...next,schemaVersion:5};
}
function v5To6(data){
  const next=ensureStores(data);
  next.relations=next.relations.map(item=>({...item,status:item?.status||'Canon',updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.clues=next.clues.map(item=>({...item,mysteryIds:arr(item?.mysteryIds).filter(id=>id&&id!==item?.mysteryId)}));
  return {...next,schemaVersion:6};
}
function v6To7(data){
  const next=ensureStores(data);
  next.entities=next.entities.map(migrateEntity);
  next.reveals=next.reveals.map(item=>({...item,partId:item?.partId||null}));
  return {...next,schemaVersion:7};
}
function normalizeCurrent(data){
  const next=ensureStores(data);
  next.entities=next.entities.map(migrateEntity);
  next.relations=next.relations.map(item=>({...item,status:item?.status||'Canon',eraId:item?.eraId||null,activeFrom:item?.activeFrom||'',activeTo:item?.activeTo||'',updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.settings=next.settings.map(item=>({...item,updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.media=next.media.map(item=>({...item,tags:arr(item?.tags),entityIds:arr(item?.entityIds),updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.clues=next.clues.map(item=>({...item,mysteryIds:arr(item?.mysteryIds),updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.reveals=next.reveals.map(item=>({...item,partId:item?.partId||null,updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.knowledge=next.knowledge.map(item=>({...item,updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.mapVersions=next.mapVersions.map(item=>({...item,updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.mapMarkers=next.mapMarkers.map(item=>({...item,tags:arr(item?.tags),bookIds:arr(item?.bookIds),updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.workspace=next.workspace.map(item=>({...item,data:obj(item?.data),updatedAt:stamp(item?.updatedAt,item?.createdAt)}));
  next.settings=next.settings.map(item=>item.key==='project'?{...item,value:{...obj(item.value),schemaVersion:8}}:item);
  return next;
}
function v7To8(data){ return {...normalizeCurrent(data),schemaVersion:8}; }


export const BACKUP_MIGRATIONS = new Map([
  [1,v1To2],[2,v2To3],[3,v3To4],[4,v4To5],[5,v5To6],[6,v6To7],[7,v7To8]
]);

export function migrateBackupData(data) {
  if (!data || data.format !== 'kayworks-world-bible-backup') throw new Error('This is not an UnWritten.KayWorks backup file.');
  const sourceVersion = Number(data.schemaVersion ?? 1);
  if (!Number.isInteger(sourceVersion) || sourceVersion < 1) throw new Error('Backup schema version is invalid.');
  if (sourceVersion > SCHEMA_VERSION) throw new Error(`This backup uses schema ${sourceVersion}, but this app only supports up to schema ${SCHEMA_VERSION}. Update the app before restoring it.`);
  let current=ensureStores(structuredClone(data));
  let version=sourceVersion;
  while(version<SCHEMA_VERSION){
    const migrate=BACKUP_MIGRATIONS.get(version);
    if(!migrate) throw new Error(`No backup migration is registered for schema ${version} → ${version+1}.`);
    current=migrate(current);
    const nextVersion=Number(current.schemaVersion);
    if(nextVersion!==version+1) throw new Error(`Backup migration ${version} did not advance exactly one schema version.`);
    version=nextVersion;
  }
  current=normalizeCurrent(current);
  return {...current,schemaVersion:SCHEMA_VERSION};
}
