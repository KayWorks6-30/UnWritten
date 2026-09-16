import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, extname, dirname, resolve } from 'node:path';

const root=process.cwd();
const errors=[];
async function walk(dir){
  const out=[];
  for(const name of await readdir(dir)){
    if(['.git','node_modules','dist'].includes(name)) continue;
    const path=join(dir,name); const info=await stat(path);
    if(info.isDirectory()) out.push(...await walk(path)); else out.push(path);
  }
  return out;
}
const files=await walk(root);
const sourceFiles=files.filter(f=>['.js','.html','.css','.md','.json','.jsonc','.sql','.webmanifest'].includes(extname(f))||f.endsWith('manifest.webmanifest'));

for(const file of sourceFiles){
  const text=await readFile(file,'utf8');
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) errors.push(`${relative(root,file)} contains a private key marker.`);
  if(/(?:api[_-]?key|secret|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}/i.test(text)) errors.push(`${relative(root,file)} looks like it contains a committed secret.`);
}

const html=await readFile(join(root,'index.html'),'utf8');

const sw=await readFile(join(root,'sw.js'),'utf8');
if(!/const CACHE = ['"]unwritten-v3\.5\.1['"]/.test(sw)) errors.push('Service worker cache name must identify V3.5.1.');
const shell=new Set([...sw.matchAll(/['"](\.\/js\/[^'"]+\.js)['"]/g)].map(m=>m[1]));
async function importGraph(entry,seen=new Set()){
  const absolute=resolve(root,entry); if(seen.has(absolute)) return seen; seen.add(absolute);
  const source=await readFile(absolute,'utf8');
  for(const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+\.js)['"]/g)) await importGraph(relative(root,resolve(dirname(absolute),match[1])).replaceAll('\\','/'),seen);
  return seen;
}
const appGraph=await importGraph('js/app.js');
for(const absolute of appGraph){ const ref=`./${relative(root,absolute).replaceAll('\\','/')}`; if(!shell.has(ref)) errors.push(`Service worker shell is missing required module: ${ref}`); }
if(!/<title>UnWritten<\/title>/.test(html)) errors.push('Browser title must be exactly UnWritten.');
try{
  const manifest=JSON.parse(await readFile(join(root,'manifest.webmanifest'),'utf8'));
  if(manifest.name!=='UnWritten'||manifest.short_name!=='UnWritten') errors.push('PWA name and short_name must be UnWritten.');
  for(const icon of manifest.icons||[]){ try{ await stat(join(root,icon.src)); }catch{ errors.push(`Missing manifest icon: ${icon.src}`); } }
  if(!(manifest.icons||[]).some(icon=>icon.sizes==='192x192')||!(manifest.icons||[]).some(icon=>icon.sizes==='512x512')) errors.push('PWA manifest must include 192x192 and 512x512 UnWritten icons.');
}catch(error){ errors.push(`manifest.webmanifest is invalid JSON: ${error.message}`); }
const ids=[...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]);
const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
if(duplicates.length) errors.push(`Duplicate HTML ids: ${[...new Set(duplicates)].join(', ')}`);

for(const file of files.filter(f=>extname(f)==='.js')){
  const text=await readFile(file,'utf8');
  for(const match of text.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)){
    const candidate=resolve(dirname(file),match[1]);
    try{ await stat(candidate); }catch{ errors.push(`Missing JS import target from ${relative(root,file)}: ${match[1]}`); }
  }
}

for(const ref of [...html.matchAll(/(?:src|href)=["'](\.\/?[^"'#?]+)["']/g)].map(m=>m[1])){
  try{ await stat(join(root,ref.replace(/^\.\//,''))); }catch{ errors.push(`Missing HTML asset: ${ref}`); }
}

try{
  const cfg=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8'));
  const db=cfg.d1_databases?.[0],bucket=cfg.r2_buckets?.[0];
  if(db?.binding!=='DB'||db?.database_name!=='unwritten'||db?.database_id!=='15ab3fb3-8673-4f5b-8633-1746fb6fa677') errors.push('wrangler.jsonc D1 binding does not match the production unwritten database.');
  if(bucket?.binding!=='MEDIA'||bucket?.bucket_name!=='unwritten') errors.push('wrangler.jsonc R2 binding does not match the production unwritten bucket.');
  if(cfg.workers_dev!==false||cfg.preview_urls!==false) errors.push('Alternate Worker endpoints must remain disabled for the private production app.');
}catch(error){errors.push(`wrangler.jsonc is invalid JSON: ${error.message}`);}

const migrations=(await Promise.all(['0001_initial.sql','0002_v3_workspace.sql','0003_v34_architecture_hardening.sql','0004_v35_architecture_stabilization.sql'].map(name=>readFile(join(root,'migrations',name),'utf8')))).join('\n');
for(const table of ['entities','relations','settings','media','clues','reveals','knowledge','map_versions','map_markers','workspace','reference_index']) if(!new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`).test(migrations)) errors.push(`D1 migrations are missing ${table}.`);
if(!/CREATE VIEW narrative_positions\b/.test(migrations)) errors.push('D1 migrations are missing the narrative_positions view.');
if(!/ALTER TABLE relations ADD COLUMN status\b/.test(migrations)) errors.push('D1 migrations are missing relationship status hardening.');
if(!/ALTER TABLE reveals ADD COLUMN part_id\b/.test(migrations)) errors.push('D1 migrations are missing Reveal Part support.');
if(!/ALTER TABLE settings ADD COLUMN updated_at\b/.test(migrations)) errors.push('D1 migrations are missing generalized concurrency timestamps.');
if(!/trg_relations_refs_insert/.test(migrations)||!/trg_knowledge_refs_insert/.test(migrations)) errors.push('D1 migrations are missing structural reference safety triggers.');

try{
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(pkg.dependencies?.jose||'')) errors.push('jose must be pinned to an exact version.');
  if(!/^\d+\.\d+\.\d+$/.test(pkg.devDependencies?.wrangler||'')) errors.push('Wrangler must be pinned to an exact version.');
}catch(error){ errors.push(`package.json is invalid: ${error.message}`); }

if(errors.length){ console.error(errors.map(e=>`- ${e}`).join('\n')); process.exit(1); }
console.log('V3 verification passed: assets, imports, bindings, migrations, pinned direct dependencies, duplicate ids, and basic secret scan.');
