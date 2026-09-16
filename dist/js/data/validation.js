import { RELATION_TYPES, RELATION_STATUSES, MAP_VARIANTS, KNOWLEDGE_STATES, SCHEMA_VERSION, WORKSPACE_KINDS, STORY_POINT_TYPES, referenceFieldsForType, validateEntity } from '../domain/schema.js';

const STORE_NAMES = ['entities','relations','media','settings','clues','reveals','knowledge','mapVersions','mapMarkers','workspace'];

function duplicateIds(items = []) {
  const seen = new Set(), duplicates = new Set();
  for (const item of items) { if (!item?.id) continue; if (seen.has(item.id)) duplicates.add(item.id); seen.add(item.id); }
  return [...duplicates];
}
function requireArray(data,key,errors){ if(!Array.isArray(data[key])) errors.push(`${key} must be an array.`); }
function entityRefExists(id,ids){ return !id || ids.has(id); }
function expectEntity(entityById,id,types,label,errors){
  if(!id) return null;
  const target=entityById.get(id); if(!target){ errors.push(`${label} points to missing entity ${id}.`); return null; }
  if(types && !types.includes(target.type)) errors.push(`${label} must point to ${types.join(' or ')}.`);
  return target;
}
function cycleErrors(entities,key,type,label){
  const errors=[], byId=new Map(entities.filter(e=>e?.type===type).map(e=>[e.id,e]));
  for(const start of byId.values()){
    const seen=new Set([start.id]); let current=start, guard=0;
    while(current?.fields?.[key]&&guard++<100){
      const next=current.fields[key]; if(seen.has(next)){ errors.push(`${label} hierarchy contains a cycle involving ${start.name||start.id}.`); break; }
      seen.add(next); current=byId.get(next); if(!current) break;
    }
  }
  return errors;
}

function validateWorkspaceItem(item,{entityById,entityIds,versionIds,markerIds,mediaIds,clueIds,revealIds,workspaceById},errors){
  const id=item?.id||'(missing id)';
  if(!item?.id) errors.push('Every workspace record requires an id.');
  if(!WORKSPACE_KINDS.includes(item?.kind)) errors.push(`Workspace ${id} has invalid kind ${item?.kind||'(missing)'}.`);
  if(!item?.data||typeof item.data!=='object'||Array.isArray(item.data)) errors.push(`Workspace ${id}: data must be an object.`);
  const d=item?.data||{};
  const entity=(ref,types,label)=>expectEntity(entityById,ref,types,`Workspace ${id}: ${label}`,errors);
  if(item?.kind==='plotThread' && d.bookId) entity(d.bookId,['book'],'bookId');
  if(item?.kind==='plotBeat'){
    const thread=workspaceById.get(d.threadId); if(!thread||thread.kind!=='plotThread') errors.push(`Workspace ${id}: plotBeat threadId must point to a plotThread.`);
    entity(d.sceneId,['scene'],'sceneId'); if(d.linkedEntityId&&!entityIds.has(d.linkedEntityId)) errors.push(`Workspace ${id}: linked entity does not exist.`); if(d.clueId&&!clueIds.has(d.clueId)) errors.push(`Workspace ${id}: linked clue does not exist.`); if(d.revealId&&!revealIds.has(d.revealId)) errors.push(`Workspace ${id}: linked reveal does not exist.`);
  }
  if(['contextNote','task'].includes(item?.kind) && d.targetId && !entityIds.has(d.targetId)) errors.push(`Workspace ${id}: targetId does not exist.`);
  if(item?.kind==='calendarDate'){
    const cal=workspaceById.get(d.calendarId); if(!cal||cal.kind!=='calendar') errors.push(`Workspace ${id}: calendarId must point to a calendar.`);
    if(d.entityId) entity(d.entityId,['event','scene'],'calendar date entityId');
  }
  if(item?.kind==='mapLayer'){
    if(!versionIds.has(d.mapVersionId)) errors.push(`Workspace ${id}: map layer version does not exist.`);
    if(d.mediaId&&!mediaIds.has(d.mediaId)) errors.push(`Workspace ${id}: map layer media does not exist.`);
  }
  if(item?.kind==='mapRoute'){
    if(!versionIds.has(d.mapVersionId)) errors.push(`Workspace ${id}: route map version does not exist.`);
    entity(d.characterId,['character'],'characterId'); if(d.bookId) entity(d.bookId,['book'],'bookId');
    for(const markerId of d.markerIds||[]) if(!markerIds.has(markerId)) errors.push(`Workspace ${id}: route marker ${markerId} does not exist.`);
  }
  if(item?.kind==='whiteboardNode'&&d.linkedEntityId&&!entityIds.has(d.linkedEntityId)) errors.push(`Workspace ${id}: whiteboard linked entity does not exist.`);
  if(item?.kind==='whiteboardEdge'){
    for(const [key,ref] of [['fromNodeId',d.fromNodeId],['toNodeId',d.toNodeId]]){ const node=workspaceById.get(ref); if(!node||node.kind!=='whiteboardNode') errors.push(`Workspace ${id}: ${key} must point to a whiteboardNode.`); }
  }
  if(item?.kind==='manuscriptDocument'){
    if(d.bookId) entity(d.bookId,['book'],'bookId'); if(d.partId) entity(d.partId,['part'],'partId'); if(d.chapterId) entity(d.chapterId,['chapter'],'chapterId'); if(d.sceneId) entity(d.sceneId,['scene'],'sceneId');
  }
  if(item?.kind==='readerProfile'&&d.pointId) entity(d.pointId,STORY_POINT_TYPES,'pointId');
}

