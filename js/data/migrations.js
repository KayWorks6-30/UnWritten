import { SCHEMA_VERSION } from '../domain/schema.js';

export function migrateEntity(entity = {}) {
  const next = structuredClone(entity);
  next.tags = Array.isArray(next.tags) ? next.tags : [];
  next.fields = next.fields && typeof next.fields === 'object' ? next.fields : {};
  next.favorite = Boolean(next.favorite);
  next.archivedAt = next.archivedAt || null;
  if (next.type === 'event') {
    if (!next.fields.dateText && next.fields.date) next.fields.dateText = next.fields.date;
    if (!next.fields.dateUncertainty) next.fields.dateUncertainty = next.fields.dateText ? 'Unknown' : '';
  }
  if (next.type === 'map') {
    next.fields.scopeLocationId = next.fields.scopeLocationId || '';
    next.fields.parentMapId = next.fields.parentMapId || '';
  }
  return next;
}

export function migrateBackupData(data) {
  if (!data || data.format !== 'kayworks-world-bible-backup') throw new Error('This is not an UnWritten.KayWorks backup file.');
  const sourceVersion = Number(data.schemaVersion ?? 1);
  if (!Number.isInteger(sourceVersion) || sourceVersion < 1) throw new Error('Backup schema version is invalid.');
  if (sourceVersion > SCHEMA_VERSION) throw new Error(`This backup uses schema ${sourceVersion}, but this app only supports up to schema ${SCHEMA_VERSION}. Update the app before restoring it.`);
  return {
    ...data,
    schemaVersion: SCHEMA_VERSION,
    entities: (Array.isArray(data.entities) ? data.entities : []).map(migrateEntity),
    relations: Array.isArray(data.relations) ? data.relations.map(item=>({...item,eraId:item?.eraId||null,activeFrom:item?.activeFrom||'',activeTo:item?.activeTo||'',updatedAt:item?.updatedAt||item?.createdAt||''})) : [],
    settings: Array.isArray(data.settings) ? data.settings : [],
    media: Array.isArray(data.media) ? data.media.map(item=>({...item,tags:Array.isArray(item?.tags)?item.tags:[],entityIds:Array.isArray(item?.entityIds)?item.entityIds:[]})) : [],
    clues: Array.isArray(data.clues) ? data.clues.map(item=>({...item,mysteryIds:Array.isArray(item?.mysteryIds)?item.mysteryIds.filter(id=>id&&id!==item.mysteryId):[]})) : [],
    reveals: Array.isArray(data.reveals) ? data.reveals : [],
    knowledge: Array.isArray(data.knowledge) ? data.knowledge : [],
    mapVersions: Array.isArray(data.mapVersions) ? data.mapVersions : [],
    mapMarkers: Array.isArray(data.mapMarkers) ? data.mapMarkers.map(item=>({...item,tags:Array.isArray(item?.tags)?item.tags:[]})) : [],
    workspace: Array.isArray(data.workspace) ? data.workspace : []
  };
}
