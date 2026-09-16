import { referenceFieldsForType } from './schema.js';

function edge(sourceStore,sourceId,sourceField,targetEntityId,{sourceEntityId=null,kind='Structured reference'}={}){
  if(!targetEntityId) return null;
  return {sourceStore,sourceId,sourceField,targetEntityId,sourceEntityId,kind};
}
function add(out,value,...args){
  if(Array.isArray(value)){ for(const item of value) add(out,item,...args); return; }
  const item=edge(...args.slice(0,3),value,args[3]||{}); if(item) out.push(item);
}
function scalar(out,store,id,field,value,options={}){ const item=edge(store,id,field,value,options); if(item) out.push(item); }
function list(out,store,id,field,values,options={}){ for(const value of Array.isArray(values)?values:[]) scalar(out,store,id,field,value,options); }

export function referenceEdgesForRecord(store,record){
  if(!record) return [];
  const out=[];
  if(store==='entities'){
    for(const spec of referenceFieldsForType(record.type)){
      const value=record.fields?.[spec.key];
      if(spec.many) list(out,'entities',record.id,spec.key,value,{sourceEntityId:record.id,kind:spec.role||'Entity field'});
      else scalar(out,'entities',record.id,spec.key,value,{sourceEntityId:record.id,kind:spec.role||'Entity field'});
    }
  } else if(store==='relations'){
    scalar(out,'relations',record.id,'fromId',record.fromId,{sourceEntityId:record.toId||null,kind:'Relationship'});
    scalar(out,'relations',record.id,'toId',record.toId,{sourceEntityId:record.fromId||null,kind:'Relationship'});
    scalar(out,'relations',record.id,'eraId',record.eraId,{sourceEntityId:record.fromId||null,kind:'Relationship era'});
  } else if(store==='clues'){
    scalar(out,'clues',record.id,'mysteryId',record.mysteryId,{sourceEntityId:record.mysteryId||null,kind:'Clue'});
    list(out,'clues',record.id,'mysteryIds',record.mysteryIds,{sourceEntityId:record.mysteryId||null,kind:'Clue'});
    scalar(out,'clues',record.id,'storyEntityId',record.storyEntityId,{sourceEntityId:record.mysteryId||null,kind:'Clue story point'});
  } else if(store==='reveals'){
    const sourceEntityId=record.targetEntityId||record.mysteryId||null;
    for(const field of ['mysteryId','targetEntityId','bookId','partId','chapterId','sceneId']) scalar(out,'reveals',record.id,field,record[field],{sourceEntityId,kind:'Reveal'});
  } else if(store==='knowledge'){
    scalar(out,'knowledge',record.id,'subjectEntityId',record.subjectEntityId,{sourceEntityId:record.subjectEntityId||null,kind:'Knowledge'});
    scalar(out,'knowledge',record.id,'knowerEntityId',record.knowerEntityId,{sourceEntityId:record.subjectEntityId||null,kind:'Knowledge knower'});
    scalar(out,'knowledge',record.id,'storyEntityId',record.storyEntityId,{sourceEntityId:record.subjectEntityId||null,kind:'Knowledge story point'});
  } else if(store==='media'){
    list(out,'media',record.id,'entityIds',record.entityIds,{sourceEntityId:null,kind:'Media attachment'});
  } else if(store==='mapVersions'){
    scalar(out,'mapVersions',record.id,'mapId',record.mapId,{sourceEntityId:record.mapId||null,kind:'Map version'});
  } else if(store==='mapMarkers'){
    scalar(out,'mapMarkers',record.id,'locationId',record.locationId,{sourceEntityId:record.locationId||null,kind:'Map marker'});
    scalar(out,'mapMarkers',record.id,'factionId',record.factionId,{sourceEntityId:record.locationId||null,kind:'Map marker faction'});
    list(out,'mapMarkers',record.id,'bookIds',record.bookIds,{sourceEntityId:record.locationId||null,kind:'Map marker book'});
  } else if(store==='workspace' && record.kind!=='revision'){
    const d=record.data||{};
    const fields=['targetId','sceneId','linkedEntityId','entityId','characterId','bookId','partId','chapterId','pointId'];
    for(const field of fields) scalar(out,'workspace',record.id,field,d[field],{sourceEntityId:d.linkedEntityId||d.entityId||d.characterId||d.sceneId||null,kind:record.kind||'Workspace'});
  } else if(store==='settings' && record.key==='project'){
    scalar(out,'settings',record.key,'currentBookId',record.value?.currentBookId,{kind:'Project setting'});
    list(out,'settings',record.key,'storyCompass.protagonistIds',record.value?.storyCompass?.protagonistIds,{kind:'Project setting'});
  }
  return [...new Map(out.map(item=>[[item.sourceStore,item.sourceId,item.sourceField,item.targetEntityId].join('\u001f'),item])).values()];
}

export function buildReferenceIndex(snapshot={}){
  const out=[];
  for(const store of ['entities','relations','settings','media','clues','reveals','knowledge','mapVersions','mapMarkers','workspace']){
    for(const record of snapshot[store]||[]) out.push(...referenceEdgesForRecord(store,record));
  }
  return out;
}
