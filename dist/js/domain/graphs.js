import { otherEntityId, relationMatchesFilters, relationEndpointsProjectable } from './relations.js';

export const FAMILY_RELATION_TYPES=['parent_of','child_of','adoptive_parent_of','guardian_of','sibling_of','spouse_of','former_spouse_of'];

function relationIndex(relations){ const map=new Map(); for(const rel of relations){ (map.get(rel.fromId)||map.set(rel.fromId,[]).get(rel.fromId)).push(rel); (map.get(rel.toId)||map.set(rel.toId,[]).get(rel.toId)).push(rel); } return map; }

export function neighborhood(rootId, relations, depth=1, options={}){
  const maxDepth=Math.max(1,Math.min(3,Number(depth)||1));
  const allowed=relations.filter(r=>relationMatchesFilters(r,options)&&relationEndpointsProjectable(r,options.entities||[])),index=relationIndex(allowed);
  const seen=new Set([rootId]),edgeIds=new Set(); let frontier=[rootId]; const edges=[];
  for(let level=0;level<maxDepth;level++){
    const next=[];
    for(const id of frontier){
      for(const rel of index.get(id)||[]){
        if(!edgeIds.has(rel.id)){ edgeIds.add(rel.id); edges.push(rel); }
        const other=otherEntityId(rel,id); if(!seen.has(other)){ seen.add(other); next.push(other); }
      }
    }
    frontier=next;
  }
  return { ids:[...seen], edges };
}

export function radialLayout(rootId, ids, width=760, height=460){
  const cx=width/2,cy=height/2; const others=ids.filter(id=>id!==rootId); const radius=Math.max(130,Math.min(width,height)*0.34);
  const positions={ [rootId]:{x:cx,y:cy} };
  others.forEach((id,i)=>{ const angle=(Math.PI*2*i)/Math.max(1,others.length)-Math.PI/2; positions[id]={x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius}; });
  return positions;
}

export function familyLevels(rootId,relations,maxDepth=3,entities=[]){
  const family=relations.filter(r=>FAMILY_RELATION_TYPES.includes(r.type)&&relationMatchesFilters(r)&&relationEndpointsProjectable(r,entities)),index=relationIndex(family);
  const levels=new Map([[rootId,0]]); const queue=[rootId];
  while(queue.length){
    const current=queue.shift(), level=levels.get(current); if(Math.abs(level)>=maxDepth) continue;
    for(const rel of index.get(current)||[]){
      let other=null,nextLevel=null;
      if(['parent_of','adoptive_parent_of','guardian_of'].includes(rel.type)) { if(rel.fromId===current){other=rel.toId;nextLevel=level+1;} else {other=rel.fromId;nextLevel=level-1;} }
      if(rel.type==='child_of') { if(rel.fromId===current){other=rel.toId;nextLevel=level-1;} else {other=rel.fromId;nextLevel=level+1;} }
      if(['spouse_of','former_spouse_of','sibling_of'].includes(rel.type)){ other=rel.fromId===current?rel.toId:rel.fromId; nextLevel=level; }
      if(other&&!levels.has(other)){ levels.set(other,nextLevel); queue.push(other); }
    }
  }
  return levels;
}

export function familyNetwork(rootId,relations,maxDepth=3,entities=[]){
  const levels=familyLevels(rootId,relations,maxDepth,entities);
  const ids=new Set(levels.keys());
  return {levels,ids:[...ids],edges:relations.filter(r=>FAMILY_RELATION_TYPES.includes(r.type)&&relationMatchesFilters(r)&&relationEndpointsProjectable(r,entities)&&ids.has(r.fromId)&&ids.has(r.toId))};
}
