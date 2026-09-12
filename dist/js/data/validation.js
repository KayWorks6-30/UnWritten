import { ENTRY_TYPES, RELATION_TYPES, MAP_VARIANTS, KNOWLEDGE_STATES, SCHEMA_VERSION, validateEntity } from '../domain/schema.js';

const STORE_NAMES = ['entities','relations','media','settings','clues','reveals','knowledge','mapVersions','mapMarkers'];

function duplicateIds(items = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

function requireArray(data, key, errors) {
  if (!Array.isArray(data[key])) errors.push(`${key} must be an array.`);
}

function entityRefExists(id, ids) { return !id || ids.has(id); }

export function validateBackupSnapshot(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return ['Backup must be an object.'];
  if (data.format !== 'kayworks-world-bible-backup') errors.push('Backup format is not recognized.');
  if (!Number.isInteger(Number(data.schemaVersion))) errors.push('Backup schemaVersion must be a number.');
  else if (Number(data.schemaVersion) > SCHEMA_VERSION) errors.push(`Backup schema ${data.schemaVersion} is newer than this app supports (${SCHEMA_VERSION}).`);

  for (const store of STORE_NAMES) requireArray(data, store, errors);
  if (errors.length) return errors;

  for (const store of STORE_NAMES.filter(name => name !== 'settings')) {
    const dups = duplicateIds(data[store]);
    if (dups.length) errors.push(`${store} contains duplicate id${dups.length === 1 ? '' : 's'}: ${dups.slice(0,3).join(', ')}.`);
  }
  const settingKeys = new Set();
  for (const row of data.settings) {
    if (!row || typeof row.key !== 'string' || !row.key) errors.push('Every setting requires a string key.');
    else if (settingKeys.has(row.key)) errors.push(`settings contains duplicate key: ${row.key}.`);
    else settingKeys.add(row.key);
  }

  const entityIds = new Set(data.entities.map(e => e?.id).filter(Boolean));
  const entityById = new Map(data.entities.map(e => [e?.id, e]));
  const mediaIds = new Set(data.media.map(m => m?.id).filter(Boolean));
  const versionIds = new Set(data.mapVersions.map(v => v?.id).filter(Boolean));

  for (const entity of data.entities) {
    const entityErrors = validateEntity(entity);
    if (entityErrors.length) errors.push(`Entity ${entity?.id || '(missing id)'}: ${entityErrors.join(' ')}`);
    if (entity && entity.fields && typeof entity.fields !== 'object') errors.push(`Entity ${entity.id}: fields must be an object.`);
    const f = entity?.fields || {};
    const refs = [
      ['parentLocationId','location'],['parentBookId','book'],['parentChapterId','chapter'],['eraId','era'],
      ['storyEntityId',null],['scopeLocationId','location'],['parentMapId','map']
    ];
    for (const [key, expectedType] of refs) {
      const ref = f[key];
      if (!ref) continue;
      if ((key === 'parentLocationId' || key === 'parentMapId') && ref === entity.id) { errors.push(`Entity ${entity.id}: ${key} cannot point to itself.`); continue; }
      const target = entityById.get(ref);
      if (!target) errors.push(`Entity ${entity.id}: ${key} points to missing entity ${ref}.`);
      else if (expectedType && target.type !== expectedType) errors.push(`Entity ${entity.id}: ${key} must point to a ${expectedType}.`);
    }
  }

  for (const rel of data.relations) {
    if (!rel?.id) errors.push('Every relation requires an id.');
    if (!entityIds.has(rel?.fromId) || !entityIds.has(rel?.toId)) errors.push(`Relation ${rel?.id || '(missing id)'} has a missing endpoint.`);
    if (rel?.fromId === rel?.toId) errors.push(`Relation ${rel?.id || '(missing id)'} cannot link an entry to itself.`);
    if (!RELATION_TYPES.includes(rel?.type)) errors.push(`Relation ${rel?.id || '(missing id)'} has invalid type ${rel?.type || '(missing)'}.`);
  }

  for (const item of data.media) {
    if (!item?.id) errors.push('Every media record requires an id.');
    if (!Array.isArray(item?.tags)) errors.push(`Media ${item?.id || '(missing id)'}: tags must be an array.`);
    if (!Array.isArray(item?.entityIds)) errors.push(`Media ${item?.id || '(missing id)'}: entityIds must be an array.`);
    for (const ref of item?.entityIds || []) if (!entityIds.has(ref)) errors.push(`Media ${item.id}: linked entity ${ref} does not exist.`);
    if (!item?.blob && !item?.dataUrl && !item?.archivePath) errors.push(`Media ${item?.id || '(missing id)'} has no image payload.`);
  }

  for (const clue of data.clues) {
    if (!clue?.id || !entityIds.has(clue.mysteryId) || entityById.get(clue.mysteryId)?.type !== 'mystery') errors.push(`Clue ${clue?.id || '(missing id)'} has an invalid mystery reference.`);
    if (!entityRefExists(clue?.storyEntityId, entityIds)) errors.push(`Clue ${clue.id}: story entry is missing.`);
  }
  for (const reveal of data.reveals) {
    if (!reveal?.id) errors.push('Every reveal requires an id.');
    for (const key of ['mysteryId','targetEntityId','bookId','chapterId','sceneId']) if (!entityRefExists(reveal?.[key], entityIds)) errors.push(`Reveal ${reveal?.id || '(missing id)'}: ${key} is missing.`);
  }
  for (const knowledge of data.knowledge) {
    if (!knowledge?.id || !entityIds.has(knowledge.subjectEntityId)) errors.push(`Knowledge ${knowledge?.id || '(missing id)'} has an invalid subject.`);
    if (knowledge?.knowerKind === 'character' && (!entityIds.has(knowledge.knowerEntityId) || entityById.get(knowledge.knowerEntityId)?.type !== 'character')) errors.push(`Knowledge ${knowledge?.id || '(missing id)'} has an invalid character knower.`);
    if (!['character','reader'].includes(knowledge?.knowerKind)) errors.push(`Knowledge ${knowledge?.id || '(missing id)'} has invalid knowerKind.`);
    if (!KNOWLEDGE_STATES.includes(knowledge?.state)) errors.push(`Knowledge ${knowledge?.id || '(missing id)'} has invalid state.`);
    if (!entityRefExists(knowledge?.storyEntityId, entityIds)) errors.push(`Knowledge ${knowledge?.id || '(missing id)'} has a missing story entry.`);
  }
  for (const version of data.mapVersions) {
    if (!version?.id || !entityIds.has(version.mapId) || entityById.get(version.mapId)?.type !== 'map') errors.push(`Map version ${version?.id || '(missing id)'} has an invalid map reference.`);
    if (!mediaIds.has(version?.mediaId)) errors.push(`Map version ${version?.id || '(missing id)'} references missing media ${version?.mediaId || '(missing)'}.`);
    if (version?.variant && !MAP_VARIANTS.includes(version.variant)) errors.push(`Map version ${version.id} has invalid variant ${version.variant}.`);
  }
  for (const marker of data.mapMarkers) {
    if (!marker?.id || !versionIds.has(marker.mapVersionId)) errors.push(`Map marker ${marker?.id || '(missing id)'} has an invalid map version.`);
    if (!entityIds.has(marker?.locationId) || entityById.get(marker.locationId)?.type !== 'location') errors.push(`Map marker ${marker?.id || '(missing id)'} has an invalid location.`);
    const x = Number(marker?.x), y = Number(marker?.y);
    if (!Number.isFinite(x) || x < 0 || x > 100 || !Number.isFinite(y) || y < 0 || y > 100) errors.push(`Map marker ${marker?.id || '(missing id)'} has invalid coordinates.`);
  }

  const project = data.settings.find(row => row.key === 'project');
  if (project && (!project.value || typeof project.value !== 'object')) errors.push('Project settings value must be an object.');
  if (project?.value?.currentBookId && (!entityIds.has(project.value.currentBookId) || entityById.get(project.value.currentBookId)?.type !== 'book')) errors.push('Project currentBookId must point to a Book entry.');

  return errors;
}

export function assertValidBackupSnapshot(data) {
  const errors = validateBackupSnapshot(data);
  if (errors.length) throw new Error(`Backup validation failed: ${errors.slice(0,5).join(' ')}`);
  return data;
}

export { STORE_NAMES };
