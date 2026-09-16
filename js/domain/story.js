const FAR_FUTURE = 999999999;

const ENTITY_INDEX_CACHE = new WeakMap();
function indexEntities(entities=[]){
  if(!Array.isArray(entities)) return new Map();
  const cached=ENTITY_INDEX_CACHE.get(entities);
  if(cached&&cached.length===entities.length) return cached.index;
  const index=new Map(entities.map(entity=>[entity.id,entity]));
  ENTITY_INDEX_CACHE.set(entities,{length:entities.length,index});
  return index;
}
function orderNumber(value, fallback=FAR_FUTURE){
  if(value===''||value===null||value===undefined) return fallback;
  const n=Number(value); return Number.isFinite(n)?n:fallback;
}

export function narrativePosition(entity, entities=[]){
  if(!entity) return {type:null,bookId:null,partId:null,chapterId:null,sceneId:null,bookOrder:FAR_FUTURE,partOrder:FAR_FUTURE,chapterOrder:FAR_FUTURE,sceneOrder:FAR_FUTURE,tuple:[FAR_FUTURE,FAR_FUTURE,FAR_FUTURE,FAR_FUTURE,FAR_FUTURE]};
  const byId=indexEntities(entities);
  let book=null,part=null,chapter=null,scene=null;

  if(entity.type==='book') book=entity;
  else if(entity.type==='part') { part=entity; book=byId.get(entity.fields?.parentBookId)||null; }
  else if(entity.type==='chapter') {
    chapter=entity;
    part=byId.get(entity.fields?.parentPartId)||null;
    book=byId.get(entity.fields?.parentBookId)||byId.get(part?.fields?.parentBookId)||null;
  } else if(entity.type==='scene') {
    scene=entity;
    chapter=byId.get(entity.fields?.parentChapterId)||null;
    part=byId.get(chapter?.fields?.parentPartId)||null;
    book=byId.get(chapter?.fields?.parentBookId)||byId.get(part?.fields?.parentBookId)||null;
  }

  if(!book && !part && !chapter && !scene) return {type:entity.type,bookId:null,partId:null,chapterId:null,sceneId:null,bookOrder:FAR_FUTURE,partOrder:FAR_FUTURE,chapterOrder:FAR_FUTURE,sceneOrder:FAR_FUTURE,tuple:[FAR_FUTURE,FAR_FUTURE,FAR_FUTURE,FAR_FUTURE,FAR_FUTURE]};

  const bookOrder=orderNumber(book?.fields?.order);
  // Chapters outside a Part live in segment 0. Parts use their explicit order.
  const partOrder=part?orderNumber(part.fields?.order):0;
  const chapterOrder=chapter?orderNumber(chapter.fields?.number):-1;
  const sceneOrder=scene?orderNumber(scene.fields?.order):-1;
  let tuple;
  if(entity.type==='book') tuple=[bookOrder,-1,-1,-1,0];
  else if(entity.type==='part') tuple=[bookOrder,partOrder,-1,-1,1];
  else if(entity.type==='chapter') tuple=[bookOrder,partOrder,chapterOrder,-1,2];
  else tuple=[bookOrder,partOrder,chapterOrder,sceneOrder,3];

  return {
    type:entity.type,
    bookId:book?.id||null,
    partId:part?.id||null,
    chapterId:chapter?.id||null,
    sceneId:scene?.id||null,
    bookOrder,partOrder,chapterOrder,sceneOrder,tuple
  };
}

export function storyOrder(entity,entities=[]){ return narrativePosition(entity,entities).tuple; }

export function compareStoryRefs(aId,bId,entities=[]){
  if(aId===bId) return 0;
  const byId=indexEntities(entities),a=storyOrder(byId.get(aId),entities),b=storyOrder(byId.get(bId),entities);
  for(let i=0;i<Math.max(a.length,b.length);i++) if((a[i]??FAR_FUTURE)!==(b[i]??FAR_FUTURE)) return (a[i]??FAR_FUTURE)-(b[i]??FAR_FUTURE);
  return String(aId||'').localeCompare(String(bId||''));
}

export function storyPath(entity,entities=[]){
  if(!entity) return '';
  const byId=indexEntities(entities),position=narrativePosition(entity,entities),parts=[];
  for(const id of [position.bookId,position.partId,position.chapterId,position.sceneId]){
    const item=byId.get(id); if(item && !parts.some(part=>part.id===item.id)) parts.push(item);
  }
  return parts.length?parts.map(item=>item.name).join(' → '):entity.name;
}

export function storyAncestors(entity,entities=[]){
  const byId=indexEntities(entities),position=narrativePosition(entity,entities);
  return [position.bookId,position.partId,position.chapterId].map(id=>byId.get(id)).filter(Boolean).filter(item=>item.id!==entity?.id);
}

export function storyBookId(entity,entities=[]){ return narrativePosition(entity,entities).bookId; }
export function storyPartId(entity,entities=[]){ return narrativePosition(entity,entities).partId; }
export function storyChapterId(entity,entities=[]){ return narrativePosition(entity,entities).chapterId; }
