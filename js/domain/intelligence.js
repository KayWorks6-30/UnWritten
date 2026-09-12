import { compareStoryRefs, storyOrder, storyPath } from './story.js';

const idOf = value => typeof value === 'string' ? value : value?.id;
const entityMap = entities => new Map((entities||[]).map(e=>[e.id,e]));

export function storyPointId(record){
  return record?.sceneId || record?.chapterId || record?.bookId || record?.storyEntityId || null;
}

export function isAtOrBefore(pointId, candidateId, entities){
  if(!candidateId) return true;
  if(!pointId) return false;
  return compareStoryRefs(candidateId,pointId,entities) <= 0;
}

export function knowledgeAtPoint({knowledge=[],entities=[],characterId,pointId}){
  const rows=knowledge.filter(k=>k.knowerKind==='character'&&k.knowerEntityId===characterId&&isAtOrBefore(pointId,k.storyEntityId,entities));
  const latest=new Map();
  for(const row of rows){
    const prior=latest.get(row.subjectEntityId);
    if(!prior || compareStoryRefs(prior.storyEntityId,row.storyEntityId,entities)<=0) latest.set(row.subjectEntityId,row);
  }
  const byState={};
  for(const row of latest.values()) (byState[row.state] ||= []).push(row);
  return { rows:[...latest.values()].sort((a,b)=>String(a.state).localeCompare(String(b.state))), byState };
}

export function readerKnowledgeAtPoint({knowledge=[],reveals=[],entities=[],pointId}){
  const direct=knowledge.filter(k=>k.knowerKind==='reader'&&isAtOrBefore(pointId,k.storyEntityId,entities));
  const revealRows=reveals.filter(r=>isAtOrBefore(pointId,storyPointId(r),entities));
  return { direct, reveals:revealRows };
}

export function knowledgeAsymmetryAtPoint({knowledge=[],reveals=[],entities=[],characterId,pointId}){
  const character=knowledgeAtPoint({knowledge,entities,characterId,pointId}).rows;
  const reader=readerKnowledgeAtPoint({knowledge,reveals,entities,pointId});
  const characterBySubject=new Map(character.map(row=>[row.subjectEntityId,row]));
  const readerSubjects=new Set([
    ...reader.direct.map(row=>row.subjectEntityId),
    ...reader.reveals.map(row=>row.targetEntityId).filter(Boolean)
  ]);
  const characterKnowsReaderDoesNot=character.filter(row=>['Knows truth','Partial truth'].includes(row.state)&&!readerSubjects.has(row.subjectEntityId));
  const readerKnowsCharacterDoesNot=[...readerSubjects].filter(subjectId=>{const row=characterBySubject.get(subjectId);return !row||['Unaware','Incorrect belief','Forgotten','Rejected truth','Unknown'].includes(row.state);});
  const falseBeliefs=character.filter(row=>['Incorrect belief','Rejected truth'].includes(row.state));
  return {characterKnowsReaderDoesNot,readerKnowsCharacterDoesNot,falseBeliefs};
}

export function readerKnowledgeTimeline({knowledge=[],reveals=[],clues=[],entities=[]}){
  const rows=[
    ...knowledge.filter(k=>k.knowerKind==='reader').map(k=>({kind:'Knowledge',storyId:k.storyEntityId,title:k.belief||'Reader knowledge',record:k})),
    ...reveals.map(r=>({kind:'Reveal',storyId:storyPointId(r),title:r.title||'Reveal',record:r})),
    ...clues.map(c=>({kind:c.kind||'Clue',storyId:c.storyEntityId,title:c.label||c.kind||'Clue',record:c}))
  ];
  return rows.sort((a,b)=>compareStoryRefs(a.storyId,b.storyId,entities));
}

