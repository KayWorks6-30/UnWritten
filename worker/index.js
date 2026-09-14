import { RELATION_TYPES, KNOWLEDGE_STATES, MAP_VARIANTS, WORKSPACE_KINDS, validateEntity } from '../js/domain/schema.js';
import { migrateBackupData } from '../js/data/migrations.js';
import { assertValidBackupSnapshot } from '../js/data/validation.js';

const DATA_STORES = ['entities','relations','media','settings','clues','reveals','knowledge','mapVersions','mapMarkers','workspace'];
const JSON_HEADERS = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' };
const TABLE = { entities:'entities', relations:'relations', media:'media', settings:'settings', clues:'clues', reveals:'reveals', knowledge:'knowledge', mapVersions:'map_versions', mapMarkers:'map_markers', workspace:'workspace' };
const JWKS_CACHE = new Map();

function json(data,status=200,extra={}){ return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...extra}}); }
function error(message,status=400,details){ return json({ok:false,error:message,...(details?{details}: {})},status); }
function safeJson(value,fallback){ try{return JSON.parse(value);}catch{return fallback;} }
function now(){ return new Date().toISOString(); }
function cleanPathPart(value){ return String(value||'').replace(/[^a-zA-Z0-9._-]/g,'_'); }
function mediaObjectKey(id,name='file'){ return `media/${cleanPathPart(id)}/${crypto.randomUUID()}-${cleanPathPart(name)}`; }
function trashObjectKey(key){ const day=now().slice(0,10); const name=cleanPathPart(String(key||'object').split('/').pop()); return `_trash/${day}/${crypto.randomUUID()}-${name}`; }
function ownerEmails(env){ return new Set(String(env.OWNER_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)); }

