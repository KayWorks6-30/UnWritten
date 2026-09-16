import { APP_VERSION, RELATION_TYPES, RELATION_STATUSES, STORY_POINT_TYPES, KNOWLEDGE_STATES, MAP_VARIANTS, WORKSPACE_KINDS, validateEntity, referenceFieldsForType } from '../js/domain/schema.js';
import { referenceEdgesForRecord, buildReferenceIndex } from '../js/domain/references.js';
import { migrateBackupData } from '../js/data/migrations.js';
import { assertValidBackupSnapshot } from '../js/data/validation.js';
import { DATA_STORES, TABLE, rowToRecord, upsertStatement, readStore, readRecord } from './lib/records.js';
import { planEntityCascade, planMapVersionCascade, planWorkspaceDelete, cleanupPlotBeatLinks } from './lib/cascade.js';

const JSON_HEADERS = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' };
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
async function batchDerivedStatements(env,statements,{chunkSize=100}={}){
  for(let i=0;i<statements.length;i+=chunkSize) await env.DB.batch(statements.slice(i,i+chunkSize));
}
function referenceIndexStatements(env,store,record){
  const sourceId=store==='settings'?record?.key:record?.id;
  if(!sourceId) return [];
  const statements=[env.DB.prepare('DELETE FROM reference_index WHERE source_store=? AND source_id=?').bind(store,sourceId)];
  for(const edge of referenceEdgesForRecord(store,record)) statements.push(env.DB.prepare(`INSERT INTO reference_index (source_store,source_id,source_field,target_entity_id,source_entity_id,kind) VALUES (?,?,?,?,?,?) ON CONFLICT(source_store,source_id,source_field,target_entity_id) DO UPDATE SET source_entity_id=excluded.source_entity_id,kind=excluded.kind`).bind(edge.sourceStore,edge.sourceId,edge.sourceField,edge.targetEntityId,edge.sourceEntityId||null,edge.kind||'Structured reference'));
  return statements;
}
async function rebuildReferenceIndex(env,snapshotData=null){
  const data=snapshotData||await snapshot(env,{includeRevisions:false});
  const edges=buildReferenceIndex(data);
  // reference_index is derived and rebuildable. Clear first, then repopulate in bounded
  // batches so a large project cannot exceed D1's practical batch/request limits. If a
  // rebuild is interrupted, deep diagnostics reports the missing edges and a rerun heals it.
  await env.DB.batch([env.DB.prepare('DELETE FROM reference_index')]);
  const statements=edges.map(edge=>env.DB.prepare(`INSERT INTO reference_index (source_store,source_id,source_field,target_entity_id,source_entity_id,kind) VALUES (?,?,?,?,?,?)`).bind(edge.sourceStore,edge.sourceId,edge.sourceField,edge.targetEntityId,edge.sourceEntityId||null,edge.kind||'Structured reference'));
  await batchDerivedStatements(env,statements,{chunkSize:100});
  return {edges:edges.length};
}
async function entityImpact(env,entityId){
  const result=await env.DB.prepare('SELECT source_store,source_id,source_field,target_entity_id,source_entity_id,kind FROM reference_index WHERE target_entity_id=? ORDER BY source_store,source_id,source_field').bind(entityId).all();
  return (result.results||[]).map(row=>({sourceStore:row.source_store,sourceId:row.source_id,sourceField:row.source_field,targetEntityId:row.target_entity_id,sourceEntityId:row.source_entity_id||null,kind:row.kind||'Structured reference'}));
}
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
    for(const spec of referenceFieldsForType(r.type)){
      const values=spec.many?(Array.isArray(f[spec.key])?f[spec.key]:[]):[f[spec.key]];
      for(const value of values){
        if(!value) continue;
        if(value===r.id && ['parentLocationId','parentMapId','parentBookId','parentPartId','parentChapterId'].includes(spec.key)) throw new Error(`${spec.role||'Parent'} cannot reference the entry itself.`);
        await requireEntity(env,value,spec.types,spec.role||'Referenced entry');
      }
    }
    if(r.type==='chapter'&&f.parentPartId){
      const part=await requireEntity(env,f.parentPartId,'part','Parent part');
      if(f.parentBookId&&part.fields?.parentBookId!==f.parentBookId) throw new Error('Selected part does not belong to selected book.');
    }
    if(r.type==='location') await assertNoParentCycle(env,r,'parentLocationId','location','Location');
    if(r.type==='map') await assertNoParentCycle(env,r,'parentMapId','map','Map');
    if(['character','deity'].includes(r.type)&&f.portraitMediaId&&!await rowExists(env,'media','id',f.portraitMediaId)) throw new Error('Character portrait media does not exist.');
    return;
  }
  if(store==='relations'){
    if(!r?.id||!r.fromId||!r.toId||r.fromId===r.toId) throw new Error('Relationship endpoints are invalid.'); if(!RELATION_TYPES.includes(r.type)) throw new Error('Relationship type is invalid.'); if(r.status&&!RELATION_STATUSES.includes(r.status)) throw new Error('Relationship status is invalid.'); await requireEntity(env,r.fromId); await requireEntity(env,r.toId); if(r.eraId) await requireEntity(env,r.eraId,'era','Relationship era'); return;
  }
  if(store==='settings'){
    if(!r?.key||!r.value||typeof r.value!=='object') throw new Error('Setting is invalid.');
    if(r.key==='project'){ if(r.value.currentBookId) await requireEntity(env,r.value.currentBookId,'book','Current book'); for(const id of r.value.storyCompass?.protagonistIds||[]) await requireEntity(env,id,'character','Story Compass protagonist'); }
    return;
  }
  if(store==='clues'){ if(!r?.id) throw new Error('Clue id is required.'); await requireEntity(env,r.mysteryId,'mystery','Mystery'); for(const id of r.mysteryIds||[]) await requireEntity(env,id,'mystery','Linked mystery'); if(r.storyEntityId) await requireEntity(env,r.storyEntityId,['part','chapter','scene'],'Story entry'); return; }
  if(store==='reveals'){
    if(!r?.id) throw new Error('Reveal id is required.'); if(r.mysteryId) await requireEntity(env,r.mysteryId,'mystery','Mystery'); if(r.targetEntityId) await requireEntity(env,r.targetEntityId); const book=r.bookId?await requireEntity(env,r.bookId,'book','Book'):null; const part=r.partId?await requireEntity(env,r.partId,'part','Part'):null; const chapter=r.chapterId?await requireEntity(env,r.chapterId,'chapter','Chapter'):null; const scene=r.sceneId?await requireEntity(env,r.sceneId,'scene','Scene'):null;
    if(book&&part&&part.fields?.parentBookId!==book.id) throw new Error('Selected part does not belong to selected book.');
    if(book&&chapter&&chapter.fields?.parentBookId!==book.id) throw new Error('Selected chapter does not belong to selected book.');
    if(part&&chapter&&chapter.fields?.parentPartId!==part.id) throw new Error('Selected chapter does not belong to selected part.');
    if(chapter&&scene&&scene.fields?.parentChapterId!==chapter.id) throw new Error('Selected scene does not belong to selected chapter.'); return;
  }
  if(store==='knowledge'){
    if(!r?.id||!KNOWLEDGE_STATES.includes(r.state)||!['reader','character'].includes(r.knowerKind)) throw new Error('Knowledge record is invalid.');
    await requireEntity(env,r.subjectEntityId); if(r.knowerKind==='character') await requireEntity(env,r.knowerEntityId,'character','Character knower'); if(r.storyEntityId) await requireEntity(env,r.storyEntityId,STORY_POINT_TYPES,'Story entry');
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
    if(r.kind==='manuscriptDocument'){ if(d.bookId) await requireEntity(env,d.bookId,'book','Manuscript book'); if(d.partId) await requireEntity(env,d.partId,'part','Manuscript part'); if(d.chapterId) await requireEntity(env,d.chapterId,'chapter','Manuscript chapter'); if(d.sceneId) await requireEntity(env,d.sceneId,'scene','Manuscript scene'); }
    if(r.kind==='readerProfile'&&d.pointId) await requireEntity(env,d.pointId,STORY_POINT_TYPES,'Reader profile story point'); return;
  }
}


