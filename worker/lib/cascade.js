import { referenceFieldsForType } from '../../js/domain/schema.js';

const PARENT_KEYS = new Set(['parentLocationId','parentMapId','parentBookId','parentPartId','parentChapterId']);
const WORKSPACE_ENTITY_FIELDS = ['targetId','sceneId','linkedEntityId','entityId','characterId','bookId','partId','chapterId','pointId'];

function sameList(a=[],b=[]){ return a.length===b.length && a.every((value,index)=>value===b[index]); }
function updated(record,changes,stamp){ return {...record,...changes,updatedAt:stamp}; }
function workspaceWithData(record,data,stamp){ return updated(record,{data},stamp); }

function directWorkspaceEntityReference(item,id){
  const d=item?.data||{};
  if(item?.kind==='revision') return d.entityId===id;
  return WORKSPACE_ENTITY_FIELDS.some(field=>d[field]===id);
}

function expandWorkspaceDeletes(workspace,initialIds){
  const deleted=new Set(initialIds);
  let changed=true;
  while(changed){
    changed=false;
    for(const item of workspace||[]){
      if(deleted.has(item.id)) continue;
      const d=item.data||{};
      const dependsOnDeleted =
        (item.kind==='plotBeat' && deleted.has(d.threadId)) ||
        (item.kind==='calendarDate' && deleted.has(d.calendarId)) ||
        (item.kind==='whiteboardEdge' && (deleted.has(d.fromNodeId)||deleted.has(d.toNodeId)));
      if(dependsOnDeleted){ deleted.add(item.id); changed=true; }
    }
  }
  return deleted;
}

function mergeUpdates(records){
  const byId=new Map();
  for(const record of records||[]) if(record?.id) byId.set(record.id,record);
  return [...byId.values()];
}

