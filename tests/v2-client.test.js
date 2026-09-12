import test from 'node:test';
import assert from 'node:assert/strict';

const emptySnapshot={entities:[],relations:[],media:[],settings:[],clues:[],reveals:[],knowledge:[],mapVersions:[],mapMarkers:[]};
const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('remote adapter coalesces concurrent store reads into one snapshot request and invalidates after a write',async()=>{
  const calls=[]; const original=globalThis.fetch;
  globalThis.fetch=async (url,options={})=>{
    calls.push([String(url),options.method||'GET']);
    if(String(url)==='/api/snapshot') return jsonResponse({ok:true,...emptySnapshot});
    if(String(url).startsWith('/api/store/')) return jsonResponse({ok:true});
    throw new Error(`Unexpected fetch ${url}`);
  };
  try{
    const db=await import(`../js/data/db.js?coalesce=${Date.now()}`);
    await Promise.all([db.getAll('entities'),db.getAll('relations'),db.getAll('settings')]);
    assert.equal(calls.filter(c=>c[0]==='/api/snapshot').length,1);
    await db.putOne('entities',{id:'e1',type:'lore',name:'A',summary:'',status:'Concept',tags:[],favorite:false,fields:{},notes:'',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'});
    await db.getAll('entities');
    assert.equal(calls.filter(c=>c[0]==='/api/snapshot').length,2);
  } finally { globalThis.fetch=original; }
});

test('remote restore stages manifest, uploads media separately, then commits',async()=>{
  const calls=[]; const original=globalThis.fetch;
  globalThis.fetch=async (url,options={})=>{
    calls.push([String(url),options.method||'GET',options.body]);
    if(String(url)==='/api/restore/prepare') return jsonResponse({ok:true,restoreId:'restore-1',mediaIds:['m1']});
    if(String(url)==='/api/restore/restore-1/media/m1') return jsonResponse({ok:true});
    if(String(url)==='/api/restore/restore-1/commit') return jsonResponse({ok:true});
    throw new Error(`Unexpected fetch ${url}`);
  };
  try{
    const db=await import(`../js/data/db.js?restore=${Date.now()}`);
    const blob=new Blob(['image'],{type:'image/png'});
    await db.replaceDatabaseSnapshot({...emptySnapshot,media:[{id:'m1',name:'map.png',title:'Map',mime:'image/png',size:5,blob,tags:['map'],entityIds:[],createdAt:'2026-01-01T00:00:00Z'}]});
    assert.deepEqual(calls.map(c=>[c[0],c[1]]),[
      ['/api/restore/prepare','POST'],
      ['/api/restore/restore-1/media/m1','PUT'],
      ['/api/restore/restore-1/commit','POST']
    ]);
    assert.ok(calls[1][2] instanceof Blob);
  } finally { globalThis.fetch=original; }
});