function normalizeForWrite(store,record,existing=null){
  const stamp=now(),next=structuredClone(record||{});
  if(store==='settings') return {...next,updatedAt:stamp};
  next.createdAt=existing?.createdAt||next.createdAt||stamp;
  next.updatedAt=stamp;
  return next;
}
function concurrencyError(current){ return Object.assign(new Error('This record changed elsewhere. Reload before overwriting.'),{status:409,details:{currentUpdatedAt:current?.updatedAt||null}}); }
function missingBaseVersionError(current){ return Object.assign(new Error('A base record version is required before modifying an existing record. Reload it and try again.'),{status:428,details:{currentUpdatedAt:current?.updatedAt||null}}); }
function assertFresh(existing,baseUpdatedAt){
  if(!existing) return;
  if(!baseUpdatedAt) throw missingBaseVersionError(existing);
  if(existing.updatedAt&&existing.updatedAt!==baseUpdatedAt) throw concurrencyError(existing);
}
async function mutateStoreRecord(env,store,record,{baseUpdatedAt=null,identity=null}={}){
  const key=store==='settings'?record?.key:record?.id;
  if(!key) throw new Error('Record key is required.');
  const existing=await readRecord(env,store,key);
  assertFresh(existing,baseUpdatedAt);
  const normalized=normalizeForWrite(store,record,existing);
  await validateRecord(env,store,normalized);
  const revision=store==='entities'?revisionStatement(env,existing,identity):null;
  const writes=[...(revision?[revision]:[]),upsertStatement(env,store,normalized),...referenceIndexStatements(env,store,normalized)];
  await env.DB.batch(writes);
  return normalized;
}

