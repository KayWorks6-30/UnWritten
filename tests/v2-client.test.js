import test from 'node:test';
import assert from 'node:assert/strict';

const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('remote adapter reads stores independently, coalesces same-store reads, and updates cache after a write',async()=>{
  const calls=[]; const original=globalThis.fetch;
  globalThis.fetch=async (url,options={})=>{
    const path=String(url),method=options.method||'GET'; calls.push([path,method,options.headers||{}]);
    if(path==='/api/store/entities'&&method==='GET') return jsonResponse({ok:true,records:[]});
    if(path==='/api/store/relations'&&method==='GET') return jsonResponse({ok:true,records:[]});
    if(path==='/api/store/settings'&&method==='GET') return jsonResponse({ok:true,records:[]});
    if(path==='/api/store/entities/e1'&&method==='PUT'){
      const body=JSON.parse(options.body); return jsonResponse({ok:true,record:{...body,updatedAt:'2026-01-01T00:00:01Z'}});
    }
    throw new Error(`Unexpected fetch ${path}`);
  };
  try{
    const db=await import(`../js/data/db.js?stores=${Date.now()}`);
    await Promise.all([db.getAll('entities'),db.getAll('entities'),db.getAll('relations'),db.getAll('settings')]);
    assert.equal(calls.filter(c=>c[0]==='/api/store/entities'&&c[1]==='GET').length,1);
    assert.equal(calls.filter(c=>c[0]==='/api/store/relations'&&c[1]==='GET').length,1);
    assert.equal(calls.filter(c=>c[0]==='/api/store/settings'&&c[1]==='GET').length,1);
    await db.putOne('entities',{id:'e1',type:'lore',name:'A',summary:'',status:'Concept',tags:[],favorite:false,fields:{},notes:'',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'});
    const rows=await db.getAll('entities');
    assert.equal(rows[0].updatedAt,'2026-01-01T00:00:01Z');
    assert.equal(calls.filter(c=>c[0]==='/api/store/entities'&&c[1]==='GET').length,1,'successful writes should update the local store cache rather than refetching the whole store');
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
    await db.replaceDatabaseSnapshot({entities:[],relations:[],media:[{id:'m1',name:'map.png',title:'Map',mime:'image/png',size:5,blob,tags:['map'],entityIds:[],createdAt:'2026-01-01T00:00:00Z'}],settings:[],clues:[],reveals:[],knowledge:[],mapVersions:[],mapMarkers:[],workspace:[]});
    assert.deepEqual(calls.map(c=>[c[0],c[1]]),[
      ['/api/restore/prepare','POST'],
      ['/api/restore/restore-1/media/m1','PUT'],
      ['/api/restore/restore-1/commit','POST']
    ]);
    assert.ok(calls[1][2] instanceof Blob);
  } finally { globalThis.fetch=original; }
});

test('lazy record reads and entity queries retain optimistic-concurrency versions',async()=>{
  const calls=[]; const original=globalThis.fetch;
  const entity={id:'e1',type:'lore',name:'A',summary:'',status:'Concept',tags:[],favorite:false,fields:{},notes:'',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:05Z'};
  globalThis.fetch=async (url,options={})=>{
    const path=String(url),method=options.method||'GET'; calls.push([path,method,options.headers||{}]);
    if(path==='/api/store/entities/e1'&&method==='GET') return jsonResponse({ok:true,record:entity});
    if(path==='/api/store/entities/e1'&&method==='PUT') return jsonResponse({ok:true,record:{...entity,name:'B',updatedAt:'2026-01-01T00:00:06Z'}});
    if(path.startsWith('/api/entities/query?')&&method==='GET') return jsonResponse({ok:true,records:[entity],total:1,nextCursor:null});
    if(path==='/api/entities/e1/cascade'&&method==='DELETE') return jsonResponse({ok:true});
    throw new Error(`Unexpected fetch ${path}`);
  };
  try{
    const db=await import(`../js/data/db.js?lazyVersions=${Date.now()}`);
    const loaded=await db.getOne('entities','e1');
    await db.putOne('entities',{...loaded,name:'B'});
    const putCall=calls.find(c=>c[0]==='/api/store/entities/e1'&&c[1]==='PUT');
    assert.equal(putCall[2]['x-base-updated-at'],'2026-01-01T00:00:05Z');

    await db.queryEntities({q:'A'});
    await db.deleteEntityCascade('e1');
    const deleteCall=calls.find(c=>c[0]==='/api/entities/e1/cascade'&&c[1]==='DELETE');
    assert.equal(deleteCall[2]['x-base-updated-at'],'2026-01-01T00:00:05Z');
  } finally { globalThis.fetch=original; }
});
