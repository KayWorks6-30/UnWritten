import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { replaceStructuredSnapshot, handleApi } from '../worker/index.js';
import { createEmptyEntity } from '../js/domain/schema.js';
import { validateBackupSnapshot } from '../js/data/validation.js';

function prepared(sql,args=[]){
  return { sql, args, bind(...next){ return prepared(sql,next); } };
}
function entityRow(entity){
  return {
    id:entity.id,type:entity.type,name:entity.name,summary:entity.summary||'',status:entity.status,
    tags_json:JSON.stringify(entity.tags||[]),favorite:entity.favorite?1:0,fields_json:JSON.stringify(entity.fields||{}),notes:entity.notes||'',archived_at:entity.archivedAt||null,
    created_at:entity.createdAt,updated_at:entity.updatedAt
  };
}
function emptyManifest(){
  return {entities:[],relations:[],media:[],settings:[],clues:[],reveals:[],knowledge:[],mapVersions:[],mapMarkers:[],workspace:[]};
}

test('large structured restore is submitted as one atomic D1 batch',async()=>{
  const calls=[];
  const DB={
    prepare(sql){ return prepared(sql); },
    async batch(statements){ calls.push(statements); throw new Error('injected failure near the end of the transaction'); }
  };
  const manifest=emptyManifest();
  manifest.entities=Array.from({length:120},(_,i)=>({
    ...createEmptyEntity('lore'), id:`entity-${i}`, name:`Entity ${i}`
  }));
  await assert.rejects(()=>replaceStructuredSnapshot({DB},manifest,[]),/injected failure/);
  assert.equal(calls.length,1,'restore must never split the destructive replacement across multiple DB.batch calls');
  assert.equal(calls[0].length,130,'10 table clears + 120 entity upserts must be in the same transaction');
});

test('reviewer mutation is rejected before a write route can run',async()=>{
  await assert.rejects(
    ()=>handleApi(new Request('https://unwritten.test/api/store/settings/project',{method:'PUT',headers:{'content-type':'application/json'},body:'{}'}),{}, {role:'reviewer',email:'reviewer@example.test'}),
    error=>error?.status===403 && /read-only/i.test(error.message)
  );
});

test('generic entity delete is behaviorally rejected in favor of cascade route',async()=>{
  const response=await handleApi(new Request('https://unwritten.test/api/store/entities/e1',{method:'DELETE'}),{}, {role:'owner',email:'owner@example.test'});
  assert.equal(response.status,409);
  assert.match((await response.json()).error,/cascade deletion route/i);
});

test('stale entity update returns HTTP 409',async()=>{
  const existing={...createEmptyEntity('lore'),id:'e1',name:'Existing',updatedAt:'2026-09-12T12:00:00.000Z'};
  const incoming={...existing,name:'Changed',updatedAt:'2026-09-12T13:00:00.000Z'};
  const DB={
    prepare(sql){
      const base=prepared(sql);
      return { ...base, bind(...args){
        const stmt=prepared(sql,args);
        stmt.first=async()=> sql.startsWith('SELECT * FROM entities WHERE id=') ? entityRow(existing) : null;
        stmt.all=async()=>({results:[]});
        return stmt;
      }, first:async()=>null, all:async()=>({results:[]}) };
    },
    async batch(){ throw new Error('batch must not run for a stale update'); }
  };
  const response=await handleApi(new Request('https://unwritten.test/api/store/entities/e1',{method:'PUT',headers:{'content-type':'application/json','x-base-updated-at':'2026-09-12T11:00:00.000Z'},body:JSON.stringify(incoming)}),{DB},{role:'owner',email:'owner@example.test'});
  assert.equal(response.status,409);
  assert.match((await response.json()).error,/changed elsewhere/i);
});

