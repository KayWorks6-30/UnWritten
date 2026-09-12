import http from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, resolve, normalize } from 'node:path';

const root=process.cwd();
const chromium=process.env.CHROMIUM_BIN||'/usr/bin/chromium';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=','base64');
const stamp='2026-09-12T12:00:00.000Z';
const snapshot={ok:true,entities:[
  {id:'world',type:'location',name:'Galatea',summary:'',status:'Canon',tags:[],favorite:false,fields:{locationKind:'World'},notes:'',archivedAt:null,createdAt:stamp,updatedAt:stamp},
  {id:'map-world',type:'map',name:'World Map',summary:'',status:'Canon',tags:[],favorite:false,fields:{mapKind:'World',scopeLocationId:'world',parentMapId:''},notes:'',archivedAt:null,createdAt:stamp,updatedAt:stamp}
],relations:[],media:[{id:'media-1',name:'world.png',title:'Remote World Map',mime:'image/png',size:68,tags:['map'],entityIds:['map-world'],createdAt:stamp,url:'/api/media/media-1/content'}],settings:[{key:'project',value:{name:'Browser Smoke World',currentBookId:null,schemaVersion:6}}],clues:[],reveals:[],knowledge:[],mapVersions:[{id:'version-1',mapId:'map-world',mediaId:'media-1',label:'Current',variant:'World',effectiveDate:'',notes:'',createdAt:stamp}],mapMarkers:[],workspace:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
function safePath(urlPath){const rel=decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '')||'index.html';const full=resolve(root,normalize(rel));return full.startsWith(root)?full:null;}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local.test');
  if(u.pathname==='/api/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,ready:true,app:'UnWritten.KayWorks',version:'3.0.0',role:'owner',accessEmail:'owner@local.test'}));}
  if(u.pathname==='/api/snapshot'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(snapshot));}
  if(u.pathname==='/api/media/media-1/content'){res.writeHead(200,{'content-type':'image/png','cache-control':'no-store'});return res.end(png);}
  if(u.pathname.startsWith('/api/')){res.writeHead(404,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'not implemented in browser smoke'}));}
  const path=safePath(u.pathname);if(!path){res.writeHead(403);return res.end('Forbidden');}const data=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
}catch(error){res.writeHead(error?.code==='ENOENT'?404:500);res.end(String(error?.message||error));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const profile=await mkdtemp(join(tmpdir(),'unwritten-cdp-'));
const child=spawn(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--remote-debugging-port=0','--host-resolver-rules=MAP unwritten.local 127.0.0.1',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let stderr='';child.stderr.on('data',d=>stderr+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitDebugPort(){for(let i=0;i<100;i++){try{const text=await readFile(join(profile,'DevToolsActivePort'),'utf8');const [p]=text.trim().split(/\r?\n/);if(p)return Number(p);}catch{}await sleep(50);}throw new Error(`Chromium DevTools port did not become ready. ${stderr.slice(-600)}`);}
let ws,id=0;const pending=new Map();const events=new Map();
function call(method,params={}){return new Promise((resolve,reject)=>{const callId=++id;pending.set(callId,{resolve,reject});ws.send(JSON.stringify({id:callId,method,params}));});}
function onceEvent(name){return new Promise(resolve=>{const list=events.get(name)||[];list.push(resolve);events.set(name,list);});}
function onMessage(event){const msg=JSON.parse(String(event.data));if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.reject(new Error(msg.error.message));else p.resolve(msg.result);return;}if(msg.method){const list=events.get(msg.method)||[];events.delete(msg.method);for(const fn of list)fn(msg.params);}}
async function connect(){const debugPort=await waitDebugPort();let pages=[];for(let i=0;i<40;i++){try{pages=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();if(pages.some(p=>p.type==='page'))break;}catch{}await sleep(50);}const page=pages.find(p=>p.type==='page');if(!page)throw new Error('No Chromium page target found.');ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});ws.addEventListener('message',onMessage);await call('Page.enable');await call('Runtime.enable');}
async function navigate(hash){const loaded=onceEvent('Page.loadEventFired');await call('Page.navigate',{url:`http://unwritten.local:${port}/${hash}`});await Promise.race([loaded,sleep(5000)]);const result=await call('Runtime.evaluate',{expression:`new Promise(r=>setTimeout(()=>r(document.documentElement.outerHTML),1200))`,awaitPromise:true,returnByValue:true});return result.result?.value||'';}
try{
  await connect();
  const mediaDom=await navigate('#/media');
  if(!mediaDom.includes('Remote World Map')) throw new Error('Media page did not render the remote media record.');
  if(!/img[^>]+src=["']\/api\/media\/media-1\/content/i.test(mediaDom)) throw new Error('Media page did not render the protected remote media URL.');
  const mapDom=await navigate('#/maps/map-world');
  if(!mapDom.includes('World Map')) throw new Error('Map page did not render the map entity.');
  if(!mapDom.includes('Zoom range: 25%–300%.')) throw new Error('Map zoom/help UI did not render the V3 range.');
  if(!/map-base-image[^>]+src=["']\/api\/media\/media-1\/content/i.test(mapDom)) throw new Error('Map page did not render its protected remote map image.');
  console.log('Browser smoke passed: server-backed app boot + remote Media/Maps rendering.');
} finally {
  try{ws?.close();}catch{}
  child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(2000)]);if(child.exitCode===null)child.kill('SIGKILL');
  await new Promise(resolve=>server.close(resolve));
  await sleep(200);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100}).catch(()=>{});
}