async function queryEntities(env,params){
  const q=String(params.get('q')||'').trim().toLowerCase();
  const type=String(params.get('type')||'').trim();
  const status=String(params.get('status')||'').trim();
  const archived=String(params.get('archived')||'active').trim();
  const limit=Math.max(1,Math.min(100,Number(params.get('limit'))||50));
  const offset=Math.max(0,Number(params.get('cursor'))||0);
  const where=[],bind=[];
  if(type){where.push('type=?');bind.push(type);}
  if(status){where.push('status=?');bind.push(status);}
  if(archived==='active') where.push('archived_at IS NULL');
  else if(archived==='archived') where.push('archived_at IS NOT NULL');
  if(q){ where.push(`(lower(name) LIKE ? OR lower(summary) LIKE ? OR lower(notes) LIKE ? OR lower(tags_json) LIKE ? OR lower(fields_json) LIKE ?)`); const like=`%${q}%`; bind.push(like,like,like,like,like); }
  const clause=where.length?` WHERE ${where.join(' AND ')}`:'';
  const count=await env.DB.prepare(`SELECT COUNT(*) AS n FROM entities${clause}`).bind(...bind).first();
  const result=await env.DB.prepare(`SELECT * FROM entities${clause} ORDER BY favorite DESC, updated_at DESC, name COLLATE NOCASE ASC LIMIT ? OFFSET ?`).bind(...bind,limit,offset).all();
  const records=(result.results||[]).map(row=>rowToRecord('entities',row));
  const total=Number(count?.n)||0;
  return {records,total,nextCursor:offset+records.length<total?String(offset+records.length):null};
}