test('location parent-cycle PUT is rejected behaviorally',async()=>{
  const parent={...createEmptyEntity('location'),id:'b',name:'B',fields:{locationKind:'City',parentLocationId:'a'}};
  const candidate={...createEmptyEntity('location'),id:'a',name:'A',fields:{locationKind:'City',parentLocationId:'b'}};
  const DB={
    prepare(sql){
      return { ...prepared(sql), bind(...args){
        const stmt=prepared(sql,args);
        stmt.first=async()=> sql.startsWith('SELECT * FROM entities WHERE id=') && args[0]==='b' ? entityRow(parent) : null;
        stmt.all=async()=> sql.startsWith('SELECT id,type,fields_json FROM entities WHERE type=') ? {results:[entityRow(parent)]} : {results:[]};
        return stmt;
      }, first:async()=>null, all:async()=>({results:[]}) };
    },
    async batch(){ throw new Error('batch must not run for a cyclic parent update'); }
  };
  await assert.rejects(
    ()=>handleApi(new Request('https://unwritten.test/api/store/entities/a',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(candidate)}),{DB},{role:'owner',email:'owner@example.test'}),
    /hierarchy cannot contain a cycle/i
  );
});

test('backup validation rejects duplicate knowledge state at the same story point',()=>{
  const subject={...createEmptyEntity('lore'),id:'secret',name:'Secret'};
  const scene={...createEmptyEntity('scene'),id:'scene',name:'Scene'};
  const snapshot={format:'kayworks-world-bible-backup',schemaVersion:6,entities:[subject,scene],relations:[],media:[],settings:[],clues:[],reveals:[],mapVersions:[],mapMarkers:[],workspace:[],knowledge:[
    {id:'k1',subjectEntityId:'secret',knowerKind:'reader',knowerEntityId:null,state:'Knows truth',storyEntityId:'scene'},
    {id:'k2',subjectEntityId:'secret',knowerKind:'reader',knowerEntityId:null,state:'Incorrect belief',storyEntityId:'scene'}
  ]};
  assert.match(validateBackupSnapshot(snapshot).join(' '),/duplicates the same subject, knower, and story point/i);
});

test('V3 service worker precaches the complete V3 boot modules and browser identity is UnWritten',async()=>{
  const [sw,html,manifestText]=await Promise.all([
    readFile(new URL('../sw.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../manifest.webmanifest',import.meta.url),'utf8')
  ]);
  assert.match(sw,/unwritten-v3\.0\.0/);
  assert.match(sw,/\.\/js\/domain\/intelligence\.js/);
  assert.match(sw,/\.\/js\/ui\/v3\.js/);
  assert.match(html,/<title>UnWritten<\/title>/);
  assert.match(html,/assets\/favicon\.ico/);
  assert.match(html,/class=\"brand-icon\"[^>]+unwritten-icon-192\.png/);
  assert.match(html,/<div class=\"brand\">UnWritten<\/div>/);
  assert.doesNotMatch(html,/id=\"project-name\"/);
  const manifest=JSON.parse(manifestText);
  assert.equal(manifest.name,'UnWritten');
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'&&icon.src==='assets/unwritten-icon-192.png'));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.src==='assets/unwritten-icon-512.png'));
});

test('normal snapshots exclude revision rows and revisions have lazy API routes',async()=>{
  const worker=await readFile(new URL('../worker/index.js',import.meta.url),'utf8');
  assert.match(worker,/SELECT \* FROM workspace WHERE kind <> 'revision'/);
  assert.match(worker,/\/api\\\/entities\\\/\(\[\^\/\]\+\)\\\/revisions/);
  assert.match(worker,/path==='\/api\/revisions'/);
  assert.match(worker,/if\(item\.kind==='revision'\) return d\.entityId===id/);
});

test('entity revision and update share one D1 batch',async()=>{
  const worker=await readFile(new URL('../worker/index.js',import.meta.url),'utf8');
  assert.match(worker,/env\.DB\.batch\(revision\?\[revision,upsertStatement\(env,store,record\)\]/);
});
