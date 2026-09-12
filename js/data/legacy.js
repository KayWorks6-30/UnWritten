const LEGACY_DB='kayworks_world_bible';
const STORES=['entities','relations','media','settings','clues','reveals','knowledge','mapVersions','mapMarkers'];
function req(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function hasLegacyDatabase(){
  if(!('indexedDB' in globalThis)) return false;
  if(typeof indexedDB.databases!=='function') return false;
  try{return (await indexedDB.databases()).some(db=>db.name===LEGACY_DB);}catch{return false;}
}
export async function readLegacyBackup(){
  if(!await hasLegacyDatabase()) throw new Error('No V1 browser database was found on this origin.');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(LEGACY_DB);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{
    const data={};
    for(const name of STORES){
      if(!db.objectStoreNames.contains(name)){data[name]=[];continue;}
      const tx=db.transaction(name,'readonly'); data[name]=await req(tx.objectStore(name).getAll());
    }
    return {format:'kayworks-world-bible-backup',appVersion:'1.1.x-legacy-browser',schemaVersion:5,exportedAt:new Date().toISOString(),...data};
  } finally { db.close(); }
}