function edgeKey(edge){ return [edge.sourceStore,edge.sourceId,edge.sourceField,edge.targetEntityId].join('\u001f'); }
async function diagnostics(env,{deep=false}={}){
  const started=Date.now();
  const countStatements=[...DATA_STORES.map(store=>env.DB.prepare(`SELECT COUNT(*) AS n FROM ${TABLE[store]}${store==='workspace'?" WHERE kind<>'revision'":''}`)),env.DB.prepare('SELECT COUNT(*) AS n FROM reference_index'),env.DB.prepare("SELECT COUNT(*) AS n FROM workspace WHERE kind='revision'"),env.DB.prepare('PRAGMA integrity_check')];
  const results=await env.DB.batch(countStatements);
  const counts=Object.fromEntries(DATA_STORES.map((store,i)=>[store,Number(results[i]?.results?.[0]?.n)||0]));
  const referenceIndexCount=Number(results[DATA_STORES.length]?.results?.[0]?.n)||0;
  const revisionCount=Number(results[DATA_STORES.length+1]?.results?.[0]?.n)||0;
  const integrity=(results[DATA_STORES.length+2]?.results||[]).map(row=>Object.values(row)[0]);
  const orphanTargets=await env.DB.prepare('SELECT COUNT(*) AS n FROM reference_index r LEFT JOIN entities e ON e.id=r.target_entity_id WHERE e.id IS NULL').first();
  const brokenNarrative=await env.DB.prepare(`SELECT COUNT(*) AS n FROM entities e WHERE (e.type='part' AND (e.parent_book_id IS NULL OR NOT EXISTS(SELECT 1 FROM entities b WHERE b.id=e.parent_book_id AND b.type='book'))) OR (e.type='chapter' AND ((e.parent_book_id IS NULL AND e.parent_part_id IS NULL) OR (e.parent_book_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM entities b WHERE b.id=e.parent_book_id AND b.type='book')) OR (e.parent_part_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM entities p WHERE p.id=e.parent_part_id AND p.type='part')))) OR (e.type='scene' AND (e.parent_chapter_id IS NULL OR NOT EXISTS(SELECT 1 FROM entities c WHERE c.id=e.parent_chapter_id AND c.type='chapter')))` ).first();
  const out={ok:true,generatedAt:now(),counts,revisionCount,referenceIndex:{rows:referenceIndexCount,orphanTargets:Number(orphanTargets?.n)||0},narrative:{brokenPositions:Number(brokenNarrative?.n)||0},sqlite:{integrity},timings:{shallowMs:Date.now()-started}};
  if(deep){
    const deepStarted=Date.now(),data=await snapshot(env,{includeRevisions:false}),expected=buildReferenceIndex(data),actualRows=await env.DB.prepare('SELECT source_store,source_id,source_field,target_entity_id,source_entity_id,kind FROM reference_index').all();
    const actual=(actualRows.results||[]).map(row=>({sourceStore:row.source_store,sourceId:row.source_id,sourceField:row.source_field,targetEntityId:row.target_entity_id,sourceEntityId:row.source_entity_id||null,kind:row.kind||'Structured reference'}));
    const expectedSet=new Set(expected.map(edgeKey)),actualSet=new Set(actual.map(edgeKey));
    out.referenceIndex.expectedRows=expected.length;
    out.referenceIndex.missing=[...expectedSet].filter(key=>!actualSet.has(key)).length;
    out.referenceIndex.stale=[...actualSet].filter(key=>!expectedSet.has(key)).length;
    out.referenceIndex.inSync=out.referenceIndex.missing===0&&out.referenceIndex.stale===0;
    out.timings.deepMs=Date.now()-deepStarted;
    out.snapshotBytes=JSON.stringify(data).length;
  }
  return out;
}

function manifestForValidation(data){ return {...data,media:(data.media||[]).map(m=>({...m,archivePath:m.archivePath||`media/${m.id}`}))}; }
async function moveR2ToTrash(env,key){ if(!key) return null; try{ const obj=await env.MEDIA.get(key); if(!obj) return null; const trash=trashObjectKey(key); await env.MEDIA.put(trash,obj.body,{httpMetadata:obj.httpMetadata||{},customMetadata:{...(obj.customMetadata||{}),originalKey:key,trashedAt:now()}}); await env.MEDIA.delete(key); return trash; }catch(e){ console.warn('Could not move R2 object to trash',key,e); return null; } }

async function putMedia(request,env,id){
  const form=await request.formData(); const raw=form.get('metadata'),file=form.get('file'); if(typeof raw!=='string'||!(file instanceof File)) return error('Media upload requires metadata and file.',400);
  const meta=JSON.parse(raw); if(meta.id!==id) return error('Media id mismatch.',400); if(!Array.isArray(meta.tags)||!Array.isArray(meta.entityIds)) return error('Media metadata is invalid.',400); for(const ref of meta.entityIds) await requireEntity(env,ref);
  const existing=await readRecord(env,'media',id); assertFresh(existing,request.headers.get('x-base-updated-at'));
  const oldKey=existing?.r2Key||null,key=mediaObjectKey(id,file.name||meta.name); await env.MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type||meta.mime||'application/octet-stream'},customMetadata:{mediaId:id}});
  const record=normalizeForWrite('media',{...meta,name:meta.name||file.name,title:meta.title||meta.name||file.name,mime:file.type||meta.mime||'application/octet-stream',size:file.size,r2Key:key},existing);
  try{ await env.DB.batch([upsertStatement(env,'media',record),...referenceIndexStatements(env,'media',record)]); }catch(e){ await env.MEDIA.delete(key).catch(()=>{}); throw e; }
  if(oldKey&&oldKey!==key) await moveR2ToTrash(env,oldKey); return json({ok:true,record:{...record,url:`/api/media/${encodeURIComponent(id)}/content`}});
}