export function mysteryProgression(mysteryId,{clues=[],reveals=[],entities=[]}){
  const rows=[
    ...clues.filter(c=>c.mysteryId===mysteryId||(c.mysteryIds||[]).includes(mysteryId)).map(c=>({kind:c.kind||'Clue',storyId:c.storyEntityId,title:c.label||'Clue',record:c})),
    ...reveals.filter(r=>r.mysteryId===mysteryId).map(r=>({kind:'Reveal',storyId:storyPointId(r),title:r.title||'Reveal',record:r}))
  ].sort((a,b)=>compareStoryRefs(a.storyId,b.storyId,entities));
  const clueCount=rows.filter(r=>r.kind!=='Reveal').length;
  const revealCount=rows.filter(r=>r.kind==='Reveal').length;
  return {rows,clueCount,revealCount,hasReveal:revealCount>0};
}

export function mysteryAnalysis(mysteryId,{clues=[],reveals=[],entities=[]}){
  const progression=mysteryProgression(mysteryId,{clues,reveals,entities});
  const storyRows=progression.rows.filter(row=>row.storyId);
  const clueRows=progression.rows.filter(row=>row.kind!=='Reveal');
  const revealRows=progression.rows.filter(row=>row.kind==='Reveal');
  const first=storyRows[0]||null, last=storyRows.at(-1)||null;
  const firstReveal=revealRows.find(row=>row.storyId)||null;
  const cluesBeforeReveal=firstReveal?clueRows.filter(row=>row.storyId&&compareStoryRefs(row.storyId,firstReveal.storyId,entities)<0):clueRows;
  const books=new Set(storyRows.map(row=>{const entity=entities.find(e=>e.id===row.storyId);if(entity?.type==='book')return entity.id;if(entity?.type==='chapter')return entity.fields?.parentBookId||null;if(entity?.type==='scene'){const chapter=entities.find(e=>e.id===entity.fields?.parentChapterId);return chapter?.fields?.parentBookId||null;}return null;}).filter(Boolean));
  const unresolvedBooks=[...books].filter(bookId=>!revealRows.some(row=>row.storyId&&isAtOrBefore(bookId,row.storyId,entities)));
  let longestGap=0;
  for(let i=1;i<storyRows.length;i++){
    const a=storyOrder(entities.find(e=>e.id===storyRows[i-1].storyId),entities),b=storyOrder(entities.find(e=>e.id===storyRows[i].storyId),entities);
    const flatA=(a[0]||0)*1000000+(a[1]||0)*1000+(a[2]||0),flatB=(b[0]||0)*1000000+(b[1]||0)*1000+(b[2]||0);
    if(Number.isFinite(flatA)&&Number.isFinite(flatB)) longestGap=Math.max(longestGap,Math.max(0,flatB-flatA));
  }
  return {...progression,first,last,firstReveal,cluesBeforeReveal,unresolvedBooks,longestGap,insufficientSetup:Boolean(firstReveal&&cluesBeforeReveal.length===0)};
}

function objectContainsId(value,targetId){
  if(value===targetId) return true;
  if(Array.isArray(value)) return value.some(v=>objectContainsId(v,targetId));
  if(value&&typeof value==='object') return Object.values(value).some(v=>objectContainsId(v,targetId));
  return false;
}

export function backlinksFor(targetId,data){
  const out=[];
  for(const rel of data.relations||[]) if(rel.fromId===targetId||rel.toId===targetId) out.push({kind:'Relationship',id:rel.id,sourceId:rel.fromId===targetId?rel.toId:rel.fromId,record:rel});
  for(const entity of data.entities||[]) if(entity.id!==targetId&&objectContainsId(entity.fields,targetId)) out.push({kind:'Entity field',id:entity.id,sourceId:entity.id,record:entity});
  for(const clue of data.clues||[]) if(objectContainsId(clue,targetId)) out.push({kind:'Clue',id:clue.id,sourceId:clue.mysteryId,record:clue});
  for(const reveal of data.reveals||[]) if(objectContainsId(reveal,targetId)) out.push({kind:'Reveal',id:reveal.id,sourceId:reveal.targetEntityId||reveal.mysteryId,record:reveal});
  for(const row of data.knowledge||[]) if(objectContainsId(row,targetId)) out.push({kind:'Knowledge',id:row.id,sourceId:row.subjectEntityId,record:row});
  for(const media of data.media||[]) if((media.entityIds||[]).includes(targetId)) out.push({kind:'Media',id:media.id,sourceId:media.id,record:media});
  for(const marker of data.mapMarkers||[]) if(marker.locationId===targetId) out.push({kind:'Map marker',id:marker.id,sourceId:marker.mapVersionId,record:marker});
  for(const item of data.workspace||[]) if(item.kind!=='revision'&&objectContainsId(item.data,targetId)) out.push({kind:item.kind,id:item.id,sourceId:item.id,record:item});
  return out;
}

