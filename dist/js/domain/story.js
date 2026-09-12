export function storyOrder(entity, entities){
  if(!entity) return [999,999,999];
  if(entity.type==='book') return [Number(entity.fields?.order)||999,0,0];
  if(entity.type==='chapter') { const book=entities.find(e=>e.id===entity.fields?.parentBookId); return [Number(book?.fields?.order)||999,Number(entity.fields?.number)||999,0]; }
  if(entity.type==='scene') { const chapter=entities.find(e=>e.id===entity.fields?.parentChapterId); const book=entities.find(e=>e.id===chapter?.fields?.parentBookId); return [Number(book?.fields?.order)||999,Number(chapter?.fields?.number)||999,Number(entity.fields?.order)||999]; }
  return [999,999,999];
}
export function compareStoryRefs(aId,bId,entities){ const a=storyOrder(entities.find(e=>e.id===aId),entities),b=storyOrder(entities.find(e=>e.id===bId),entities); for(let i=0;i<3;i++){ if(a[i]!==b[i]) return a[i]-b[i]; } return 0; }
export function storyPath(entity,entities){
  if(!entity) return '';
  if(entity.type==='book') return entity.name;
  if(entity.type==='chapter'){ const book=entities.find(e=>e.id===entity.fields?.parentBookId); return `${book?.name?`${book.name} → `:''}${entity.name}`; }
  if(entity.type==='scene'){ const chapter=entities.find(e=>e.id===entity.fields?.parentChapterId); const book=entities.find(e=>e.id===chapter?.fields?.parentBookId); return `${book?.name?`${book.name} → `:''}${chapter?.name?`${chapter.name} → `:''}${entity.name}`; }
  return entity.name;
}