async function deleteMedia(env,id,baseUpdatedAt=null){
  const existing=await readRecord(env,'media',id); assertFresh(existing,baseUpdatedAt);
  const use=await env.DB.prepare('SELECT id FROM map_versions WHERE media_id=? LIMIT 1').bind(id).first(); if(use) throw new Error('This image is used by a map version. Delete that map version first.');
  const markerUse=await env.DB.prepare('SELECT id FROM map_markers WHERE custom_media_id=? LIMIT 1').bind(id).first(); if(markerUse) throw new Error('This image is used by a map marker. Remove that marker image first.');
  const layerRows=await env.DB.prepare("SELECT id,data_json FROM workspace WHERE kind='mapLayer'").all(); if((layerRows.results||[]).some(r=>safeJson(r.data_json,{}).mediaId===id)) throw new Error('This image is used by a map layer. Remove that layer first.');
  const portraitUse=await env.DB.prepare("SELECT id,name FROM entities WHERE type IN ('character','deity') AND json_extract(fields_json,'$.portraitMediaId')=? LIMIT 1").bind(id).first(); if(portraitUse) throw new Error(`This image is the portrait for ${portraitUse.name||'an entry'}. Remove it as the portrait first.`);
  const row=await env.DB.prepare('SELECT r2_key FROM media WHERE id=?').bind(id).first(); if(!row) return; await env.DB.batch([env.DB.prepare('DELETE FROM media WHERE id=?').bind(id),env.DB.prepare("DELETE FROM reference_index WHERE source_store='media' AND source_id=?").bind(id)]); await moveR2ToTrash(env,row.r2_key);
}

async function deleteMapVersionCascade(env,id,baseUpdatedAt=null){
  const current=await readRecord(env,'mapVersions',id); assertFresh(current,baseUpdatedAt);
  const data=await snapshot(env,{includeRevisions:true}),plan=planMapVersionCascade(data,id,now()); if(!plan.version) return;
  const stmts=[];
  for(const markerId of plan.deletes.mapMarkers) stmts.push(env.DB.prepare('DELETE FROM map_markers WHERE id=?').bind(markerId));
  for(const workspaceId of plan.deletes.workspace) stmts.push(env.DB.prepare('DELETE FROM workspace WHERE id=?').bind(workspaceId));
  for(const marker of plan.updates.mapMarkers) stmts.push(upsertStatement(env,'mapMarkers',marker));
  for(const item of plan.updates.workspace) stmts.push(upsertStatement(env,'workspace',item));
  stmts.push(env.DB.prepare('DELETE FROM map_versions WHERE id=?').bind(id));
  const mediaById=new Map((data.media||[]).map(item=>[item.id,item])),r2Deletes=[];
  for(const mediaId of plan.deletes.media){ stmts.push(env.DB.prepare('DELETE FROM media WHERE id=?').bind(mediaId)); const media=mediaById.get(mediaId); if(media?.r2Key) r2Deletes.push(media.r2Key); }
  await batchStatements(env,stmts); await rebuildReferenceIndex(env); for(const key of r2Deletes) await moveR2ToTrash(env,key);
}