function detectParentCycles(entities,key,type,label){
  const byId=entityMap(entities.filter(e=>e.type===type)); const warnings=[];
  for(const entity of byId.values()){
    const seen=new Set([entity.id]); let current=entity; let guard=0;
    while(current?.fields?.[key]&&guard++<100){
      const parentId=current.fields[key];
      if(seen.has(parentId)){ warnings.push({severity:'error',code:`${type}-cycle`,entityId:entity.id,message:`${label} hierarchy contains a cycle involving ${entity.name}.`}); break; }
      seen.add(parentId); current=byId.get(parentId);
      if(!current) break;
    }
  }
  return warnings;
}

export function continuityWarnings(data){
  const entities=data.entities||[], relations=data.relations||[], knowledge=data.knowledge||[], clues=data.clues||[], reveals=data.reveals||[];
  const warnings=[...detectParentCycles(entities,'parentLocationId','location','Location'),...detectParentCycles(entities,'parentMapId','map','Map')];
  const active=entities.filter(e=>!e.archivedAt); const byId=entityMap(entities);
  const numeric=value=>{const n=Number(value);return value!==''&&value!==null&&value!==undefined&&Number.isFinite(n)?n:null;};

  const events=active.filter(e=>e.type==='event');
  for(const event of events){
    const start=numeric(event.fields?.dateStart), finish=numeric(event.fields?.dateEnd);
    if(start!==null&&finish!==null&&start>finish) warnings.push({severity:'error',code:'event-range',entityId:event.id,message:`${event.name} ends before it starts.`});
  }
  const eventsByName=new Map();
  for(const event of events){ const key=String(event.name||'').trim().toLowerCase(); if(!key)continue; const arr=eventsByName.get(key)||[];arr.push(event);eventsByName.set(key,arr); }
  for(const same of eventsByName.values()) if(same.length>1){ const dates=new Set(same.map(e=>`${e.fields?.dateStart??''}|${e.fields?.dateEnd??''}|${e.fields?.dateText??''}`)); if(dates.size>1) warnings.push({severity:'warning',code:'event-date-conflict',entityId:same[0].id,message:`${same[0].name} has multiple records with conflicting dates.`}); }

  const chapters=active.filter(e=>e.type==='chapter');
  for(const parentId of new Set(chapters.map(c=>c.fields?.parentBookId).filter(Boolean))){
    const seen=new Map(); for(const c of chapters.filter(x=>x.fields?.parentBookId===parentId)){ const n=String(c.fields?.number||''); if(!n) continue; if(seen.has(n)) warnings.push({severity:'warning',code:'chapter-order',entityId:c.id,message:`${c.name} shares chapter number ${n} with ${seen.get(n).name}.`}); else seen.set(n,c); }
  }
  const scenes=active.filter(e=>e.type==='scene');
  for(const parentId of new Set(scenes.map(c=>c.fields?.parentChapterId).filter(Boolean))){
    const seen=new Map(); for(const c of scenes.filter(x=>x.fields?.parentChapterId===parentId)){ const n=String(c.fields?.order||''); if(!n) continue; if(seen.has(n)) warnings.push({severity:'warning',code:'scene-order',entityId:c.id,message:`${c.name} shares scene order ${n} with ${seen.get(n).name}.`}); else seen.set(n,c); }
  }

  const presence=new Map(scenes.map(scene=>[scene.id,[]]));
  for(const rel of relations.filter(r=>r.type==='appears_in')){
    if(presence.has(rel.toId)&&byId.get(rel.fromId)?.type==='character') presence.get(rel.toId).push(byId.get(rel.fromId));
    if(presence.has(rel.fromId)&&byId.get(rel.toId)?.type==='character') presence.get(rel.fromId).push(byId.get(rel.toId));
  }
  for(const scene of scenes){
    const date=numeric(scene.fields?.storyDateSort);
    if(date===null) continue;
    const location=byId.get(scene.fields?.locationId);
    if(location?.type==='location'){
      const from=numeric(location.fields?.existsFrom),to=numeric(location.fields?.existsTo);
      if(from!==null&&date<from) warnings.push({severity:'error',code:'location-before-exists',entityId:scene.id,message:`${scene.name} uses ${location.name} before its recorded existence.`});
      if(to!==null&&date>to) warnings.push({severity:'error',code:'location-after-exists',entityId:scene.id,message:`${scene.name} uses ${location.name} after its recorded end.`});
    }
    for(const character of presence.get(scene.id)||[]){
      const birth=numeric(character.fields?.birthSort),death=numeric(character.fields?.deathSort),revival=numeric(character.fields?.revivalSort);
      if(birth!==null&&date<birth) warnings.push({severity:'error',code:'character-before-birth',entityId:scene.id,message:`${character.name} appears in ${scene.name} before their recorded birth.`});
      if(death!==null&&date>death&&(revival===null||date<revival)) warnings.push({severity:'error',code:'character-after-death',entityId:scene.id,message:`${character.name} appears in ${scene.name} after their recorded death and before any recorded return.`});
    }
  }

  const relationPairs=new Map();
  const incompatible=new Set(['ally_of|enemy_of','ally_of|hostile_to','allied_with|hostile_to','friend_of|enemy_of','at_war_with|allied_with']);
  for(const rel of relations){ const ids=[rel.fromId,rel.toId].sort().join('|'); const arr=relationPairs.get(ids)||[]; arr.push(rel.type); relationPairs.set(ids,arr); }
  for(const [pair,types] of relationPairs){ for(const combo of incompatible){ const [a,b]=combo.split('|'); if(types.includes(a)&&types.includes(b)){ const [left,right]=pair.split('|'); warnings.push({severity:'warning',code:'relationship-conflict',entityId:left,message:`${byId.get(left)?.name||left} and ${byId.get(right)?.name||right} are simultaneously marked ${a.replaceAll('_',' ')} and ${b.replaceAll('_',' ')}.`}); } } }
  for(const rel of relations.filter(r=>r.type==='contradicts')){ const a=byId.get(rel.fromId),b=byId.get(rel.toId); if(a?.status==='Canon'&&b?.status==='Canon') warnings.push({severity:'warning',code:'canon-mutual-contradiction',entityId:a.id,message:`${a.name} and ${b.name} are both Canon but are explicitly marked as contradictory.`}); }
  for(const rel of relations.filter(r=>['precedes','requires'].includes(r.type))){
    const a=byId.get(rel.fromId),b=byId.get(rel.toId); if(a?.type!=='event'||b?.type!=='event')continue;
    const ad=numeric(a.fields?.dateStart),bd=numeric(b.fields?.dateStart); if(ad===null||bd===null)continue;
    if(rel.type==='precedes'&&ad>=bd) warnings.push({severity:'error',code:'event-precedence',entityId:a.id,message:`${a.name} is marked as preceding ${b.name}, but its date is not earlier.`});
    if(rel.type==='requires'&&bd>=ad) warnings.push({severity:'error',code:'event-requirement-order',entityId:a.id,message:`${a.name} requires ${b.name}, but the required event is not earlier.`});
  }

  for(const row of knowledge){
    if(row.knowerKind!=='character'||!row.storyEntityId) continue;
    const subject=byId.get(row.subjectEntityId); if(!subject) continue;
    const revealForSubject=reveals.filter(r=>r.targetEntityId===row.subjectEntityId&&storyPointId(r));
    const earliest=[...revealForSubject].sort((a,b)=>compareStoryRefs(storyPointId(a),storyPointId(b),entities))[0];
    if(earliest && compareStoryRefs(row.storyEntityId,storyPointId(earliest),entities)<0 && row.state==='Knows truth') warnings.push({severity:'info',code:'knowledge-before-reveal',entityId:row.knowerEntityId,message:`${byId.get(row.knowerEntityId)?.name||'A character'} knows ${subject.name} before its first reader reveal. This may be intentional.`});
  }
  for(const mystery of active.filter(e=>e.type==='mystery')){
    const p=mysteryAnalysis(mystery.id,{clues,reveals,entities});
    if(p.hasReveal&&p.clueCount===0) warnings.push({severity:'warning',code:'reveal-without-clue',entityId:mystery.id,message:`${mystery.name} has a reveal but no structured setup clues.`});
    if(p.insufficientSetup) warnings.push({severity:'warning',code:'mystery-insufficient-setup',entityId:mystery.id,message:`${mystery.name} reaches its first reveal before any scheduled clue.`});
    if(p.clueCount>0&&!p.hasReveal) warnings.push({severity:'info',code:'mystery-unresolved',entityId:mystery.id,message:`${mystery.name} has planted clues but no structured reveal yet.`});
    if(p.longestGap>=1000) warnings.push({severity:'info',code:'mystery-reinforcement-gap',entityId:mystery.id,message:`${mystery.name} has a long gap between scheduled clue/reveal beats. Check whether it needs reinforcement.`});
  }
  return warnings;
}

