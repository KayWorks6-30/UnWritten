import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APP_VERSION } from '../js/domain/schema.js';

const root=new URL('../',import.meta.url);
const read=async path=>readFile(new URL(path,root),'utf8');

test('V3.1 identifies itself as 3.1.0',()=>{ assert.equal(APP_VERSION,'3.1.0'); });

test('Wrangler binds the production D1 and R2 resources and disables alternate public endpoints',async()=>{
  const cfg=JSON.parse(await read('wrangler.jsonc'));
  assert.equal(cfg.name,'unwritten');
  assert.equal(cfg.workers_dev,false);
  assert.equal(cfg.preview_urls,false);
  assert.deepEqual(cfg.routes,[{pattern:'unwritten.kayworks.dev',custom_domain:true}]);
  assert.equal(cfg.d1_databases[0].binding,'DB');
  assert.equal(cfg.d1_databases[0].database_name,'unwritten');
  assert.equal(cfg.d1_databases[0].database_id,'15ab3fb3-8673-4f5b-8633-1746fb6fa677');
  assert.equal(cfg.r2_buckets[0].binding,'MEDIA');
  assert.equal(cfg.r2_buckets[0].bucket_name,'unwritten');
});

test('canonical data adapter is remote while IndexedDB is limited to local drafts/legacy migration',async()=>{
  const db=await read('js/data/db.js');
  const drafts=await read('js/data/drafts.js');
  const legacy=await read('js/data/legacy.js');
  assert.match(db,/\/api\/snapshot/);
  assert.doesNotMatch(db,/indexedDB/);
  assert.match(drafts,/indexedDB\.open/);
  assert.match(legacy,/kayworks_world_bible/);
});

test('service worker never serves API responses from cache',async()=>{
  const sw=await read('sw.js');
  assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw,/fetch\(event\.request\)/);
});

test('D1 migration defines every authoritative store plus R2 media metadata',async()=>{
  const sql=await read('migrations/0001_initial.sql');
  for(const table of ['entities','relations','settings','media','clues','reveals','knowledge','map_versions','map_markers']) assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  assert.match(sql,/r2_key TEXT NOT NULL/);
});

test('V1 backup format remains supported for V3 migration',async()=>{
  const backup=await read('js/data/backup.js');
  const migrations=await read('js/data/migrations.js');
  assert.match(backup,/kayworks-world-bible-backup/);
  assert.match(migrations,/kayworks-world-bible-backup/);
});