async function deleteEntityCascade(env,id,baseUpdatedAt=null){
  const current=await readRecord(env,'entities',id); assertFresh(current,baseUpdatedAt);
  const data=await snapshot(env,{includeRevisions:true}),plan=planEntityCascade(data,id,now()); if(!plan.target) return;
  if(plan.blocking.length) throw new Error(`Cannot permanently delete this entry while ${plan.blocking.length} active child ${plan.blocking.length===1?'entry references':'entries reference'} it.`);
  const stmts=[],r2Deletes=[],mediaById=new Map((data.media||[]).map(item=>[item.id,item]));
  const deletes=[['relations','relations'],['clues','clues'],['reveals','reveals'],['knowledge','knowledge'],['mapVersions','map_versions'],['mapMarkers','map_markers'],['workspace','workspace'],['media','media']];
  for(const [key,table] of deletes) for(const recordId of plan.deletes[key]) stmts.push(env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(recordId));
  for(const mediaId of plan.deletes.media){ const media=mediaById.get(mediaId); if(media?.r2Key) r2Deletes.push(media.r2Key); }
  const updates=[['entities','entities'],['relations','relations'],['clues','clues'],['mapMarkers','mapMarkers'],['workspace','workspace'],['media','media'],['settings','settings']];
  for(const [key,store] of updates) for(const record of plan.updates[key]) stmts.push(upsertStatement(env,store,record));
  stmts.push(env.DB.prepare('DELETE FROM entities WHERE id=?').bind(id));
  await batchStatements(env,stmts); await rebuildReferenceIndex(env); for(const key of r2Deletes) await moveR2ToTrash(env,key);
}

async function deleteMapMarker(env,id){
  const workspace=await readStore(env,'workspace'); const stmts=[env.DB.prepare('DELETE FROM map_markers WHERE id=?').bind(id)];
  for(const route of workspace.filter(w=>w.kind==='mapRoute'&&(w.data?.markerIds||[]).includes(id))){ stmts.push(upsertStatement(env,'workspace',{...route,data:{...route.data,markerIds:route.data.markerIds.filter(x=>x!==id)},updatedAt:now()})); }
  await batchStatements(env,stmts); await rebuildReferenceIndex(env);
}

async function deleteWorkspaceCascade(env,id){
  const [workspace,mapMarkers]=await Promise.all([readStore(env,'workspace',{includeRevisions:true}),readStore(env,'mapMarkers')]);
  const plan=planWorkspaceDelete(workspace,mapMarkers,id,now()); if(!plan.target) return;
  const stmts=[];
  for(const workspaceId of plan.deletes) stmts.push(env.DB.prepare('DELETE FROM workspace WHERE id=?').bind(workspaceId));
  for(const marker of plan.markerUpdates) stmts.push(upsertStatement(env,'mapMarkers',marker));
  await batchStatements(env,stmts); await rebuildReferenceIndex(env);
}

async function deleteClueOrReveal(env,store,id){
  const workspace=await readStore(env,'workspace'),updates=cleanupPlotBeatLinks(workspace,store==='clues'?{clueId:id}:{revealId:id},now());
  const stmts=[env.DB.prepare(`DELETE FROM ${TABLE[store]} WHERE id=?`).bind(id),...updates.map(item=>upsertStatement(env,'workspace',item))];
  await batchStatements(env,stmts); await rebuildReferenceIndex(env);
}