export function sceneContinuity(sceneId,data){
  const entities=data.entities||[], byId=entityMap(entities), scene=byId.get(sceneId);
  if(!scene||scene.type!=='scene') return null;
  const relations=data.relations||[];
  const characters=[];
  for(const rel of relations){
    if(rel.type!=='appears_in') continue;
    if(rel.fromId===sceneId && byId.get(rel.toId)?.type==='character') characters.push(byId.get(rel.toId));
    if(rel.toId===sceneId && byId.get(rel.fromId)?.type==='character') characters.push(byId.get(rel.fromId));
  }
  const uniqueCharacters=[...new Map(characters.map(c=>[c.id,c])).values()];
  const location=byId.get(scene.fields?.locationId)||null;
  const clues=(data.clues||[]).filter(c=>c.storyEntityId===sceneId);
  const reveals=(data.reveals||[]).filter(r=>r.sceneId===sceneId);
  const beats=(data.workspace||[]).filter(w=>w.kind==='plotBeat'&&w.data?.sceneId===sceneId);
  const knowledge=Object.fromEntries(uniqueCharacters.map(c=>[c.id,knowledgeAtPoint({knowledge:data.knowledge||[],entities,characterId:c.id,pointId:sceneId}).rows]));
  const reader=readerKnowledgeAtPoint({knowledge:data.knowledge||[],reveals:data.reveals||[],entities,pointId:sceneId});
  const asymmetry=Object.fromEntries(uniqueCharacters.map(c=>[c.id,knowledgeAsymmetryAtPoint({knowledge:data.knowledge||[],reveals:data.reveals||[],entities,characterId:c.id,pointId:sceneId})]));
  const mysteries=entities.filter(e=>e.type==='mystery'&&!e.archivedAt).filter(m=>{const p=mysteryProgression(m.id,{clues:data.clues||[],reveals:data.reveals||[],entities});const started=p.rows.some(r=>r.storyId&&compareStoryRefs(r.storyId,sceneId,entities)<=0);const resolved=p.rows.some(r=>r.kind==='Reveal'&&r.storyId&&compareStoryRefs(r.storyId,sceneId,entities)<=0);return started&&!resolved;});
  const warnings=continuityWarnings(data).filter(w=>w.entityId===sceneId||uniqueCharacters.some(c=>c.id===w.entityId)||w.entityId===location?.id);
  return {scene,characters:uniqueCharacters,location,clues,reveals,beats,knowledge,reader,asymmetry,activeMysteries:mysteries,timelinePosition:{path:storyPath(scene,entities),storyDate:scene.fields?.storyDate||'',storyDateSort:scene.fields?.storyDateSort??''},warnings};
}

