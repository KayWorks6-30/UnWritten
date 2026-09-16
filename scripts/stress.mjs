import { performance } from 'node:perf_hooks';
import { buildReferenceIndex } from '../js/domain/references.js';
import { compareStoryRefs } from '../js/domain/story.js';
import { searchEntities } from '../js/domain/search.js';

const ENTITY_COUNT=Number(process.env.STRESS_ENTITIES||10000);
const RELATION_COUNT=Number(process.env.STRESS_RELATIONS||50000);
const KNOWLEDGE_COUNT=Number(process.env.STRESS_KNOWLEDGE||25000);
const STORY_SCENES=Math.min(Number(process.env.STRESS_SCENES||5000),Math.max(100,Math.floor(ENTITY_COUNT/2)));
const stamp='2026-09-16T00:00:00.000Z';
const entity=(id,type,name,fields={})=>({id,type,name,summary:`Synthetic ${type} ${name}`,status:'Canon',tags:['stress'],favorite:false,fields,notes:'',archivedAt:null,createdAt:stamp,updatedAt:stamp});
const data={entities:[],relations:[],settings:[{key:'project',value:{name:'Stress Fixture'},updatedAt:stamp}],media:[],clues:[],reveals:[],knowledge:[],mapVersions:[],mapMarkers:[],workspace:[]};

const book=entity('book-0','book','Stress Book',{order:1}); data.entities.push(book);
const part=entity('part-0','part','Stress Part',{parentBookId:book.id,order:1}); data.entities.push(part);
const chapterCount=Math.max(1,Math.ceil(STORY_SCENES/20));
for(let c=0;c<chapterCount;c++) data.entities.push(entity(`chapter-${c}`,'chapter',`Chapter ${c+1}`,{parentBookId:book.id,parentPartId:part.id,number:c+1}));
for(let s=0;s<STORY_SCENES;s++) data.entities.push(entity(`scene-${s}`,'scene',`Scene ${s+1}`,{parentChapterId:`chapter-${Math.floor(s/20)}`,order:(s%20)+1,storyDateSort:s}));
let i=0;
while(data.entities.length<ENTITY_COUNT){
  const type=i%3===0?'character':i%3===1?'location':'lore';
  data.entities.push(entity(`entity-${i}`,type,`${type} ${i}`,type==='character'?{currentLocationId:`entity-${Math.max(0,i-1)}`} : {}));
  i++;
}
const ids=data.entities.map(e=>e.id);
for(let r=0;r<RELATION_COUNT;r++){
  const from=ids[r%ids.length],to=ids[(r*17+31)%ids.length];
  if(from===to) continue;
  data.relations.push({id:`rel-${r}`,fromId:from,toId:to,type:'related_to',status:'Canon',note:'',generatedParent:false,eraId:null,activeFrom:'',activeTo:'',createdAt:stamp,updatedAt:stamp});
}
for(let k=0;k<KNOWLEDGE_COUNT;k++) data.knowledge.push({id:`knowledge-${k}`,subjectEntityId:ids[k%ids.length],knowerKind:'reader',knowerEntityId:null,state:'Partial truth',belief:'',truthNote:'',storyEntityId:`scene-${k%STORY_SCENES}`,createdAt:stamp,updatedAt:stamp});

function measure(label,fn){ const start=performance.now(),value=fn(),ms=performance.now()-start; console.log(`${label}: ${ms.toFixed(1)} ms`); return value; }
console.log(`Synthetic project: ${data.entities.length.toLocaleString()} entities, ${data.relations.length.toLocaleString()} relationships, ${data.knowledge.length.toLocaleString()} knowledge records, ${STORY_SCENES.toLocaleString()} scenes.`);
const edges=measure('Build reverse-reference index',()=>buildReferenceIndex(data));
measure('Search all entities',()=>searchEntities(data.entities,'character 99'));
measure('Sort story scenes by narrative position',()=>[...data.entities.filter(e=>e.type==='scene')].sort((a,b)=>compareStoryRefs(a.id,b.id,data.entities)));
const bytes=Buffer.byteLength(JSON.stringify(data));
console.log(`Reference edges: ${edges.length.toLocaleString()}`);
console.log(`Portable structured payload: ${(bytes/1024/1024).toFixed(2)} MiB`);
console.log('Stress run complete. Use STRESS_ENTITIES/STRESS_RELATIONS/STRESS_KNOWLEDGE/STRESS_SCENES to change scale.');