async function prepareRestore(request,env){ const raw=await request.json(),migrated=migrateBackupData(raw); assertValidBackupSnapshot(manifestForValidation(migrated)); const restoreId=crypto.randomUUID(),manifest={...migrated,media:(migrated.media||[]).map(({blob,dataUrl,url,r2Key,...m})=>m)}; await env.MEDIA.put(`_restore/${restoreId}/manifest.json`,JSON.stringify(manifest),{httpMetadata:{contentType:'application/json'}}); return json({ok:true,restoreId,mediaIds:manifest.media.map(m=>m.id)}); }
async function uploadRestoreMedia(request,env,restoreId,mediaId){ const manifestObj=await env.MEDIA.get(`_restore/${restoreId}/manifest.json`); if(!manifestObj) return error('Restore session not found.',404); const manifest=JSON.parse(await manifestObj.text()),meta=manifest.media.find(m=>m.id===mediaId); if(!meta) return error('Media is not part of this restore.',404); const bytes=await request.arrayBuffer(); if(!bytes.byteLength) return error('Restore media file is empty.',400); await env.MEDIA.put(`_restore/${restoreId}/media/${cleanPathPart(mediaId)}`,bytes,{httpMetadata:{contentType:meta.mime||request.headers.get('content-type')||'application/octet-stream'}}); return json({ok:true}); }
export async function replaceStructuredSnapshot(env,manifest,finalized){
  const stmts=[];
  for(const store of DATA_STORES) stmts.push(env.DB.prepare(`DELETE FROM ${TABLE[store]}`));
  stmts.push(env.DB.prepare('DELETE FROM reference_index'));
  const restored={...manifest,media:finalized};
  for(const store of DATA_STORES){ const records=store==='media'?finalized:(manifest[store]||[]); for(const record of records) stmts.push(upsertStatement(env,store,record)); }
  for(const edge of buildReferenceIndex(restored)) stmts.push(env.DB.prepare(`INSERT INTO reference_index (source_store,source_id,source_field,target_entity_id,source_entity_id,kind) VALUES (?,?,?,?,?,?)`).bind(edge.sourceStore,edge.sourceId,edge.sourceField,edge.targetEntityId,edge.sourceEntityId||null,edge.kind||'Structured reference'));
  // Canonical restore and its derived reverse index commit together in one D1 transaction.
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
    try{
      const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entities'").first();
      if(!table) return json({ok:false,ready:false,error:'D1 migrations have not been applied.'},503);
      const counts=await env.DB.batch([env.DB.prepare('SELECT COUNT(*) AS n FROM entities'),env.DB.prepare('SELECT COUNT(*) AS n FROM media'),env.DB.prepare("SELECT COUNT(*) AS n FROM workspace WHERE kind<>'revision'")]);
      return json({ok:true,ready:true,app:'UnWritten',version:APP_VERSION,storage:'Cloudflare D1 + private R2',entities:Number(counts[0]?.results?.[0]?.n||0),media:Number(counts[1]?.results?.[0]?.n||0),workspace:Number(counts[2]?.results?.[0]?.n||0),accessEmail:identity.email,role:identity.role});
    }catch(e){ return error(`Storage is not ready: ${e.message}`,503); }
  }

  // Snapshot remains a backup/diagnostic primitive. Normal runtime reads use store/query routes.
  if(path==='/api/snapshot'&&method==='GET') return json({ok:true,...await snapshot(env)});
  if(path==='/api/entities/query'&&method==='GET') return json({ok:true,...await queryEntities(env,url.searchParams)});
  if(path==='/api/diagnostics'&&method==='GET') return json(await diagnostics(env,{deep:url.searchParams.get('deep')==='1'}));
  const revisionRoute=path.match(/^\/api\/entities\/([^/]+)\/revisions$/); if(revisionRoute&&method==='GET') return json({ok:true,revisions:await readEntityRevisions(env,decodeURIComponent(revisionRoute[1]),url.searchParams.get('limit')||50)});
  const impactRoute=path.match(/^\/api\/entities\/([^/]+)\/impact$/); if(impactRoute&&method==='GET') return json({ok:true,references:await entityImpact(env,decodeURIComponent(impactRoute[1]))});
  if(path==='/api/revisions'&&method==='GET') return json({ok:true,revisions:await readAllRevisions(env)});

  const storeCollection=path.match(/^\/api\/store\/([^/]+)$/);
  if(storeCollection&&method==='GET'){
    const store=decodeURIComponent(storeCollection[1]);
    if(!DATA_STORES.includes(store)) return error('Unsupported store.',404);
    return json({ok:true,records:await readStore(env,store,{includeRevisions:false})});
  }
  const storeRoute=path.match(/^\/api\/store\/([^/]+)\/([^/]+)$/);
  if(storeRoute&&method==='GET'){
    const store=decodeURIComponent(storeRoute[1]),key=decodeURIComponent(storeRoute[2]);
    if(!DATA_STORES.includes(store)) return error('Unsupported store.',404);
    const record=await readRecord(env,store,key);
    return record?json({ok:true,record}):error('Record not found.',404);
  }

  if(method!=='GET'&&method!=='HEAD') requireOwner(identity);
  if(path==='/api/diagnostics/reference-index/rebuild'&&method==='POST'){
    const started=Date.now(),rebuilt=await rebuildReferenceIndex(env); return json({ok:true,rebuildMs:Date.now()-started,rebuiltEdges:rebuilt.edges,...await diagnostics(env,{deep:true})});
  }
  if(path==='/api/restore/prepare'&&method==='POST') return prepareRestore(request,env);
  const restoreMedia=path.match(/^\/api\/restore\/([^/]+)\/media\/([^/]+)$/); if(restoreMedia&&method==='PUT') return uploadRestoreMedia(request,env,decodeURIComponent(restoreMedia[1]),decodeURIComponent(restoreMedia[2]));
  const restoreCommit=path.match(/^\/api\/restore\/([^/]+)\/commit$/); if(restoreCommit&&method==='POST') return commitRestore(env,decodeURIComponent(restoreCommit[1]));
  const mediaContent=path.match(/^\/api\/media\/([^/]+)\/content$/); if(mediaContent&&method==='GET'){ const id=decodeURIComponent(mediaContent[1]),row=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first(); if(!row) return error('Media not found.',404); const obj=await env.MEDIA.get(row.r2_key); if(!obj) return error('Media object is missing from R2.',404); const headers=new Headers(); obj.writeHttpMetadata(headers); headers.set('content-type',row.mime||headers.get('content-type')||'application/octet-stream'); headers.set('cache-control','private, max-age=3600'); headers.set('etag',obj.httpEtag); return new Response(obj.body,{headers}); }
  const mediaRoute=path.match(/^\/api\/media\/([^/]+)$/); if(mediaRoute){ const id=decodeURIComponent(mediaRoute[1]); if(method==='PUT') return putMedia(request,env,id); if(method==='DELETE'){await deleteMedia(env,id,request.headers.get('x-base-updated-at'));return json({ok:true});} }
  const entityCascade=path.match(/^\/api\/entities\/([^/]+)\/cascade$/); if(entityCascade&&method==='DELETE'){await deleteEntityCascade(env,decodeURIComponent(entityCascade[1]),request.headers.get('x-base-updated-at'));return json({ok:true});}
  const mapCascade=path.match(/^\/api\/map-versions\/([^/]+)\/cascade$/); if(mapCascade&&method==='DELETE'){await deleteMapVersionCascade(env,decodeURIComponent(mapCascade[1]),request.headers.get('x-base-updated-at'));return json({ok:true});}

  if(storeRoute){
    const store=decodeURIComponent(storeRoute[1]),key=decodeURIComponent(storeRoute[2]); if(!DATA_STORES.includes(store)||store==='media') return error('Unsupported store.',404);
    if(method==='PUT'){
      const record=await request.json(),expected=store==='settings'?record.key:record.id; if(expected!==key) return error('Record key mismatch.',400);
      const saved=await mutateStoreRecord(env,store,record,{baseUpdatedAt:request.headers.get('x-base-updated-at'),identity});
      return json({ok:true,record:saved});
    }
    if(method==='DELETE'){
      if(['entities','mapVersions'].includes(store)) return error('This record type requires its dedicated cascade deletion route.',409);
      const existing=await readRecord(env,store,key); assertFresh(existing,request.headers.get('x-base-updated-at'));
      if(store==='mapMarkers'){await deleteMapMarker(env,key);return json({ok:true});}
      if(store==='workspace'){await deleteWorkspaceCascade(env,key);return json({ok:true});}
      if(['clues','reveals'].includes(store)){await deleteClueOrReveal(env,store,key);return json({ok:true});}
      const keyCol=store==='settings'?'key':'id'; await env.DB.batch([env.DB.prepare(`DELETE FROM ${TABLE[store]} WHERE ${keyCol}=?`).bind(key),env.DB.prepare('DELETE FROM reference_index WHERE source_store=? AND source_id=?').bind(store,key)]); return json({ok:true});
    }
  }
  return error('API route not found.',404);
}

export default {
  async fetch(request,env){
    try{ const url=new URL(request.url); if(!url.pathname.startsWith('/api/')) return new Response('Not found',{status:404}); const identity=await authenticate(request,env); return await handleApi(request,env,identity); }
    catch(e){ console.error(e); return error(e?.message||'Unexpected server error.',e?.status||500,e?.details); }
  }
};
