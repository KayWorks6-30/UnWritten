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
  return next;
}

export function migrateBackupData(data) {
  if (!data || data.format !== 'kayworks-world-bible-backup') throw new Error('This is not a World Bible backup file.');
  return {
    ...data,
    schemaVersion: SCHEMA_VERSION,
    entities: (data.entities || []).map(migrateEntity),
    relations: Array.isArray(data.relations) ? data.relations : [],
    settings: Array.isArray(data.settings) ? data.settings : [],
    media: Array.isArray(data.media) ? data.media : [],
    clues: Array.isArray(data.clues) ? data.clues : [],
    reveals: Array.isArray(data.reveals) ? data.reveals : [],
    knowledge: Array.isArray(data.knowledge) ? data.knowledge : [],
    mapVersions: Array.isArray(data.mapVersions) ? data.mapVersions : [],
    mapMarkers: Array.isArray(data.mapMarkers) ? data.mapMarkers : []
  };
}
