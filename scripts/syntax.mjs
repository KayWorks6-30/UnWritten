import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

async function walk(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...await walk(full));
    else if(/\.(?:js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const roots=['js','worker','scripts','tests'];
const files=(await Promise.all(roots.map(walk))).flat();
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0) process.exit(result.status||1);
}
console.log(`Syntax checked ${files.length} JS/MJS files.`);
