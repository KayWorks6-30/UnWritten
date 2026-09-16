import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APP_VERSION, SCHEMA_VERSION } from '../js/domain/schema.js';
import { BACKUP_MIGRATIONS, migrateBackupData } from '../js/data/migrations.js';
import { handleApi } from '../worker/index.js';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
function prepared(sql,args=[]){ return {sql,args,bind(...next){return prepared(sql,next);}}; }

test('V3.5 stabilization advances application/schema without changing the V3 domain model',()=>{
  assert.equal(APP_VERSION,'3.5.1');
  assert.equal(SCHEMA_VERSION,8);
  assert.deepEqual([...BACKUP_MIGRATIONS.keys()],[1,2,3,4,5,6,7]);
});

test('backup migrations advance sequentially and normalize concurrency timestamps',()=>{
  const stamp='2026-01-01T00:00:00.000Z';
  const migrated=migrateBackupData({
    format:'kayworks-world-bible-backup',schemaVersion:6,
    entities:[],relations:[],settings:[{key:'project',value:{name:'Old'}}],
    media:[{id:'m',name:'a.png',title:'A',mime:'image/png',size:1,tags:[],entityIds:[],createdAt:stamp}],
    clues:[],reveals:[],knowledge:[],mapVersions:[{id:'mv',mapId:'missing',mediaId:'m',createdAt:stamp}],mapMarkers:[],workspace:[]
  });
  assert.equal(migrated.schemaVersion,8);
  assert.equal(migrated.media[0].updatedAt,stamp);
  assert.equal(migrated.mapVersions[0].updatedAt,stamp);
  assert.equal(migrated.settings[0].value.schemaVersion,8);
});

test('runtime data adapter no longer depends on whole-project snapshot reads',async()=>{
  const db=await read('js/data/db.js');
  assert.match(db,/\/api\/store\//);
  assert.match(db,/\/api\/entities\/query/);
  assert.doesNotMatch(db,/\/api\/snapshot/);
  assert.match(db,/storeCache/);
  assert.match(db,/x-base-updated-at/);
});

test('schema-8 migration adds revision timestamps, hot indexes, and DB-level reference safety nets',async()=>{
  const sql=await read('migrations/0004_v35_architecture_stabilization.sql');
  for(const fragment of [
    'ALTER TABLE settings ADD COLUMN updated_at','ALTER TABLE media ADD COLUMN updated_at','ALTER TABLE map_versions ADD COLUMN updated_at',
    'idx_entities_name_nocase','idx_entities_type_status_archived','trg_relations_refs_insert','trg_knowledge_refs_insert','trg_map_markers_refs_insert'
  ]) assert.match(sql,new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('optimistic concurrency now protects non-entity mutable stores',async()=>{
  const existing={key:'project',value:{name:'Current'},updated_at:'2026-09-16T10:00:00.000Z'};
  const DB={
    prepare(sql){
      return {
        ...prepared(sql),
        bind(...args){
          const stmt=prepared(sql,args);
          stmt.first=async()=>sql.startsWith('SELECT * FROM settings WHERE key=')?existing:null;
          stmt.all=async()=>({results:[]});
          return stmt;
        },
        first:async()=>null,all:async()=>({results:[]})
      };
    },
    async batch(){ throw new Error('stale write must not reach D1 batch'); }
  };
  const request=new Request('https://unwritten.test/api/store/settings/project',{method:'PUT',headers:{'content-type':'application/json','x-base-updated-at':'2026-09-16T09:00:00.000Z'},body:JSON.stringify({key:'project',value:{name:'Incoming'}})});
  await assert.rejects(()=>handleApi(request,{DB},{role:'owner',email:'owner@example.test'}),error=>error?.status===409&&/changed elsewhere/i.test(error.message));
});

test('Worker exposes diagnostics, self-healing reverse index, per-store reads, and server-side entity query routes',async()=>{
  const worker=await read('worker/index.js');
  assert.match(worker,/path==='\/api\/diagnostics'/);
  assert.match(worker,/\/api\/diagnostics\/reference-index\/rebuild/);
  assert.match(worker,/\/api\/entities\/query/);
  assert.match(worker,/const storeCollection=path\.match/);
  assert.match(worker,/mutateStoreRecord/);
  assert.match(worker,/normalizeForWrite/);
  assert.match(worker,/batchDerivedStatements/);
  assert.match(worker,/chunkSize:100/);
});

test('application exposes private architecture diagnostics and manual stress harness exists',async()=>{
  const app=await read('js/app.js'),pkg=JSON.parse(await read('package.json'));
  assert.match(app,/Architecture diagnostics/);
  assert.match(app,/runArchitectureDiagnostics/);
  assert.match(app,/rebuildDerivedReferenceIndex/);
  assert.equal(pkg.scripts.stress,'node scripts/stress.mjs');
});