export function validateBackupSnapshot(data) {
  const errors=[];
  if(!data||typeof data!=='object') return ['Backup must be an object.'];
  if(data.format!=='kayworks-world-bible-backup') errors.push('Backup format is not recognized.');
  if(!Number.isInteger(Number(data.schemaVersion))) errors.push('Backup schemaVersion must be a number.');
  else if(Number(data.schemaVersion)<1) errors.push('Backup schemaVersion must be at least 1.');
  else if(Number(data.schemaVersion)>SCHEMA_VERSION) errors.push(`Backup schema ${data.schemaVersion} is newer than this app supports (${SCHEMA_VERSION}).`);
  for(const store of STORE_NAMES) requireArray(data,store,errors);
  if(errors.length) return errors;

  for(const store of STORE_NAMES.filter(name=>name!=='settings')){ const dups=duplicateIds(data[store]); if(dups.length) errors.push(`${store} contains duplicate id${dups.length===1?'':'s'}: ${dups.slice(0,3).join(', ')}.`); }
  const settingKeys=new Set();
  for(const row of data.settings){ if(!row||typeof row.key!=='string'||!row.key) errors.push('Every setting requires a string key.'); else if(settingKeys.has(row.key)) errors.push(`settings contains duplicate key: ${row.key}.`); else settingKeys.add(row.key); }

  const entityIds=new Set(data.entities.map(e=>e?.id).filter(Boolean));
  const entityById=new Map(data.entities.map(e=>[e?.id,e]));
  const mediaIds=new Set(data.media.map(m=>m?.id).filter(Boolean));
  const versionIds=new Set(data.mapVersions.map(v=>v?.id).filter(Boolean));
  const markerIds=new Set(data.mapMarkers.map(v=>v?.id).filter(Boolean));
  const clueIds=new Set(data.clues.map(v=>v?.id).filter(Boolean));
  const revealIds=new Set(data.reveals.map(v=>v?.id).filter(Boolean));
  const workspaceById=new Map(data.workspace.map(w=>[w?.id,w]));

  for(const entity of data.entities){
    const entityErrors=validateEntity(entity); if(entityErrors.length) errors.push(`Entity ${entity?.id||'(missing id)'}: ${entityErrors.join(' ')}`);
    if(entity&&entity.fields&&typeof entity.fields!=='object') errors.push(`Entity ${entity.id}: fields must be an object.`);
    const f=entity?.fields||{};
    for(const spec of referenceFieldsForType(entity?.type)){
      const value=f[spec.key];
      if(spec.many){
        if(value!==undefined&&!Array.isArray(value)) errors.push(`Entity ${entity.id}: ${spec.key} must be an array.`);
        for(const ref of Array.isArray(value)?value:[]) expectEntity(entityById,ref,spec.types,`Entity ${entity.id}: ${spec.key}`,errors);
      } else if(value){
        if(['parentLocationId','parentMapId'].includes(spec.key)&&value===entity.id){ errors.push(`Entity ${entity.id}: ${spec.key} cannot point to itself.`); continue; }
        expectEntity(entityById,value,spec.types,`Entity ${entity.id}: ${spec.key}`,errors);
      }
    }
    if(entity?.type==='chapter'&&f.parentPartId){ const part=entityById.get(f.parentPartId); if(part?.type==='part'&&f.parentBookId&&part.fields?.parentBookId!==f.parentBookId) errors.push(`Entity ${entity.id}: parentPartId belongs to a different book than parentBookId.`); }
    if(['character','deity'].includes(entity?.type)&&f.portraitMediaId&&!mediaIds.has(f.portraitMediaId)) errors.push(`Entity ${entity.id}: portraitMediaId references missing media ${f.portraitMediaId}.`);
  }
  errors.push(...cycleErrors(data.entities,'parentLocationId','location','Location'),...cycleErrors(data.entities,'parentMapId','map','Map'));

  for(const rel of data.relations){
    if(!rel?.id) errors.push('Every relation requires an id.');
    if(!entityIds.has(rel?.fromId)||!entityIds.has(rel?.toId)) errors.push(`Relation ${rel?.id||'(missing id)'} has a missing endpoint.`);
    if(rel?.fromId===rel?.toId) errors.push(`Relation ${rel?.id||'(missing id)'} cannot link an entry to itself.`);
    if(!RELATION_TYPES.includes(rel?.type)) errors.push(`Relation ${rel?.id||'(missing id)'} has invalid type ${rel?.type||'(missing)'}.`);
    if(rel?.status&&!RELATION_STATUSES.includes(rel.status)) errors.push(`Relation ${rel?.id||'(missing id)'} has invalid status ${rel.status}.`);
    if(rel?.eraId) expectEntity(entityById,rel.eraId,['era'],`Relation ${rel.id}: eraId`,errors);
  }

  for(const item of data.media){
    if(!item?.id) errors.push('Every media record requires an id.');
    if(!Array.isArray(item?.tags)) errors.push(`Media ${item?.id||'(missing id)'}: tags must be an array.`);
    if(!Array.isArray(item?.entityIds)) errors.push(`Media ${item?.id||'(missing id)'}: entityIds must be an array.`);
    for(const ref of item?.entityIds||[]) if(!entityIds.has(ref)) errors.push(`Media ${item.id}: linked entity ${ref} does not exist.`);
    if(!item?.blob&&!item?.dataUrl&&!item?.archivePath) errors.push(`Media ${item?.id||'(missing id)'} has no image payload.`);
  }

  for(const clue of data.clues){
    if(!clue?.id||!entityIds.has(clue.mysteryId)||entityById.get(clue.mysteryId)?.type!=='mystery') errors.push(`Clue ${clue?.id||'(missing id)'} has an invalid mystery reference.`);
    if(clue?.storyEntityId){ const t=entityById.get(clue.storyEntityId); if(!t||!['part','chapter','scene'].includes(t.type)) errors.push(`Clue ${clue.id}: story entry must be a Part, Chapter, or Scene.`); }
    if(clue?.mysteryIds!==undefined&&!Array.isArray(clue.mysteryIds)) errors.push(`Clue ${clue.id}: mysteryIds must be an array.`);
    for(const ref of clue?.mysteryIds||[]) expectEntity(entityById,ref,['mystery'],`Clue ${clue.id}: mysteryIds`,errors);
  }
  for(const reveal of data.reveals){
    if(!reveal?.id) errors.push('Every reveal requires an id.');
    if(reveal?.mysteryId) expectEntity(entityById,reveal.mysteryId,['mystery'],`Reveal ${reveal.id}: mysteryId`,errors);
    if(reveal?.targetEntityId) expectEntity(entityById,reveal.targetEntityId,null,`Reveal ${reveal.id}: targetEntityId`,errors);
    if(reveal?.bookId) expectEntity(entityById,reveal.bookId,['book'],`Reveal ${reveal.id}: bookId`,errors);
    if(reveal?.partId) expectEntity(entityById,reveal.partId,['part'],`Reveal ${reveal.id}: partId`,errors);
    if(reveal?.chapterId) expectEntity(entityById,reveal.chapterId,['chapter'],`Reveal ${reveal.id}: chapterId`,errors);
    if(reveal?.sceneId) expectEntity(entityById,reveal.sceneId,['scene'],`Reveal ${reveal.id}: sceneId`,errors);
    if(reveal?.partId&&reveal?.bookId&&entityById.get(reveal.partId)?.fields?.parentBookId!==reveal.bookId) errors.push(`Reveal ${reveal.id}: part does not belong to selected book.`);
    if(reveal?.chapterId&&reveal?.bookId&&entityById.get(reveal.chapterId)?.fields?.parentBookId!==reveal.bookId) errors.push(`Reveal ${reveal.id}: chapter does not belong to selected book.`);
    if(reveal?.chapterId&&reveal?.partId&&entityById.get(reveal.chapterId)?.fields?.parentPartId!==reveal.partId) errors.push(`Reveal ${reveal.id}: chapter does not belong to selected part.`);
    if(reveal?.sceneId&&reveal?.chapterId&&entityById.get(reveal.sceneId)?.fields?.parentChapterId!==reveal.chapterId) errors.push(`Reveal ${reveal.id}: scene does not belong to selected chapter.`);
  }
  const knowledgePoints=new Map();
  for(const knowledge of data.knowledge){
    if(!knowledge?.id||!entityIds.has(knowledge.subjectEntityId)) errors.push(`Knowledge ${knowledge?.id||'(missing id)'} has an invalid subject.`);
    if(knowledge?.knowerKind==='character'&&(!entityIds.has(knowledge.knowerEntityId)||entityById.get(knowledge.knowerEntityId)?.type!=='character')) errors.push(`Knowledge ${knowledge?.id||'(missing id)'} has an invalid character knower.`);
    if(!['character','reader'].includes(knowledge?.knowerKind)) errors.push(`Knowledge ${knowledge?.id||'(missing id)'} has invalid knowerKind.`);
    if(!KNOWLEDGE_STATES.includes(knowledge?.state)) errors.push(`Knowledge ${knowledge?.id||'(missing id)'} has invalid state.`);
    if(knowledge?.storyEntityId){ const t=entityById.get(knowledge.storyEntityId); if(!t||!STORY_POINT_TYPES.includes(t.type)) errors.push(`Knowledge ${knowledge.id}: story entry must be a Book, Part, Chapter, or Scene.`); }
    const pointKey=[knowledge?.subjectEntityId||'',knowledge?.knowerKind||'',knowledge?.knowerEntityId||'',knowledge?.storyEntityId||''].join('\u001f');
    if(knowledgePoints.has(pointKey)) errors.push(`Knowledge ${knowledge?.id||'(missing id)'} duplicates the same subject, knower, and story point as ${knowledgePoints.get(pointKey)}.`); else knowledgePoints.set(pointKey,knowledge?.id||'(missing id)');
  }
  for(const version of data.mapVersions){
    if(!version?.id||!entityIds.has(version.mapId)||entityById.get(version.mapId)?.type!=='map') errors.push(`Map version ${version?.id||'(missing id)'} has an invalid map reference.`);
    if(!mediaIds.has(version?.mediaId)) errors.push(`Map version ${version?.id||'(missing id)'} references missing media ${version?.mediaId||'(missing)'}.`);
    if(version?.variant&&!MAP_VARIANTS.includes(version.variant)) errors.push(`Map version ${version.id} has invalid variant ${version.variant}.`);
  }
  for(const marker of data.mapMarkers){
    if(!marker?.id||!versionIds.has(marker.mapVersionId)) errors.push(`Map marker ${marker?.id||'(missing id)'} has an invalid map version.`);
    if(!entityIds.has(marker?.locationId)||entityById.get(marker.locationId)?.type!=='location') errors.push(`Map marker ${marker?.id||'(missing id)'} has an invalid location.`);
    const x=Number(marker?.x),y=Number(marker?.y); if(!Number.isFinite(x)||x<0||x>100||!Number.isFinite(y)||y<0||y>100) errors.push(`Map marker ${marker?.id||'(missing id)'} has invalid coordinates.`);
    if(!Array.isArray(marker?.tags||[])) errors.push(`Map marker ${marker?.id||'(missing id)'} tags must be an array.`);
    if(marker?.customMediaId&&!mediaIds.has(marker.customMediaId)) errors.push(`Map marker ${marker.id} custom media is missing.`);
    if(marker?.layerId){ const layer=workspaceById.get(marker.layerId); if(!layer||layer.kind!=='mapLayer') errors.push(`Map marker ${marker.id} layerId must point to a mapLayer.`); }
    if(marker?.factionId) expectEntity(entityById,marker.factionId,['organization','civilization','religion'],`Map marker ${marker.id}: factionId`,errors);
    for(const bookId of marker?.bookIds||[]) expectEntity(entityById,bookId,['book'],`Map marker ${marker.id}: bookId`,errors);
    if(marker?.active!==undefined&&typeof marker.active!=='boolean') errors.push(`Map marker ${marker.id} active must be boolean.`);
  }
  for(const item of data.workspace) validateWorkspaceItem(item,{entityById,entityIds,versionIds,markerIds,mediaIds,clueIds,revealIds,workspaceById},errors);

  const project=data.settings.find(row=>row.key==='project');
  if(project&&(!project.value||typeof project.value!=='object')) errors.push('Project settings value must be an object.');
  if(project?.value?.currentBookId&&(!entityIds.has(project.value.currentBookId)||entityById.get(project.value.currentBookId)?.type!=='book')) errors.push('Project currentBookId must point to a Book entry.');

  return errors;
}

export function assertValidBackupSnapshot(data){ const errors=validateBackupSnapshot(data); if(errors.length) throw new Error(`Backup validation failed: ${errors.slice(0,8).join(' ')}`); return data; }
export { STORE_NAMES };
