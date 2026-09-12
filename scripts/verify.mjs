import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

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
const sourceFiles=files.filter(f=>['.js','.html','.css','.md','.json','.webmanifest'].includes(extname(f))||f.endsWith('manifest.webmanifest'));

for(const file of sourceFiles){
  const text=await readFile(file,'utf8');
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) errors.push(`${relative(root,file)} contains a private key marker.`);
  if(/(?:api[_-]?key|secret|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}/i.test(text)) errors.push(`${relative(root,file)} looks like it contains a committed secret.`);
}

const html=await readFile(join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]);
const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
if(duplicates.length) errors.push(`Duplicate HTML ids: ${[...new Set(duplicates)].join(', ')}`);

const app=await readFile(join(root,'js/app.js'),'utf8');
for(const match of app.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)){
  const candidate=join(root,'js',match[1]);
  try{ await stat(candidate); }catch{ errors.push(`Missing JS import target from app.js: ${match[1]}`); }
}

for(const ref of [...html.matchAll(/(?:src|href)=["'](\.\/[^"'#?]+)["']/g)].map(m=>m[1])){
  try{ await stat(join(root,ref)); }catch{ errors.push(`Missing HTML asset: ${ref}`); }
}

if(errors.length){ console.error(errors.map(e=>`- ${e}`).join('\n')); process.exit(1); }
console.log('Static verification passed: assets, imports, duplicate ids, and basic secret scan.');