export function plotCoverage({entities=[],workspace=[]},threadId){
  const beats=workspace.filter(w=>w.kind==='plotBeat'&&(!threadId||w.data?.threadId===threadId));
  const sceneIds=new Set(beats.map(b=>b.data?.sceneId).filter(Boolean));
  const scenes=entities.filter(e=>e.type==='scene'&&!e.archivedAt).sort((a,b)=>{const aa=storyOrder(a,entities),bb=storyOrder(b,entities);return aa[0]-bb[0]||aa[1]-bb[1]||aa[2]-bb[2];});
  return scenes.map(scene=>({scene,covered:sceneIds.has(scene.id),beats:beats.filter(b=>b.data?.sceneId===scene.id)}));
}

export function characterInteractionMatrix({entities=[],relations=[]}){
  const characters=entities.filter(e=>e.type==='character'&&!e.archivedAt);
  const scenes=entities.filter(e=>e.type==='scene'&&!e.archivedAt);
  const presence=new Map(scenes.map(s=>[s.id,new Set()]));
  for(const rel of relations.filter(r=>r.type==='appears_in')){
    if(presence.has(rel.toId)&&characters.some(c=>c.id===rel.fromId)) presence.get(rel.toId).add(rel.fromId);
    if(presence.has(rel.fromId)&&characters.some(c=>c.id===rel.toId)) presence.get(rel.fromId).add(rel.toId);
  }
  const counts=new Map();
  for(const ids of presence.values()) for(const a of ids) for(const b of ids) if(a<b) counts.set(`${a}|${b}`,(counts.get(`${a}|${b}`)||0)+1);
  return {characters,presence,counts};
}

