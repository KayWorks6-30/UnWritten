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

const migrations=(await Promise.all(['0001_initial.sql','0002_v3_workspace.sql'].map(name=>readFile(join(root,'migrations',name),'utf8')))).join('\n');
for(const table of ['entities','relations','settings','media','clues','reveals','knowledge','map_versions','map_markers','workspace']) if(!new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`).test(migrations)) errors.push(`D1 migrations are missing ${table}.`);

try{
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(pkg.dependencies?.jose||'')) errors.push('jose must be pinned to an exact version.');
  if(!/^\d+\.\d+\.\d+$/.test(pkg.devDependencies?.wrangler||'')) errors.push('Wrangler must be pinned to an exact version.');
}catch(error){ errors.push(`package.json is invalid: ${error.message}`); }

if(errors.length){ console.error(errors.map(e=>`- ${e}`).join('\n')); process.exit(1); }
console.log('V3 verification passed: assets, imports, bindings, migrations, pinned direct dependencies, duplicate ids, and basic secret scan.');