async function authenticate(request,env){
  if(String(env.DEV_AUTH_BYPASS||'').toLowerCase()==='true'){
    const email=(env.DEV_USER_EMAIL||'owner@local.test').toLowerCase();
    return {email,role:'owner',dev:true};
  }
  if(!env.TEAM_DOMAIN||!env.POLICY_AUD) throw Object.assign(new Error('Cloudflare Access JWT validation is not configured. Set TEAM_DOMAIN and POLICY_AUD.'),{status:503});
  const token=request.headers.get('cf-access-jwt-assertion');
  if(!token) throw Object.assign(new Error('Missing Cloudflare Access JWT.'),{status:403});
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  let jwks=JWKS_CACHE.get(env.TEAM_DOMAIN);
  if(!jwks){ jwks=createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN.replace(/\/$/,'')}/cdn-cgi/access/certs`)); JWKS_CACHE.set(env.TEAM_DOMAIN,jwks); }
  let payload;
  try{ ({payload}=await jwtVerify(token,jwks,{issuer:env.TEAM_DOMAIN,audience:env.POLICY_AUD})); }
  catch(e){ throw Object.assign(new Error(`Invalid Cloudflare Access JWT: ${e?.message||'verification failed'}`),{status:403}); }
  const email=String(payload.email||'').trim().toLowerCase();
  if(!email) throw Object.assign(new Error('Cloudflare Access JWT does not contain an email identity.'),{status:403});
  const owners=ownerEmails(env);
  if(!owners.size) throw Object.assign(new Error('OWNER_EMAILS is not configured. V3 requires at least one owner before API access is enabled.'),{status:503});
  return {email,role:owners.has(email)?'owner':'reviewer',dev:false};
}
function requireOwner(identity){ if(identity?.role!=='owner') throw Object.assign(new Error('Reviewer access is read-only.'),{status:403}); }

function rowToRecord(store,row){
  if(!row) return null;
  if(store==='entities') return {id:row.id,type:row.type,name:row.name,summary:row.summary||'',status:row.status,tags:safeJson(row.tags_json,[]),favorite:Boolean(row.favorite),fields:safeJson(row.fields_json,{}),notes:row.notes||'',archivedAt:row.archived_at||null,createdAt:row.created_at,updatedAt:row.updated_at};
  if(store==='relations') return {id:row.id,fromId:row.from_id,toId:row.to_id,type:row.type,note:row.note||'',generatedParent:Boolean(row.generated_parent),eraId:row.era_id||null,activeFrom:row.active_from||'',activeTo:row.active_to||'',createdAt:row.created_at,updatedAt:row.updated_at||row.created_at};
  if(store==='settings') return {key:row.key,value:safeJson(row.value_json,{})};
  if(store==='media') return {id:row.id,name:row.name,title:row.title,mime:row.mime,size:Number(row.size)||0,r2Key:row.r2_key,tags:safeJson(row.tags_json,[]),entityIds:safeJson(row.entity_ids_json,[]),createdAt:row.created_at,url:`/api/media/${encodeURIComponent(row.id)}/content`};
  if(store==='clues') return {id:row.id,mysteryId:row.mystery_id,mysteryIds:safeJson(row.mystery_ids_json,[]),label:row.label||'',kind:row.kind||'',description:row.description||'',storyEntityId:row.story_entity_id||null,visibility:row.visibility||'',firstRead:row.first_read||'',trueInterpretation:row.true_interpretation||'',order:row.order_value||'',createdAt:row.created_at,updatedAt:row.updated_at};
  if(store==='reveals') return {id:row.id,title:row.title||'',summary:row.summary||'',readerKnowledge:row.reader_knowledge||'',mysteryId:row.mystery_id||null,targetEntityId:row.target_entity_id||null,bookId:row.book_id||null,chapterId:row.chapter_id||null,sceneId:row.scene_id||null,createdAt:row.created_at,updatedAt:row.updated_at};
  if(store==='knowledge') return {id:row.id,subjectEntityId:row.subject_entity_id,knowerKind:row.knower_kind,knowerEntityId:row.knower_entity_id||null,state:row.state,belief:row.belief||'',truthNote:row.truth_note||'',storyEntityId:row.story_entity_id||null,createdAt:row.created_at,updatedAt:row.updated_at};
  if(store==='mapVersions') return {id:row.id,mapId:row.map_id,mediaId:row.media_id,label:row.label||'',variant:row.variant||'',effectiveDate:row.effective_date||'',notes:row.notes||'',createdAt:row.created_at};
  if(store==='mapMarkers') return {id:row.id,mapVersionId:row.map_version_id,locationId:row.location_id,x:Number(row.x),y:Number(row.y),label:row.label||'',category:row.category||'',icon:row.icon||'',customMediaId:row.custom_media_id||null,tags:safeJson(row.tags_json,[]),activeFrom:row.active_from||'',activeTo:row.active_to||'',layerId:row.layer_id||null,factionId:row.faction_id||null,bookIds:safeJson(row.book_ids_json,[]),storyRelevance:row.story_relevance||'',active:row.active!==0,createdAt:row.created_at,updatedAt:row.updated_at||row.created_at};
  if(store==='workspace') return {id:row.id,kind:row.kind,title:row.title||'',data:safeJson(row.data_json,{}),createdAt:row.created_at,updatedAt:row.updated_at};
  return null;
}

function upsertStatement(env,store,r){
  if(store==='entities') return env.DB.prepare(`INSERT INTO entities (id,type,name,summary,status,tags_json,favorite,fields_json,notes,archived_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,name=excluded.name,summary=excluded.summary,status=excluded.status,tags_json=excluded.tags_json,favorite=excluded.favorite,fields_json=excluded.fields_json,notes=excluded.notes,archived_at=excluded.archived_at,created_at=excluded.created_at,updated_at=excluded.updated_at`).bind(r.id,r.type,r.name,r.summary||'',r.status,JSON.stringify(r.tags||[]),r.favorite?1:0,JSON.stringify(r.fields||{}),r.notes||'',r.archivedAt||null,r.createdAt||now(),r.updatedAt||now());
  if(store==='relations') return env.DB.prepare(`INSERT INTO relations (id,from_id,to_id,type,note,generated_parent,created_at,era_id,active_from,active_to,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET from_id=excluded.from_id,to_id=excluded.to_id,type=excluded.type,note=excluded.note,generated_parent=excluded.generated_parent,era_id=excluded.era_id,active_from=excluded.active_from,active_to=excluded.active_to,updated_at=excluded.updated_at`).bind(r.id,r.fromId,r.toId,r.type,r.note||'',r.generatedParent?1:0,r.createdAt||now(),r.eraId||null,r.activeFrom||'',r.activeTo||'',r.updatedAt||now());
  if(store==='settings') return env.DB.prepare(`INSERT INTO settings (key,value_json) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`).bind(r.key,JSON.stringify(r.value||{}));
  if(store==='media') return env.DB.prepare(`INSERT INTO media (id,name,title,mime,size,r2_key,tags_json,entity_ids_json,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,title=excluded.title,mime=excluded.mime,size=excluded.size,r2_key=excluded.r2_key,tags_json=excluded.tags_json,entity_ids_json=excluded.entity_ids_json,created_at=excluded.created_at`).bind(r.id,r.name||'file',r.title||r.name||'file',r.mime||'application/octet-stream',Number(r.size)||0,r.r2Key,JSON.stringify(r.tags||[]),JSON.stringify(r.entityIds||[]),r.createdAt||now());
  if(store==='clues') return env.DB.prepare(`INSERT INTO clues (id,mystery_id,mystery_ids_json,label,kind,description,story_entity_id,visibility,first_read,true_interpretation,order_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET mystery_id=excluded.mystery_id,mystery_ids_json=excluded.mystery_ids_json,label=excluded.label,kind=excluded.kind,description=excluded.description,story_entity_id=excluded.story_entity_id,visibility=excluded.visibility,first_read=excluded.first_read,true_interpretation=excluded.true_interpretation,order_value=excluded.order_value,updated_at=excluded.updated_at`).bind(r.id,r.mysteryId,JSON.stringify(r.mysteryIds||[]),r.label||'',r.kind||'',r.description||'',r.storyEntityId||null,r.visibility||'',r.firstRead||'',r.trueInterpretation||'',String(r.order??''),r.createdAt||now(),r.updatedAt||now());
  if(store==='reveals') return env.DB.prepare(`INSERT INTO reveals (id,title,summary,reader_knowledge,mystery_id,target_entity_id,book_id,chapter_id,scene_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,reader_knowledge=excluded.reader_knowledge,mystery_id=excluded.mystery_id,target_entity_id=excluded.target_entity_id,book_id=excluded.book_id,chapter_id=excluded.chapter_id,scene_id=excluded.scene_id,updated_at=excluded.updated_at`).bind(r.id,r.title||'',r.summary||'',r.readerKnowledge||'',r.mysteryId||null,r.targetEntityId||null,r.bookId||null,r.chapterId||null,r.sceneId||null,r.createdAt||now(),r.updatedAt||now());
  if(store==='knowledge') return env.DB.prepare(`INSERT INTO knowledge (id,subject_entity_id,knower_kind,knower_entity_id,state,belief,truth_note,story_entity_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subject_entity_id=excluded.subject_entity_id,knower_kind=excluded.knower_kind,knower_entity_id=excluded.knower_entity_id,state=excluded.state,belief=excluded.belief,truth_note=excluded.truth_note,story_entity_id=excluded.story_entity_id,updated_at=excluded.updated_at`).bind(r.id,r.subjectEntityId,r.knowerKind,r.knowerEntityId||null,r.state,r.belief||'',r.truthNote||'',r.storyEntityId||null,r.createdAt||now(),r.updatedAt||now());
  if(store==='mapVersions') return env.DB.prepare(`INSERT INTO map_versions (id,map_id,media_id,label,variant,effective_date,notes,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET map_id=excluded.map_id,media_id=excluded.media_id,label=excluded.label,variant=excluded.variant,effective_date=excluded.effective_date,notes=excluded.notes,created_at=excluded.created_at`).bind(r.id,r.mapId,r.mediaId,r.label||'',r.variant||'',r.effectiveDate||'',r.notes||'',r.createdAt||now());
  if(store==='mapMarkers') return env.DB.prepare(`INSERT INTO map_markers (id,map_version_id,location_id,x,y,label,category,icon,custom_media_id,tags_json,active_from,active_to,layer_id,faction_id,book_ids_json,story_relevance,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET map_version_id=excluded.map_version_id,location_id=excluded.location_id,x=excluded.x,y=excluded.y,label=excluded.label,category=excluded.category,icon=excluded.icon,custom_media_id=excluded.custom_media_id,tags_json=excluded.tags_json,active_from=excluded.active_from,active_to=excluded.active_to,layer_id=excluded.layer_id,faction_id=excluded.faction_id,book_ids_json=excluded.book_ids_json,story_relevance=excluded.story_relevance,active=excluded.active,updated_at=excluded.updated_at`).bind(r.id,r.mapVersionId,r.locationId,Number(r.x),Number(r.y),r.label||'',r.category||'',r.icon||'',r.customMediaId||null,JSON.stringify(r.tags||[]),r.activeFrom||'',r.activeTo||'',r.layerId||null,r.factionId||null,JSON.stringify(r.bookIds||[]),r.storyRelevance||'',r.active===false?0:1,r.createdAt||now(),r.updatedAt||now());
  if(store==='workspace') return env.DB.prepare(`INSERT INTO workspace (id,kind,title,data_json,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,data_json=excluded.data_json,updated_at=excluded.updated_at`).bind(r.id,r.kind,r.title||'',JSON.stringify(r.data||{}),r.createdAt||now(),r.updatedAt||now());
  throw new Error(`Unsupported store ${store}`);
}

async function readStore(env,store){ const result=await env.DB.prepare(`SELECT * FROM ${TABLE[store]}`).all(); return (result.results||[]).map(row=>rowToRecord(store,row)); }
async function snapshot(env,{includeRevisions=false}={}){
  const started=Date.now();
  const statements=DATA_STORES.map(store=>env.DB.prepare(store==='workspace'&&!includeRevisions?`SELECT * FROM workspace WHERE kind <> 'revision'`:`SELECT * FROM ${TABLE[store]}`));
  const results=await env.DB.batch(statements);
  const data=Object.fromEntries(DATA_STORES.map((store,i)=>[store,(results[i]?.results||[]).map(row=>rowToRecord(store,row))]));
  const rows=Object.values(data).reduce((n,arr)=>n+arr.length,0); const size=JSON.stringify(data).length;
  console.log('snapshot',{ms:Date.now()-started,rows,bytes:size,includeRevisions});
  return data;
}
async function batchStatements(env,statements){ if(statements.length) await env.DB.batch(statements); }
async function readEntityRevisions(env,entityId,limit=50){
  const capped=Math.max(1,Math.min(100,Number(limit)||50));
  const result=await env.DB.prepare("SELECT * FROM workspace WHERE kind='revision' AND json_extract(data_json,'$.entityId')=? ORDER BY created_at DESC LIMIT ?").bind(entityId,capped).all();
  return (result.results||[]).map(row=>rowToRecord('workspace',row));
}
async function readAllRevisions(env){ const result=await env.DB.prepare("SELECT * FROM workspace WHERE kind='revision' ORDER BY created_at DESC").all(); return (result.results||[]).map(row=>rowToRecord('workspace',row)); }
async function oneEntity(env,id){ const row=await env.DB.prepare('SELECT * FROM entities WHERE id=?').bind(id).first(); return rowToRecord('entities',row); }
async function rowExists(env,table,idColumn,id){ return Boolean(await env.DB.prepare(`SELECT 1 AS ok FROM ${table} WHERE ${idColumn}=? LIMIT 1`).bind(id).first()); }
async function requireEntity(env,id,types=null,label='Referenced entry'){
  if(!id) return null; const e=await oneEntity(env,id); if(!e) throw new Error(`${label} does not exist.`); const wanted=types?(Array.isArray(types)?types:[types]):null; if(wanted&&!wanted.includes(e.type)) throw new Error(`${label} must be ${wanted.join(' or ')}.`); return e;
}
async function workspaceById(env,id){ const row=await env.DB.prepare('SELECT * FROM workspace WHERE id=?').bind(id).first(); return rowToRecord('workspace',row); }

async function assertNoParentCycle(env,candidate,key,type,label){
  if(!candidate.fields?.[key]) return;
  const rows=await env.DB.prepare('SELECT id,type,fields_json FROM entities WHERE type=?').bind(type).all();
  const byId=new Map((rows.results||[]).map(row=>[row.id,{id:row.id,type:row.type,fields:safeJson(row.fields_json,{})}])); byId.set(candidate.id,candidate);
  const seen=new Set([candidate.id]); let current=candidate,guard=0;
  while(current?.fields?.[key]&&guard++<100){ const next=current.fields[key]; if(seen.has(next)) throw new Error(`${label} hierarchy cannot contain a cycle.`); seen.add(next); current=byId.get(next); if(!current) break; }
}

async function validateRecord(env,store,r){
  if(store==='entities'){
    const errors=validateEntity(r); if(errors.length) throw new Error(errors[0]); const f=r.fields||{};
    if(f.parentLocationId){ if(f.parentLocationId===r.id) throw new Error('A location cannot be its own parent.'); await requireEntity(env,f.parentLocationId,'location','Parent location'); }
    if(f.parentBookId) await requireEntity(env,f.parentBookId,'book','Parent book');
    if(f.parentChapterId) await requireEntity(env,f.parentChapterId,'chapter','Parent chapter');
    if(f.eraId) await requireEntity(env,f.eraId,'era','Era');
    if(f.scopeLocationId) await requireEntity(env,f.scopeLocationId,'location','Map scope location');
    if(f.parentMapId){ if(f.parentMapId===r.id) throw new Error('A map cannot be its own parent map.'); await requireEntity(env,f.parentMapId,'map','Parent map'); }
    if(f.storyEntityId) await requireEntity(env,f.storyEntityId,['chapter','scene'],'Story entry');
    if(f.locationId) await requireEntity(env,f.locationId,'location','Location');
    if(r.type==='location') await assertNoParentCycle(env,r,'parentLocationId','location','Location');
    if(r.type==='map') await assertNoParentCycle(env,r,'parentMapId','map','Map');
    if(r.type==='trilogy') for(const id of f.protagonistIds||[]) await requireEntity(env,id,'character','Series protagonist');
    if(['character','deity'].includes(r.type)&&f.portraitMediaId&&!await rowExists(env,'media','id',f.portraitMediaId)) throw new Error('Character portrait media does not exist.');
    return;
  }
  if(store==='relations'){
    if(!r?.id||!r.fromId||!r.toId||r.fromId===r.toId) throw new Error('Relationship endpoints are invalid.'); if(!RELATION_TYPES.includes(r.type)) throw new Error('Relationship type is invalid.'); await requireEntity(env,r.fromId); await requireEntity(env,r.toId); if(r.eraId) await requireEntity(env,r.eraId,'era','Relationship era'); return;
  }
  if(store==='settings'){
    if(!r?.key||!r.value||typeof r.value!=='object') throw new Error('Setting is invalid.');
    if(r.key==='project'){ if(r.value.currentBookId) await requireEntity(env,r.value.currentBookId,'book','Current book'); for(const id of r.value.storyCompass?.protagonistIds||[]) await requireEntity(env,id,'character','Story Compass protagonist'); }
    return;
  }
  if(store==='clues'){ if(!r?.id) throw new Error('Clue id is required.'); await requireEntity(env,r.mysteryId,'mystery','Mystery'); for(const id of r.mysteryIds||[]) await requireEntity(env,id,'mystery','Linked mystery'); if(r.storyEntityId) await requireEntity(env,r.storyEntityId,['chapter','scene'],'Story entry'); return; }
  if(store==='reveals'){
    if(!r?.id) throw new Error('Reveal id is required.'); if(r.mysteryId) await requireEntity(env,r.mysteryId,'mystery','Mystery'); if(r.targetEntityId) await requireEntity(env,r.targetEntityId); const book=r.bookId?await requireEntity(env,r.bookId,'book','Book'):null; const chapter=r.chapterId?await requireEntity(env,r.chapterId,'chapter','Chapter'):null; const scene=r.sceneId?await requireEntity(env,r.sceneId,'scene','Scene'):null;
    if(book&&chapter&&chapter.fields?.parentBookId!==book.id) throw new Error('Selected chapter does not belong to selected book.'); if(chapter&&scene&&scene.fields?.parentChapterId!==chapter.id) throw new Error('Selected scene does not belong to selected chapter.'); return;
  }
  if(store==='knowledge'){
    if(!r?.id||!KNOWLEDGE_STATES.includes(r.state)||!['reader','character'].includes(r.knowerKind)) throw new Error('Knowledge record is invalid.');
    await requireEntity(env,r.subjectEntityId); if(r.knowerKind==='character') await requireEntity(env,r.knowerEntityId,'character','Character knower'); if(r.storyEntityId) await requireEntity(env,r.storyEntityId,['book','chapter','scene'],'Story entry');
    const duplicate=await env.DB.prepare("SELECT id FROM knowledge WHERE subject_entity_id=? AND knower_kind=? AND COALESCE(knower_entity_id,'')=? AND COALESCE(story_entity_id,'')=? AND id<>? LIMIT 1").bind(r.subjectEntityId,r.knowerKind,r.knowerEntityId||'',r.storyEntityId||'',r.id).first();
    if(duplicate) throw new Error('A knowledge state already exists for this subject, knower, and story point. Edit that record instead.');
    return;
  }
  if(store==='mapVersions'){ if(!r?.id) throw new Error('Map version id is required.'); await requireEntity(env,r.mapId,'map','Map'); if(!await rowExists(env,'media','id',r.mediaId)) throw new Error('Map image media does not exist.'); if(r.variant&&!MAP_VARIANTS.includes(r.variant)) throw new Error('Map variant is invalid.'); return; }
  if(store==='mapMarkers'){
    if(!r?.id||!Number.isFinite(Number(r.x))||Number(r.x)<0||Number(r.x)>100||!Number.isFinite(Number(r.y))||Number(r.y)<0||Number(r.y)>100) throw new Error('Map marker coordinates are invalid.');
    if(!await rowExists(env,'map_versions','id',r.mapVersionId)) throw new Error('Map version does not exist.'); await requireEntity(env,r.locationId,'location','Marker location'); if(r.customMediaId&&!await rowExists(env,'media','id',r.customMediaId)) throw new Error('Marker custom image does not exist.'); if(r.layerId){ const layer=await workspaceById(env,r.layerId); if(!layer||layer.kind!=='mapLayer') throw new Error('Marker layer does not exist.'); } if(r.factionId) await requireEntity(env,r.factionId,['organization','civilization','religion'],'Marker faction'); for(const bookId of r.bookIds||[]) await requireEntity(env,bookId,'book','Marker book'); return;
  }
  if(store==='workspace'){
    if(!r?.id||!WORKSPACE_KINDS.includes(r.kind)||!r.data||typeof r.data!=='object'||Array.isArray(r.data)) throw new Error('Workspace record is invalid.'); const d=r.data;
    if(r.kind==='plotThread'&&d.bookId) await requireEntity(env,d.bookId,'book','Plot thread book');
    if(r.kind==='plotBeat'){ const thread=await workspaceById(env,d.threadId); if(!thread||thread.kind!=='plotThread') throw new Error('Plot beat requires a valid plot thread.'); await requireEntity(env,d.sceneId,'scene','Plot beat scene'); if(d.linkedEntityId) await requireEntity(env,d.linkedEntityId); if(d.clueId&&!await rowExists(env,'clues','id',d.clueId)) throw new Error('Plot beat linked clue does not exist.'); if(d.revealId&&!await rowExists(env,'reveals','id',d.revealId)) throw new Error('Plot beat linked reveal does not exist.'); }
    if(['contextNote','task'].includes(r.kind)&&d.targetId) await requireEntity(env,d.targetId);
    if(r.kind==='calendarDate'){ const cal=await workspaceById(env,d.calendarId); if(!cal||cal.kind!=='calendar') throw new Error('Calendar date requires a valid custom calendar.'); if(d.entityId) await requireEntity(env,d.entityId,['event','scene'],'Calendar date entry'); }
    if(r.kind==='mapLayer'){ if(!await rowExists(env,'map_versions','id',d.mapVersionId)) throw new Error('Map layer requires a valid map version.'); if(d.mediaId&&!await rowExists(env,'media','id',d.mediaId)) throw new Error('Map layer media does not exist.'); }
    if(r.kind==='mapRoute'){ if(!await rowExists(env,'map_versions','id',d.mapVersionId)) throw new Error('Map route requires a valid map version.'); await requireEntity(env,d.characterId,'character','Route character'); if(d.bookId) await requireEntity(env,d.bookId,'book','Route book'); for(const markerId of d.markerIds||[]) if(!await rowExists(env,'map_markers','id',markerId)) throw new Error(`Route marker ${markerId} does not exist.`); }
    if(r.kind==='whiteboardNode'&&d.linkedEntityId) await requireEntity(env,d.linkedEntityId);
    if(r.kind==='whiteboardEdge'){ for(const nodeId of [d.fromNodeId,d.toNodeId]){ const node=await workspaceById(env,nodeId); if(!node||node.kind!=='whiteboardNode') throw new Error('Whiteboard edge requires valid whiteboard nodes.'); } }
    if(r.kind==='manuscriptDocument'){ if(d.bookId) await requireEntity(env,d.bookId,'book','Manuscript book'); if(d.chapterId) await requireEntity(env,d.chapterId,'chapter','Manuscript chapter'); if(d.sceneId) await requireEntity(env,d.sceneId,'scene','Manuscript scene'); }
    if(r.kind==='readerProfile'&&d.pointId) await requireEntity(env,d.pointId,['book','chapter','scene'],'Reader profile story point'); return;
  }
}

function manifestForValidation(data){ return {...data,media:(data.media||[]).map(m=>({...m,archivePath:m.archivePath||`media/${m.id}`}))}; }
async function moveR2ToTrash(env,key){ if(!key) return null; try{ const obj=await env.MEDIA.get(key); if(!obj) return null; const trash=trashObjectKey(key); await env.MEDIA.put(trash,obj.body,{httpMetadata:obj.httpMetadata||{},customMetadata:{...(obj.customMetadata||{}),originalKey:key,trashedAt:now()}}); await env.MEDIA.delete(key); return trash; }catch(e){ console.warn('Could not move R2 object to trash',key,e); return null; } }

async function putMedia(request,env,id){
  const form=await request.formData(); const raw=form.get('metadata'),file=form.get('file'); if(typeof raw!=='string'||!(file instanceof File)) return error('Media upload requires metadata and file.',400);
  const meta=JSON.parse(raw); if(meta.id!==id) return error('Media id mismatch.',400); if(!Array.isArray(meta.tags)||!Array.isArray(meta.entityIds)) return error('Media metadata is invalid.',400); for(const ref of meta.entityIds) await requireEntity(env,ref);
  const old=await env.DB.prepare('SELECT r2_key FROM media WHERE id=?').bind(id).first(); const key=mediaObjectKey(id,file.name||meta.name); await env.MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type||meta.mime||'application/octet-stream'},customMetadata:{mediaId:id}});
  const record={...meta,name:meta.name||file.name,title:meta.title||meta.name||file.name,mime:file.type||meta.mime||'application/octet-stream',size:file.size,r2Key:key,createdAt:meta.createdAt||now()};
  try{ await env.DB.batch([upsertStatement(env,'media',record)]); }catch(e){ await env.MEDIA.delete(key).catch(()=>{}); throw e; }
  if(old?.r2_key&&old.r2_key!==key) await moveR2ToTrash(env,old.r2_key); return json({ok:true,record:{...record,url:`/api/media/${encodeURIComponent(id)}/content`}});
}

async function deleteMedia(env,id){
  const use=await env.DB.prepare('SELECT id FROM map_versions WHERE media_id=? LIMIT 1').bind(id).first(); if(use) throw new Error('This image is used by a map version. Delete that map version first.');
  const markerUse=await env.DB.prepare('SELECT id FROM map_markers WHERE custom_media_id=? LIMIT 1').bind(id).first(); if(markerUse) throw new Error('This image is used by a map marker. Remove that marker image first.');
  const layerRows=await env.DB.prepare("SELECT id,data_json FROM workspace WHERE kind='mapLayer'").all(); if((layerRows.results||[]).some(r=>safeJson(r.data_json,{}).mediaId===id)) throw new Error('This image is used by a map layer. Remove that layer first.');
  const portraitUse=await env.DB.prepare("SELECT id,name FROM entities WHERE type IN ('character','deity') AND json_extract(fields_json,'$.portraitMediaId')=? LIMIT 1").bind(id).first(); if(portraitUse) throw new Error(`This image is the portrait for ${portraitUse.name||'an entry'}. Remove it as the portrait first.`);
  const row=await env.DB.prepare('SELECT r2_key FROM media WHERE id=?').bind(id).first(); if(!row) return; await env.DB.batch([env.DB.prepare('DELETE FROM media WHERE id=?').bind(id)]); await moveR2ToTrash(env,row.r2_key);
}

async function deleteMapVersionCascade(env,id){
  const version=await env.DB.prepare('SELECT * FROM map_versions WHERE id=?').bind(id).first(); if(!version) return; const media=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(version.media_id).first(); const other=await env.DB.prepare('SELECT id FROM map_versions WHERE id<>? AND media_id=? LIMIT 1').bind(id,version.media_id).first();
  const entityIds=media?safeJson(media.entity_ids_json,[]):[],linkedElsewhere=entityIds.some(x=>x!==version.map_id); const workspaceRows=await env.DB.prepare('SELECT * FROM workspace').all(); const workspace=(workspaceRows.results||[]).map(r=>rowToRecord('workspace',r));
  const deleteWorkspace=workspace.filter(w=>['mapLayer','mapRoute'].includes(w.kind)&&w.data?.mapVersionId===id);
  const stmts=[env.DB.prepare('DELETE FROM map_markers WHERE map_version_id=?').bind(id),env.DB.prepare('DELETE FROM map_versions WHERE id=?').bind(id),...deleteWorkspace.map(w=>env.DB.prepare('DELETE FROM workspace WHERE id=?').bind(w.id))];
  let deleteKey=null; if(media&&!other&&!linkedElsewhere){ stmts.push(env.DB.prepare('DELETE FROM media WHERE id=?').bind(version.media_id)); deleteKey=media.r2_key; }
  await batchStatements(env,stmts); if(deleteKey) await moveR2ToTrash(env,deleteKey);
}

function referencesEntityInWorkspace(item,id){ const d=item.data||{}; if(item.kind==='revision') return d.entityId===id; return [d.targetId,d.sceneId,d.linkedEntityId,d.entityId,d.characterId,d.bookId,d.chapterId,d.linkedEntityId,d.pointId].includes(id); }
async function deleteEntityCascade(env,id){
  const data=await snapshot(env,{includeRevisions:true}),target=data.entities.find(e=>e.id===id); if(!target) return;
  const blocking=data.entities.filter(e=>!e.archivedAt&&e.id!==id&&(e.fields?.parentLocationId===id||e.fields?.parentBookId===id||e.fields?.parentChapterId===id)); if(blocking.length) throw new Error(`Cannot permanently delete this entry while ${blocking.length} active child ${blocking.length===1?'entry references':'entries reference'} it.`);
  const changed=[]; for(const e of data.entities){ if(e.id===id) continue; const fields={...(e.fields||{})}; let dirty=false; for(const k of ['eraId','storyEntityId','scopeLocationId','parentMapId','locationId','parentLocationId','parentBookId','parentChapterId']) if(fields[k]===id){fields[k]='';dirty=true;} if(dirty) changed.push({...e,fields,updatedAt:now()}); }
  const removedVersions=data.mapVersions.filter(v=>v.mapId===id),candidateMediaIds=new Set(removedVersions.map(v=>v.mediaId));
  const stmts=[env.DB.prepare('DELETE FROM entities WHERE id=?').bind(id),env.DB.prepare('DELETE FROM relations WHERE from_id=? OR to_id=?').bind(id,id),env.DB.prepare('DELETE FROM clues WHERE mystery_id=? OR story_entity_id=?').bind(id,id),env.DB.prepare('DELETE FROM reveals WHERE mystery_id=? OR target_entity_id=? OR book_id=? OR chapter_id=? OR scene_id=?').bind(id,id,id,id,id),env.DB.prepare('DELETE FROM knowledge WHERE subject_entity_id=? OR knower_entity_id=? OR story_entity_id=?').bind(id,id,id),env.DB.prepare('DELETE FROM map_markers WHERE location_id=?').bind(id),env.DB.prepare('DELETE FROM map_versions WHERE map_id=?').bind(id)];
  for(const v of removedVersions) stmts.push(env.DB.prepare('DELETE FROM map_markers WHERE map_version_id=?').bind(v.id)); for(const e of changed) stmts.push(upsertStatement(env,'entities',e));
  for(const w of data.workspace.filter(w=>referencesEntityInWorkspace(w,id))) stmts.push(env.DB.prepare('DELETE FROM workspace WHERE id=?').bind(w.id));
  const r2Deletes=[]; for(const m of data.media){ const ids=(m.entityIds||[]).filter(x=>x!==id),referencedByOtherVersion=data.mapVersions.some(v=>v.mapId!==id&&v.mediaId===m.id); if(candidateMediaIds.has(m.id)&&!referencedByOtherVersion&&!ids.length){stmts.push(env.DB.prepare('DELETE FROM media WHERE id=?').bind(m.id));if(m.r2Key)r2Deletes.push(m.r2Key);} else if((m.entityIds||[]).includes(id)) stmts.push(env.DB.prepare('UPDATE media SET entity_ids_json=? WHERE id=?').bind(JSON.stringify(ids),m.id)); }
  const project=data.settings.find(s=>s.key==='project'); if(project){ let dirty=false; const value=structuredClone(project.value||{}); if(value.currentBookId===id){value.currentBookId=null;dirty=true;} if(value.storyCompass?.protagonistIds?.includes(id)){value.storyCompass.protagonistIds=value.storyCompass.protagonistIds.filter(x=>x!==id);dirty=true;} if(dirty) stmts.push(upsertStatement(env,'settings',{...project,value})); }
  await batchStatements(env,stmts); for(const key of r2Deletes) await moveR2ToTrash(env,key);
}

async function deleteMapMarker(env,id){
  const workspace=await readStore(env,'workspace'); const stmts=[env.DB.prepare('DELETE FROM map_markers WHERE id=?').bind(id)];
  for(const route of workspace.filter(w=>w.kind==='mapRoute'&&(w.data?.markerIds||[]).includes(id))){ stmts.push(upsertStatement(env,'workspace',{...route,data:{...route.data,markerIds:route.data.markerIds.filter(x=>x!==id)},updatedAt:now()})); }
  await batchStatements(env,stmts);
}

async function prepareRestore(request,env){ const raw=await request.json(),migrated=migrateBackupData(raw); assertValidBackupSnapshot(manifestForValidation(migrated)); const restoreId=crypto.randomUUID(),manifest={...migrated,media:(migrated.media||[]).map(({blob,dataUrl,url,r2Key,...m})=>m)}; await env.MEDIA.put(`_restore/${restoreId}/manifest.json`,JSON.stringify(manifest),{httpMetadata:{contentType:'application/json'}}); return json({ok:true,restoreId,mediaIds:manifest.media.map(m=>m.id)}); }
async function uploadRestoreMedia(request,env,restoreId,mediaId){ const manifestObj=await env.MEDIA.get(`_restore/${restoreId}/manifest.json`); if(!manifestObj) return error('Restore session not found.',404); const manifest=JSON.parse(await manifestObj.text()),meta=manifest.media.find(m=>m.id===mediaId); if(!meta) return error('Media is not part of this restore.',404); const bytes=await request.arrayBuffer(); if(!bytes.byteLength) return error('Restore media file is empty.',400); await env.MEDIA.put(`_restore/${restoreId}/media/${cleanPathPart(mediaId)}`,bytes,{httpMetadata:{contentType:meta.mime||request.headers.get('content-type')||'application/octet-stream'}}); return json({ok:true}); }
export async function replaceStructuredSnapshot(env,manifest,finalized){
  const stmts=[];
  for(const store of DATA_STORES) stmts.push(env.DB.prepare(`DELETE FROM ${TABLE[store]}`));
  for(const store of DATA_STORES){ const records=store==='media'?finalized:(manifest[store]||[]); for(const record of records) stmts.push(upsertStatement(env,store,record)); }
  // One D1 batch is one transaction. Do not chunk destructive restore writes across independent batches.
  await env.DB.batch(stmts);
}

async function commitRestore(env,restoreId){
  const manifestKey=`_restore/${restoreId}/manifest.json`,manifestObj=await env.MEDIA.get(manifestKey); if(!manifestObj) throw new Error('Restore session not found.'); const manifest=migrateBackupData(JSON.parse(await manifestObj.text())); assertValidBackupSnapshot(manifestForValidation(manifest)); const oldMedia=await readStore(env,'media'),finalized=[],newKeys=[];
  try{ for(const meta of manifest.media){ const staged=await env.MEDIA.get(`_restore/${restoreId}/media/${cleanPathPart(meta.id)}`); if(!staged) throw new Error(`Restore media ${meta.name||meta.id} was not uploaded.`); const key=mediaObjectKey(meta.id,meta.name); await env.MEDIA.put(key,staged.body,{httpMetadata:{contentType:meta.mime||'application/octet-stream'},customMetadata:{mediaId:meta.id}}); newKeys.push(key); finalized.push({...meta,r2Key:key}); }
    await replaceStructuredSnapshot(env,manifest,finalized);
  }catch(e){ if(newKeys.length) await env.MEDIA.delete(newKeys).catch(()=>{}); throw e; }
  for(const old of oldMedia) if(old.r2Key) await moveR2ToTrash(env,old.r2Key); const cleanup=[manifestKey,...manifest.media.map(m=>`_restore/${restoreId}/media/${cleanPathPart(m.id)}`)]; try{await env.MEDIA.delete(cleanup);}catch(e){console.warn('Could not fully clean restore staging objects',e);} return json({ok:true,counts:Object.fromEntries(DATA_STORES.map(s=>[s,(s==='media'?finalized:manifest[s]||[]).length]))});
}

function revisionStatement(env,existing,identity){ if(!existing) return null; const record={id:crypto.randomUUID(),kind:'revision',title:`${existing.name} — ${existing.updatedAt}`,data:{entityId:existing.id,snapshot:existing,changedBy:identity?.email||null},createdAt:now(),updatedAt:now()}; return upsertStatement(env,'workspace',record); }

export async function handleApi(request,env,identity){
  const url=new URL(request.url),path=url.pathname,method=request.method.toUpperCase();
  if(path==='/api/health'&&method==='GET'){
    try{ const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entities'").first(); if(!table) return json({ok:false,ready:false,error:'D1 migrations have not been applied.'},503); const counts=await env.DB.batch([env.DB.prepare('SELECT COUNT(*) AS n FROM entities'),env.DB.prepare('SELECT COUNT(*) AS n FROM media'),env.DB.prepare('SELECT COUNT(*) AS n FROM workspace')]); return json({ok:true,ready:true,app:'UnWritten',version:'3.2.0',storage:'Cloudflare D1 + private R2',entities:Number(counts[0]?.results?.[0]?.n||0),media:Number(counts[1]?.results?.[0]?.n||0),workspace:Number(counts[2]?.results?.[0]?.n||0),accessEmail:identity.email,role:identity.role}); }catch(e){ return error(`Storage is not ready: ${e.message}`,503); }
  }
  if(path==='/api/snapshot'&&method==='GET') return json({ok:true,...await snapshot(env)});
  const revisionRoute=path.match(/^\/api\/entities\/([^/]+)\/revisions$/); if(revisionRoute&&method==='GET') return json({ok:true,revisions:await readEntityRevisions(env,decodeURIComponent(revisionRoute[1]),url.searchParams.get('limit')||50)});
  if(path==='/api/revisions'&&method==='GET') return json({ok:true,revisions:await readAllRevisions(env)});
  if(method!=='GET'&&method!=='HEAD') requireOwner(identity);
  if(path==='/api/restore/prepare'&&method==='POST') return prepareRestore(request,env);
  const restoreMedia=path.match(/^\/api\/restore\/([^/]+)\/media\/([^/]+)$/); if(restoreMedia&&method==='PUT') return uploadRestoreMedia(request,env,decodeURIComponent(restoreMedia[1]),decodeURIComponent(restoreMedia[2]));
  const restoreCommit=path.match(/^\/api\/restore\/([^/]+)\/commit$/); if(restoreCommit&&method==='POST') return commitRestore(env,decodeURIComponent(restoreCommit[1]));
  const mediaContent=path.match(/^\/api\/media\/([^/]+)\/content$/); if(mediaContent&&method==='GET'){ const id=decodeURIComponent(mediaContent[1]),row=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first(); if(!row) return error('Media not found.',404); const obj=await env.MEDIA.get(row.r2_key); if(!obj) return error('Media object is missing from R2.',404); const headers=new Headers(); obj.writeHttpMetadata(headers); headers.set('content-type',row.mime||headers.get('content-type')||'application/octet-stream'); headers.set('cache-control','private, max-age=3600'); headers.set('etag',obj.httpEtag); return new Response(obj.body,{headers}); }
  const mediaRoute=path.match(/^\/api\/media\/([^/]+)$/); if(mediaRoute){ const id=decodeURIComponent(mediaRoute[1]); if(method==='PUT') return putMedia(request,env,id); if(method==='DELETE'){await deleteMedia(env,id);return json({ok:true});} }
  const entityCascade=path.match(/^\/api\/entities\/([^/]+)\/cascade$/); if(entityCascade&&method==='DELETE'){await deleteEntityCascade(env,decodeURIComponent(entityCascade[1]));return json({ok:true});}
  const mapCascade=path.match(/^\/api\/map-versions\/([^/]+)\/cascade$/); if(mapCascade&&method==='DELETE'){await deleteMapVersionCascade(env,decodeURIComponent(mapCascade[1]));return json({ok:true});}
  const storeRoute=path.match(/^\/api\/store\/([^/]+)\/([^/]+)$/); if(storeRoute){
    const store=decodeURIComponent(storeRoute[1]),key=decodeURIComponent(storeRoute[2]); if(!DATA_STORES.includes(store)||store==='media') return error('Unsupported store.',404);
    if(method==='PUT'){
      const record=await request.json(),expected=store==='settings'?record.key:record.id; if(expected!==key) return error('Record key mismatch.',400); await validateRecord(env,store,record);
      if(store==='entities'){
        const existing=await oneEntity(env,key),base=request.headers.get('x-base-updated-at'); if(existing&&base&&existing.updatedAt!==base) return error('This entry changed elsewhere. Reload before overwriting.',409,{currentUpdatedAt:existing.updatedAt});
        const revision=revisionStatement(env,existing,identity); await env.DB.batch(revision?[revision,upsertStatement(env,store,record)]:[upsertStatement(env,store,record)]); return json({ok:true});
      }
      await env.DB.batch([upsertStatement(env,store,record)]); return json({ok:true});
    }
    if(method==='DELETE'){
      if(['entities','mapVersions'].includes(store)) return error('This record type requires its dedicated cascade deletion route.',409);
      if(store==='mapMarkers'){await deleteMapMarker(env,key);return json({ok:true});}
      const keyCol=store==='settings'?'key':'id'; await env.DB.batch([env.DB.prepare(`DELETE FROM ${TABLE[store]} WHERE ${keyCol}=?`).bind(key)]); return json({ok:true});
    }
  }
  return error('API route not found.',404);
}

export default {
  async fetch(request,env){
    try{ const url=new URL(request.url); if(!url.pathname.startsWith('/api/')) return new Response('Not found',{status:404}); const identity=await authenticate(request,env); return await handleApi(request,env,identity); }
    catch(e){ console.error(e); return error(e?.message||'Unexpected server error.',e?.status||500); }
  }
};