export function locationUsage(locationId,data){
  const entities=data.entities||[], relations=data.relations||[];
  const scenes=entities.filter(e=>e.type==='scene'&&e.fields?.locationId===locationId);
  const events=entities.filter(e=>e.type==='event'&&e.fields?.locationId===locationId);
  const children=entities.filter(e=>e.type==='location'&&e.fields?.parentLocationId===locationId);
  const maps=entities.filter(e=>e.type==='map'&&e.fields?.scopeLocationId===locationId);
  const characters=[];
  for(const rel of relations){ const other=rel.fromId===locationId?rel.toId:rel.toId===locationId?rel.fromId:null; const e=entities.find(x=>x.id===other); if(e?.type==='character') characters.push(e); }
  return {scenes,events,children,maps,characters:[...new Map(characters.map(c=>[c.id,c])).values()]};
}

export function crossLinkSuggestions(entity,entities){
  if(!entity) return [];
  const corpus=[entity.summary,entity.notes,...Object.values(entity.fields||{})].filter(v=>typeof v==='string').join('\n').toLowerCase();
  if(!corpus) return [];
  return entities.filter(other=>other.id!==entity.id&&!other.archivedAt&&other.name?.length>=3&&corpus.includes(other.name.toLowerCase())).slice(0,20);
}

export function contentTree(rootId,{entities=[],relations=[]}){
  const byId=entityMap(entities), children=new Map();
  for(const rel of relations.filter(r=>['parent_of','contains'].includes(r.type))){ (children.get(rel.fromId)||children.set(rel.fromId,[]).get(rel.fromId)).push(rel.toId); }
  for(const rel of relations.filter(r=>['child_of','part_of'].includes(r.type))){ (children.get(rel.toId)||children.set(rel.toId,[]).get(rel.toId)).push(rel.fromId); }
  const build=(id,seen=new Set())=>{ if(seen.has(id)) return {entity:byId.get(id),cycle:true,children:[]}; const next=new Set(seen);next.add(id);return {entity:byId.get(id),children:(children.get(id)||[]).map(child=>build(child,next))}; };
  return build(rootId);
}

export function diplomacyEdges({entities=[],relations=[]},{eraId=null,dateText=''}={}){
  const politicalTypes=new Set(['ally_of','political_enemy_of','allied_with','hostile_to','neutral_with','vassal_of','trade_partner_with','occupied_by','at_war_with']);
  const q=String(dateText||'').trim().toLowerCase();
  return relations.filter(r=>politicalTypes.has(r.type)).filter(r=>!eraId||r.eraId===eraId).filter(r=>!q||[r.activeFrom,r.activeTo,r.note].filter(Boolean).join(' ').toLowerCase().includes(q)).map(r=>({relation:r,from:entities.find(e=>e.id===r.fromId),to:entities.find(e=>e.id===r.toId)})).filter(x=>x.from&&x.to);
}
