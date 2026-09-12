import { relationsFor, otherEntityId } from './relations.js';

export function neighborhood(rootId, relations, depth=1){
  const seen=new Set([rootId]); let frontier=[rootId]; const edges=[];
  for(let level=0;level<depth;level++){
    const next=[];
    for(const id of frontier){
      for(const rel of relationsFor(id,relations)){
        if(!edges.some(e=>e.id===rel.id)) edges.push(rel);
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

export function familyLevels(rootId,relations,maxDepth=3){
  const levels=new Map([[rootId,0]]); const queue=[rootId];
  while(queue.length){ const current=queue.shift(); const level=levels.get(current); if(Math.abs(level)>=maxDepth) continue;
    for(const rel of relationsFor(current,relations)){
      let other=null,nextLevel=null;
      if(rel.type==='parent_of') { if(rel.fromId===current){other=rel.toId;nextLevel=level+1;} else {other=rel.fromId;nextLevel=level-1;} }
      if(rel.type==='child_of') { if(rel.fromId===current){other=rel.toId;nextLevel=level-1;} else {other=rel.fromId;nextLevel=level+1;} }
      if(other&&!levels.has(other)){ levels.set(other,nextLevel); queue.push(other); }
    }
  }
  return levels;
}
