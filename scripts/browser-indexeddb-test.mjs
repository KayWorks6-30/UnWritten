import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

const candidates=[process.env.CHROME_BIN,'chromium','chromium-browser','google-chrome','google-chrome-stable'].filter(Boolean);
let chrome='';
for(const candidate of candidates){ const probe=spawnSync(candidate,['--version'],{stdio:'ignore'}); if(!probe.error&&probe.status===0){ chrome=candidate; break; } }
if(!chrome){ console.error('Browser integration test requires Chromium/Chrome. Set CHROME_BIN if it is not on PATH.'); process.exit(2); }

const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    const relative=normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/,'');
    if(relative.includes('..')) throw new Error('Bad path');
    const path=join(root,relative||'index.html');
    const data=await readFile(path);
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','cache-control':'no-store'}); res.end(data);
  }catch{ res.writeHead(404); res.end('Not found'); }
});
const browserHost=process.env.GALATEA_BROWSER_HOST||'127.0.0.1';
const bindHost=process.env.GALATEA_BROWSER_HOST?'0.0.0.0':'127.0.0.1';
await new Promise(resolve=>server.listen(0,bindHost,resolve));
const {port}=server.address();

const debugProbe=createServer();
await new Promise(resolve=>debugProbe.listen(0,'127.0.0.1',resolve));
const debugPort=debugProbe.address().port;
await new Promise(resolve=>debugProbe.close(resolve));

const profile=await mkdtemp(join(tmpdir(),'galatea-browser-test-'));
const pageUrl=`http://${browserHost}:${port}/tests/browser-indexeddb.html`;
const args=['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,pageUrl];
const child=spawn(chrome,args,{stdio:['ignore','ignore','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws;
try{
  let target;
  for(let i=0;i<60;i++){
    try{
      const list=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      target=list.find(item=>item.type==='page'&&item.url.includes('browser-indexeddb.html'));
      if(target) break;
    }catch{}
    await sleep(200);
  }
  if(!target) throw new Error(`Chromium did not expose the integration-test page. ${stderr}`);
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ ws.addEventListener('open',resolve,{once:true}); ws.addEventListener('error',reject,{once:true}); });
  let seq=0; const pending=new Map();
  ws.addEventListener('message',event=>{ const msg=JSON.parse(event.data); if(msg.id&&pending.has(msg.id)){ pending.get(msg.id)(msg); pending.delete(msg.id); } });
  const evaluate=expression=>new Promise(resolve=>{ const id=++seq; pending.set(id,resolve); ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true}})); });
  let result='running',body='';
  for(let i=0;i<60;i++){
    const response=await evaluate(`({result:document.body.dataset.result||'',body:document.body.textContent||''})`);
    const value=response.result?.result?.value||{}; result=value.result||''; body=value.body||'';
    if(result==='pass'||result==='fail') break;
    await sleep(200);
  }
  if(result!=='pass') throw new Error(`IndexedDB browser integration test failed or timed out: ${body||result||'no result'}`);
  console.log('IndexedDB browser integration test passed.');
}catch(error){ console.error(error.message||error); process.exitCode=1; }
finally{
  try{ ws?.close(); }catch{}
  if(child.exitCode===null){ child.kill('SIGKILL'); await Promise.race([new Promise(resolve=>child.once('close',resolve)),sleep(1000)]); }
  await new Promise(resolve=>server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100}).catch(()=>{});
}