export function planEntityCascade(data,id,stamp=new Date().toISOString()){
  const target=(data.entities||[]).find(entity=>entity.id===id)||null;
  if(!target) return {target:null,blocking:[]};

  const blocking=(data.entities||[]).filter(entity=>!entity.archivedAt&&entity.id!==id&&referenceFieldsForType(entity.type).some(spec=>PARENT_KEYS.has(spec.key)&&(spec.many?(entity.fields?.[spec.key]||[]).includes(id):entity.fields?.[spec.key]===id)));
  if(blocking.length) return {target,blocking};

  const entityUpdates=[];
  for(const entity of data.entities||[]){
    if(entity.id===id) continue;
    const fields={...(entity.fields||{})};
    let dirty=false;
    for(const spec of referenceFieldsForType(entity.type)){
      if(spec.many){
        const before=Array.isArray(fields[spec.key])?fields[spec.key]:[];
        const after=before.filter(value=>value!==id);
        if(!sameList(before,after)){ fields[spec.key]=after; dirty=true; }
      }else if(fields[spec.key]===id){ fields[spec.key]=''; dirty=true; }
    }
    if(dirty) entityUpdates.push(updated(entity,{fields},stamp));
  }

  const relationDeletes=[],relationUpdates=[];
  for(const relation of data.relations||[]){
    if(relation.fromId===id||relation.toId===id) relationDeletes.push(relation.id);
    else if(relation.eraId===id) relationUpdates.push(updated(relation,{eraId:null},stamp));
  }

  const clueDeletes=[],clueUpdates=[];
  for(const clue of data.clues||[]){
    if(clue.mysteryId===id||clue.storyEntityId===id) clueDeletes.push(clue.id);
    else if((clue.mysteryIds||[]).includes(id)) clueUpdates.push(updated(clue,{mysteryIds:(clue.mysteryIds||[]).filter(value=>value!==id)},stamp));
  }
  const revealDeletes=(data.reveals||[]).filter(reveal=>['mysteryId','targetEntityId','bookId','partId','chapterId','sceneId'].some(field=>reveal[field]===id)).map(reveal=>reveal.id);
  const knowledgeDeletes=(data.knowledge||[]).filter(item=>['subjectEntityId','knowerEntityId','storyEntityId'].some(field=>item[field]===id)).map(item=>item.id);
  const mapVersionDeletes=(data.mapVersions||[]).filter(version=>version.mapId===id).map(version=>version.id);
  const deletedVersionIds=new Set(mapVersionDeletes);

  const markerDeleteIds=new Set((data.mapMarkers||[]).filter(marker=>marker.locationId===id||deletedVersionIds.has(marker.mapVersionId)).map(marker=>marker.id));
  const markerUpdates=[];
  for(const marker of data.mapMarkers||[]){
    if(markerDeleteIds.has(marker.id)) continue;
    let dirty=false;
    const next={...marker};
    if(next.factionId===id){ next.factionId=null; dirty=true; }
    if((next.bookIds||[]).includes(id)){ next.bookIds=(next.bookIds||[]).filter(value=>value!==id); dirty=true; }
    if(dirty) markerUpdates.push(updated(next,{},stamp));
  }

  const initialWorkspaceDeletes=new Set((data.workspace||[]).filter(item=>directWorkspaceEntityReference(item,id)||(deletedVersionIds.has(item.data?.mapVersionId)&&['mapLayer','mapRoute'].includes(item.kind))).map(item=>item.id));
  const workspaceDeleteIds=expandWorkspaceDeletes(data.workspace||[],initialWorkspaceDeletes);
  const deletedLayerIds=new Set((data.workspace||[]).filter(item=>workspaceDeleteIds.has(item.id)&&item.kind==='mapLayer').map(item=>item.id));

  const markerUpdateMap=new Map(markerUpdates.map(marker=>[marker.id,marker]));
  for(const marker of data.mapMarkers||[]){
    if(markerDeleteIds.has(marker.id)||!deletedLayerIds.has(marker.layerId)) continue;
    const base=markerUpdateMap.get(marker.id)||marker;
    markerUpdateMap.set(marker.id,updated(base,{layerId:null},stamp));
  }

  const deletedClues=new Set(clueDeletes),deletedReveals=new Set(revealDeletes);
  const workspaceUpdates=[];
  for(const item of data.workspace||[]){
    if(workspaceDeleteIds.has(item.id)) continue;
    const d={...(item.data||{})};
    let dirty=false;
    if(item.kind==='plotBeat'){
      if(d.clueId&&deletedClues.has(d.clueId)){ d.clueId=null; dirty=true; }
      if(d.revealId&&deletedReveals.has(d.revealId)){ d.revealId=null; dirty=true; }
    }
    if(item.kind==='mapRoute'&&Array.isArray(d.markerIds)){
      const next=d.markerIds.filter(markerId=>!markerDeleteIds.has(markerId));
      if(!sameList(d.markerIds,next)){ d.markerIds=next; dirty=true; }
    }
    if(dirty) workspaceUpdates.push(workspaceWithData(item,d,stamp));
  }

  const entityUpdateMap=new Map(entityUpdates.map(entity=>[entity.id,entity]));
  const finalEntities=(data.entities||[]).filter(entity=>entity.id!==id).map(entity=>entityUpdateMap.get(entity.id)||entity);
  const finalVersions=(data.mapVersions||[]).filter(version=>!deletedVersionIds.has(version.id));
  const finalMarkers=(data.mapMarkers||[]).filter(marker=>!markerDeleteIds.has(marker.id)).map(marker=>markerUpdateMap.get(marker.id)||marker);
  const workspaceUpdateMap=new Map(workspaceUpdates.map(item=>[item.id,item]));
  const finalWorkspace=(data.workspace||[]).filter(item=>!workspaceDeleteIds.has(item.id)).map(item=>workspaceUpdateMap.get(item.id)||item);

  const candidateMediaIds=new Set((data.mapVersions||[]).filter(version=>deletedVersionIds.has(version.id)).map(version=>version.mediaId));
  const mediaDeletes=[],mediaUpdates=[];
  for(const media of data.media||[]){
    const cleanedEntityIds=(media.entityIds||[]).filter(entityId=>entityId!==id);
    let shouldDelete=false;
    if(candidateMediaIds.has(media.id)){
      const referenced =
        finalVersions.some(version=>version.mediaId===media.id) ||
        finalMarkers.some(marker=>marker.customMediaId===media.id) ||
        finalWorkspace.some(item=>item.kind==='mapLayer'&&item.data?.mediaId===media.id) ||
        finalEntities.some(entity=>['character','deity'].includes(entity.type)&&entity.fields?.portraitMediaId===media.id) ||
        cleanedEntityIds.length>0;
      shouldDelete=!referenced;
    }
    if(shouldDelete) mediaDeletes.push(media.id);
    else if(!sameList(media.entityIds||[],cleanedEntityIds)) mediaUpdates.push(updated(media,{entityIds:cleanedEntityIds},stamp));
  }

  const settingsUpdates=[];
  for(const setting of data.settings||[]){
    if(setting.key!=='project') continue;
    const value=structuredClone(setting.value||{}); let dirty=false;
    if(value.currentBookId===id){ value.currentBookId=null; dirty=true; }
    if(value.storyCompass?.protagonistIds?.includes(id)){ value.storyCompass.protagonistIds=value.storyCompass.protagonistIds.filter(value=>value!==id); dirty=true; }
    if(dirty) settingsUpdates.push(updated(setting,{value},stamp));
  }

  return {
    target,blocking,
    deletes:{relations:relationDeletes,clues:clueDeletes,reveals:revealDeletes,knowledge:knowledgeDeletes,mapVersions:mapVersionDeletes,mapMarkers:[...markerDeleteIds],workspace:[...workspaceDeleteIds],media:mediaDeletes},
    updates:{entities:entityUpdates,relations:relationUpdates,clues:clueUpdates,mapMarkers:mergeUpdates([...markerUpdateMap.values()]),workspace:mergeUpdates(workspaceUpdates),media:mediaUpdates,settings:settingsUpdates}
  };
}

export function planMapVersionCascade(data,id,stamp=new Date().toISOString()){
  const version=(data.mapVersions||[]).find(item=>item.id===id)||null;
  if(!version) return {version:null};
  const markerDeleteIds=new Set((data.mapMarkers||[]).filter(marker=>marker.mapVersionId===id).map(marker=>marker.id));
  const initialWorkspaceDeletes=new Set((data.workspace||[]).filter(item=>['mapLayer','mapRoute'].includes(item.kind)&&item.data?.mapVersionId===id).map(item=>item.id));
  const workspaceDeleteIds=expandWorkspaceDeletes(data.workspace||[],initialWorkspaceDeletes);
  const deletedLayerIds=new Set((data.workspace||[]).filter(item=>workspaceDeleteIds.has(item.id)&&item.kind==='mapLayer').map(item=>item.id));

  const markerUpdates=[];
  for(const marker of data.mapMarkers||[]){
    if(markerDeleteIds.has(marker.id)) continue;
    if(deletedLayerIds.has(marker.layerId)) markerUpdates.push(updated(marker,{layerId:null},stamp));
  }
  const workspaceUpdates=[];
  for(const item of data.workspace||[]){
    if(workspaceDeleteIds.has(item.id)||item.kind!=='mapRoute'||!Array.isArray(item.data?.markerIds)) continue;
    const markerIds=item.data.markerIds.filter(markerId=>!markerDeleteIds.has(markerId));
    if(!sameList(item.data.markerIds,markerIds)) workspaceUpdates.push(workspaceWithData(item,{...item.data,markerIds},stamp));
  }

  const survivingVersions=(data.mapVersions||[]).filter(item=>item.id!==id);
  const survivingMarkers=(data.mapMarkers||[]).filter(marker=>!markerDeleteIds.has(marker.id)).map(marker=>markerUpdates.find(update=>update.id===marker.id)||marker);
  const survivingWorkspace=(data.workspace||[]).filter(item=>!workspaceDeleteIds.has(item.id)).map(item=>workspaceUpdates.find(update=>update.id===item.id)||item);
  const media=(data.media||[]).find(item=>item.id===version.mediaId)||null;
  const mediaEntityIds=(media?.entityIds||[]).filter(entityId=>entityId!==version.mapId);
  const mediaReferenced = !media ? false :
    survivingVersions.some(item=>item.mediaId===media.id) ||
    survivingMarkers.some(marker=>marker.customMediaId===media.id) ||
    survivingWorkspace.some(item=>item.kind==='mapLayer'&&item.data?.mediaId===media.id) ||
    (data.entities||[]).some(entity=>['character','deity'].includes(entity.type)&&entity.fields?.portraitMediaId===media.id) ||
    mediaEntityIds.length>0;

  return {version,deletes:{mapMarkers:[...markerDeleteIds],workspace:[...workspaceDeleteIds],media:media&&!mediaReferenced?[media.id]:[]},updates:{mapMarkers:markerUpdates,workspace:workspaceUpdates}};
}

export function planWorkspaceDelete(workspace,mapMarkers,id,stamp=new Date().toISOString()){
  const target=(workspace||[]).find(item=>item.id===id)||null;
  if(!target) return {target:null,deletes:[],markerUpdates:[]};
  const deletes=expandWorkspaceDeletes(workspace||[],new Set([id]));
  const deletedLayerIds=new Set((workspace||[]).filter(item=>deletes.has(item.id)&&item.kind==='mapLayer').map(item=>item.id));
  const markerUpdates=(mapMarkers||[]).filter(marker=>deletedLayerIds.has(marker.layerId)).map(marker=>updated(marker,{layerId:null},stamp));
  return {target,deletes:[...deletes],markerUpdates};
}

export function cleanupPlotBeatLinks(workspace,{clueId=null,revealId=null}={},stamp=new Date().toISOString()){
  const updates=[];
  for(const item of workspace||[]){
    if(item.kind!=='plotBeat') continue;
    const data={...(item.data||{})}; let dirty=false;
    if(clueId&&data.clueId===clueId){ data.clueId=null; dirty=true; }
    if(revealId&&data.revealId===revealId){ data.revealId=null; dirty=true; }
    if(dirty) updates.push(workspaceWithData(item,data,stamp));
  }
  return updates;
}
